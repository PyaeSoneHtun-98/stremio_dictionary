const OFFICIAL_REPOSITORY = 'PyaeSoneHtun-98/stremio_dictionary'
export const SETUP_ASSET_NAME = 'SubtitleBridge-Setup-x64.exe'
export const CHECKSUM_ASSET_NAME = 'SubtitleBridge-Setup-x64.exe.sha256'

const OFFICIAL_DOWNLOAD_PREFIX = `/${OFFICIAL_REPOSITORY}/releases/download/`
const ALLOWED_UPDATE_HOSTS = new Set([
  'api.github.com',
  'github.com',
  'release-assets.githubusercontent.com',
  'objects.githubusercontent.com',
  'github-releases.githubusercontent.com'
])

export interface ReleaseCandidate {
  version: string
  tag: string
  name: string
  notes: string
  publishedAt: string | null
  installerUrl: string
  checksumUrl: string
}

interface GithubAsset {
  name?: unknown
  browser_download_url?: unknown
  size?: unknown
}

interface GithubRelease {
  tag_name?: unknown
  name?: unknown
  body?: unknown
  published_at?: unknown
  draft?: unknown
  prerelease?: unknown
  assets?: unknown
}

const STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?![\s\S])/
const STABLE_RELEASE_TAG_PATTERN = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?![\s\S])/

export function parseStableVersion(value: string): [number, number, number] | null {
  const match = STABLE_VERSION_PATTERN.exec(value)
  if (!match) {
    return null
  }

  const parts = match.slice(1).map((part) => Number.parseInt(part, 10))
  if (parts.some((part) => !Number.isSafeInteger(part) || part < 0)) {
    return null
  }

  return [parts[0], parts[1], parts[2]]
}

export function compareStableVersions(left: string, right: string): number {
  const a = parseStableVersion(left)
  const b = parseStableVersion(right)
  if (!a || !b) {
    throw new Error('Updater requires stable semantic versions.')
  }

  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) {
      return a[index] > b[index] ? 1 : -1
    }
  }

  return 0
}

export function parseLatestRelease(
  payload: unknown,
  currentVersion: string
): ReleaseCandidate | null {
  if (!payload || typeof payload !== 'object') {
    throw new Error('GitHub returned invalid release metadata.')
  }

  const release = payload as GithubRelease
  if (release.draft !== false || release.prerelease !== false) {
    return null
  }

  if (typeof release.tag_name !== 'string') {
    throw new Error('The latest release has no valid version tag.')
  }

  const tagMatch = STABLE_RELEASE_TAG_PATTERN.exec(release.tag_name)
  if (!tagMatch) {
    throw new Error('The latest release does not use a canonical stable semantic-version tag.')
  }

  const version = tagMatch.slice(1).join('.')
  const parsedVersion = parseStableVersion(version)
  if (!parsedVersion || release.tag_name !== `v${version}`) {
    throw new Error('The latest release does not use a canonical stable semantic-version tag.')
  }
  if (compareStableVersions(version, currentVersion) <= 0) {
    return null
  }

  if (!Array.isArray(release.assets)) {
    throw new Error('The latest release has no downloadable assets.')
  }

  const installer = findAsset(release.assets, SETUP_ASSET_NAME)
  const checksum = findAsset(release.assets, CHECKSUM_ASSET_NAME)
  if (!installer || !checksum) {
    throw new Error('The latest release is missing the required Windows update assets.')
  }

  const tag = release.tag_name
  const installerUrl = requireOfficialAssetUrl(installer, tag, SETUP_ASSET_NAME)
  const checksumUrl = requireOfficialAssetUrl(checksum, tag, CHECKSUM_ASSET_NAME)

  return {
    version,
    tag,
    name:
      typeof release.name === 'string' && release.name.trim()
        ? release.name.trim()
        : `Subtitle Bridge v${version}`,
    notes: typeof release.body === 'string' ? release.body.trim() : '',
    publishedAt: typeof release.published_at === 'string' ? release.published_at : null,
    installerUrl,
    checksumUrl
  }
}

export function parseInstallerChecksum(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  const match = new RegExp(
    `^([a-fA-F0-9]{64})  ${escapeRegExp(SETUP_ASSET_NAME)}$`
  ).exec(normalized)

  if (!match) {
    throw new Error('The release checksum file is invalid.')
  }

  return match[1].toLowerCase()
}

export function assertAllowedUpdateUrl(rawUrl: string): URL {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('The update source URL is invalid.')
  }

  if (url.protocol !== 'https:' || !ALLOWED_UPDATE_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('The update source is not an approved HTTPS GitHub host.')
  }

  if (url.username || url.password) {
    throw new Error('Authenticated update source URLs are not allowed.')
  }

  return url
}

function findAsset(assets: unknown[], expectedName: string): GithubAsset | null {
  const matches = assets.filter(
    (asset): asset is GithubAsset =>
      Boolean(asset) &&
      typeof asset === 'object' &&
      (asset as GithubAsset).name === expectedName
  )

  return matches.length === 1 ? matches[0] : null
}

function requireOfficialAssetUrl(asset: GithubAsset, tag: string, assetName: string): string {
  if (typeof asset.browser_download_url !== 'string') {
    throw new Error(`The ${assetName} release asset has no download URL.`)
  }

  const url = assertAllowedUpdateUrl(asset.browser_download_url)
  const expectedPath = `${OFFICIAL_DOWNLOAD_PREFIX}${tag}/${assetName}`
  if (url.hostname !== 'github.com' || url.pathname !== expectedPath || url.search || url.hash) {
    throw new Error(`The ${assetName} release asset does not point to the official repository.`)
  }

  return url.toString()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
