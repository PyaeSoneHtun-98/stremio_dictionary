import { spawn, type ChildProcess } from 'node:child_process'
import type { SubtitleCue } from '../../shared/media'
import { diagnosticLog } from '../diagnostics'
import { resolveFfmpegExecutable } from '../runtimeTools'
import type { ExternalSubtitleFormat } from './externalSubtitle'
import { parseSrtCues } from './normalize'

const MAX_SUBTITLE_BYTES = 16 * 1024 * 1024
const MAX_ERROR_BYTES = 64 * 1024

export class ExternalSubtitleExtractor {
  private child: ChildProcess | null = null

  async extract(filePath: string, format: ExternalSubtitleFormat): Promise<SubtitleCue[]> {
    this.cancel()

    const runtime = resolveFfmpegExecutable()
    diagnosticLog('ffmpeg.externalSubtitleStart', { source: runtime.source, format })

    const child = spawn(
      runtime.executable,
      [
        '-v',
        'error',
        '-nostdin',
        '-i',
        filePath,
        '-map',
        '0:s:0',
        '-c:s',
        'srt',
        '-f',
        'srt',
        'pipe:1'
      ],
      {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      }
    )

    this.child = child

    return await new Promise<SubtitleCue[]>((resolve, reject) => {
      const stdout: Buffer[] = []
      let stdoutBytes = 0
      const stderr: Buffer[] = []
      let stderrBytes = 0
      let settled = false

      const finish = (callback: () => void): void => {
        if (settled) {
          return
        }
        settled = true
        if (this.child === child) {
          this.child = null
        }
        callback()
      }

      child.stdout.on('data', (chunk: Buffer) => {
        stdoutBytes += chunk.byteLength
        if (stdoutBytes > MAX_SUBTITLE_BYTES) {
          child.kill()
          diagnosticLog('ffmpeg.externalSubtitleFailed', {
            reason: 'subtitle-too-large',
            format
          })
          finish(() => reject(new Error('The subtitle file is too large to process safely.')))
          return
        }
        stdout.push(chunk)
      })

      child.stderr.on('data', (chunk: Buffer) => {
        if (stderrBytes >= MAX_ERROR_BYTES) {
          return
        }
        const remaining = MAX_ERROR_BYTES - stderrBytes
        const slice = chunk.subarray(0, remaining)
        stderr.push(slice)
        stderrBytes += slice.byteLength
      })

      child.once('error', (error) => {
        diagnosticLog('ffmpeg.externalSubtitleSpawnFailed', {
          source: runtime.source,
          format,
          code: 'code' in error ? error.code : undefined
        })
        finish(() => reject(toExtractionError(error)))
      })

      child.once('close', (code, signal) => {
        finish(() => {
          if (signal) {
            diagnosticLog('ffmpeg.externalSubtitleCancelled', { format, signal })
            reject(new Error('External subtitle loading was cancelled.'))
            return
          }

          if (code !== 0) {
            diagnosticLog('ffmpeg.externalSubtitleFailed', {
              reason: 'ffmpeg-nonzero-exit',
              format,
              code,
              hadStderr: Buffer.concat(stderr).toString('utf8').trim().length > 0
            })
            reject(new Error('FFmpeg could not read this subtitle file.'))
            return
          }

          let cues: SubtitleCue[]
          try {
            cues = parseSrtCues(Buffer.concat(stdout).toString('utf8'))
          } catch {
            diagnosticLog('ffmpeg.externalSubtitleParseFailed', {
              reason: 'subtitle-parse-error',
              format
            })
            reject(new Error('The subtitle file could not be parsed safely.'))
            return
          }

          if (cues.length === 0) {
            diagnosticLog('ffmpeg.externalSubtitleNoReadableCues', { format })
            reject(new Error('No readable text subtitle cues were found in this file.'))
            return
          }

          diagnosticLog('ffmpeg.externalSubtitleComplete', {
            format,
            cueCount: cues.length,
            outputBytes: stdoutBytes
          })
          resolve(cues)
        })
      })
    })
  }

  cancel(): void {
    const child = this.child
    this.child = null
    if (child && !child.killed) {
      child.kill()
    }
  }

  dispose(): void {
    this.cancel()
  }
}

function toExtractionError(error: Error): Error {
  if ('code' in error && error.code === 'ENOENT') {
    return new Error(
      'FFmpeg was not found. Install ffmpeg and add it to PATH, or set FFMPEG_PATH to ffmpeg.exe.'
    )
  }

  return new Error('Could not start FFmpeg. Check the configured FFmpeg executable and try again.')
}
