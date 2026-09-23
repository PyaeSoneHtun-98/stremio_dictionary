import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import type { IncomingMessage } from 'node:http'
import { request } from 'node:https'
import { dirname } from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import {
  assertAllowedUpdateUrl,
  parseInstallerChecksum,
  parseLatestRelease,
  type ReleaseCandidate
} from './updatePolicy'

const LATEST_RELEASE_URL =
  'https://api.github.com/repos/PyaeSoneHtun-98/stremio_dictionary/releases/latest'
const USER_AGENT = 'Subtitle-Bridge-Updater'
const MAX_METADATA_BYTES = 2 * 1024 * 1024
const MAX_CHECKSUM_BYTES = 4 * 1024
const MAX_INSTALLER_BYTES = 300 * 1024 * 1024
const MAX_REDIRECTS = 5
const REQUEST_TIMEOUT_MS = 30_000

export interface DownloadProgress {
  receivedBytes: number
  totalBytes: number | null
}

export interface InstallerDownloadResult {
  sha256: string
  bytes: number
}

export interface UpdateClient {
  fetchLatest(currentVersion: string): Promise<ReleaseCandidate | null>
  fetchChecksum(release: ReleaseCandidate): Promise<string>
  downloadInstaller(
    release: ReleaseCandidate,
    destination: string,
    onProgress: (progress: DownloadProgress) => void
  ): Promise<InstallerDownloadResult>
}

export class GithubUpdateClient implements UpdateClient {
  async fetchLatest(currentVersion: string): Promise<ReleaseCandidate | null> {
    const body = await requestText(LATEST_RELEASE_URL, MAX_METADATA_BYTES, 'application/vnd.github+json')

    let payload: unknown
    try {
      payload = JSON.parse(body)
    } catch {
      throw new Error('GitHub returned unreadable update metadata.')
    }

    return parseLatestRelease(payload, currentVersion)
  }

  async fetchChecksum(release: ReleaseCandidate): Promise<string> {
    const body = await requestText(release.checksumUrl, MAX_CHECKSUM_BYTES, 'text/plain')
    return parseInstallerChecksum(body)
  }

  async downloadInstaller(
    release: ReleaseCandidate,
    destination: string,
    onProgress: (progress: DownloadProgress) => void
  ): Promise<InstallerDownloadResult> {
    return downloadFile(release.installerUrl, destination, MAX_INSTALLER_BYTES, onProgress)
  }
}

export async function sha256File(filePath: string, maxBytes = MAX_INSTALLER_BYTES): Promise<string> {
  const fileStats = await stat(filePath)
  if (!fileStats.isFile() || fileStats.size <= 0 || fileStats.size > maxBytes) {
    throw new Error('The downloaded update file is invalid.')
  }

  const hash = createHash('sha256')
  await pipeline(
    createReadStream(filePath),
    new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        hash.update(chunk)
        callback(null, chunk)
      }
    }),
    new Transform({
      transform(_chunk: Buffer, _encoding, callback) {
        callback()
      }
    })
  )

  return hash.digest('hex')
}

async function requestText(url: string, maxBytes: number, accept: string): Promise<string> {
  const response = await openHttps(url, accept)
  const chunks: Buffer[] = []
  let bytes = 0

  for await (const rawChunk of response) {
    const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk)
    bytes += chunk.length
    if (bytes > maxBytes) {
      response.destroy()
      throw new Error('The update response exceeded its allowed size.')
    }
    chunks.push(chunk)
  }

  return Buffer.concat(chunks).toString('utf8')
}

async function downloadFile(
  url: string,
  destination: string,
  maxBytes: number,
  onProgress: (progress: DownloadProgress) => void
): Promise<InstallerDownloadResult> {
  const response = await openHttps(url, 'application/octet-stream')
  const contentLength = parseContentLength(response.headers['content-length'])
  if (contentLength !== null && (contentLength <= 0 || contentLength > maxBytes)) {
    response.destroy()
    throw new Error('The update installer size is invalid.')
  }

  await mkdir(dirname(destination), { recursive: true })
  const partial = `${destination}.part`
  await rm(partial, { force: true })

  const hash = createHash('sha256')
  let bytes = 0
  let lastReportedPercent = -1

  const monitor = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length
      if (bytes > maxBytes) {
        callback(new Error('The update installer exceeded its allowed size.'))
        return
      }

      hash.update(chunk)
      const percent =
        contentLength && contentLength > 0 ? Math.floor((bytes / contentLength) * 100) : -1
      if (percent !== lastReportedPercent) {
        lastReportedPercent = percent
        onProgress({ receivedBytes: bytes, totalBytes: contentLength })
      }
      callback(null, chunk)
    }
  })

  try {
    await pipeline(response, monitor, createWriteStream(partial, { flags: 'wx' }))
    if (bytes <= 0 || (contentLength !== null && bytes !== contentLength)) {
      throw new Error('The update installer download was incomplete.')
    }

    await rm(destination, { force: true })
    await rename(partial, destination)
    return { sha256: hash.digest('hex'), bytes }
  } catch (error) {
    await rm(partial, { force: true })
    throw error
  }
}

async function openHttps(
  rawUrl: string,
  accept: string,
  redirectCount = 0
): Promise<IncomingMessage> {
  const url = assertAllowedUpdateUrl(rawUrl)
  if (redirectCount > MAX_REDIRECTS) {
    throw new Error('The update download used too many redirects.')
  }

  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: 'GET',
        headers: {
          Accept: accept,
          'User-Agent': USER_AGENT,
          'X-GitHub-Api-Version': '2022-11-28'
        }
      },
      (response) => {
        const status = response.statusCode ?? 0
        if ([301, 302, 303, 307, 308].includes(status)) {
          const location = response.headers.location
          response.resume()
          if (!location) {
            reject(new Error('The update download redirect was invalid.'))
            return
          }

          let redirected: string
          try {
            redirected = new URL(location, url).toString()
            assertAllowedUpdateUrl(redirected)
          } catch {
            reject(new Error('The update download redirected to an unapproved source.'))
            return
          }

          void openHttps(redirected, accept, redirectCount + 1).then(resolve, reject)
          return
        }

        if (status !== 200) {
          response.resume()
          reject(new Error('The update server request failed. Try again later.'))
          return
        }

        resolve(response)
      }
    )

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error('The update request timed out.'))
    })
    req.on('error', reject)
    req.end()
  })
}

function parseContentLength(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) {
    return null
  }

  const parsed = Number.parseInt(raw, 10)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}
