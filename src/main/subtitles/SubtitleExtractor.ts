import { spawn, type ChildProcess } from 'node:child_process'
import type { SubtitleCue } from '../../shared/media'
import { diagnosticLog } from '../diagnostics'
import { resolveFfmpegExecutable } from '../runtimeTools'
import { parseSrtCues } from './normalize'

const MAX_SUBTITLE_BYTES = 16 * 1024 * 1024
const MAX_ERROR_BYTES = 64 * 1024

export class SubtitleExtractor {
  private child: ChildProcess | null = null

  async extract(filePath: string, ffIndex: number): Promise<SubtitleCue[]> {
    this.cancel()

    const runtime = resolveFfmpegExecutable()
    diagnosticLog('ffmpeg.extractStart', { source: runtime.source, ffIndex })
    const child = spawn(
      runtime.executable,
      [
        '-v',
        'error',
        '-nostdin',
        '-i',
        filePath,
        '-map',
        `0:${ffIndex}`,
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
          diagnosticLog('ffmpeg.extractFailed', { reason: 'subtitle-too-large', ffIndex })
          finish(() => reject(new Error('The subtitle track is too large to process safely.')))
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
        const extractionError = toExtractionError(error)
        diagnosticLog('ffmpeg.spawnFailed', {
          source: runtime.source,
          ffIndex,
          code: 'code' in error ? error.code : undefined
        })
        finish(() => reject(extractionError))
      })

      child.once('close', (code, signal) => {
        finish(() => {
          if (signal) {
            diagnosticLog('ffmpeg.extractCancelled', { ffIndex, signal })
            reject(new Error('Subtitle extraction was cancelled.'))
            return
          }

          if (code !== 0) {
            const detail = Buffer.concat(stderr).toString('utf8').trim()
            diagnosticLog('ffmpeg.extractFailed', {
              reason: 'ffmpeg-nonzero-exit',
              ffIndex,
              code,
              hadStderr: detail.length > 0
            })
            reject(
              new Error(
                `FFmpeg could not extract this subtitle track${code === null ? '' : ` (exit code ${code})`}.`
              )
            )
            return
          }

          let cues: SubtitleCue[]
          try {
            cues = parseSrtCues(Buffer.concat(stdout).toString('utf8'))
          } catch {
            diagnosticLog('ffmpeg.parseFailed', { reason: 'subtitle-parse-error', ffIndex })
            reject(new Error('The subtitle track could not be parsed safely.'))
            return
          }

          if (cues.length === 0) {
            diagnosticLog('ffmpeg.noReadableCues', { ffIndex })
            reject(new Error('No readable text subtitle cues were found in this track.'))
            return
          }

          diagnosticLog('ffmpeg.extractComplete', {
            ffIndex,
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
      'FFmpeg was not found. Reinstall Subtitle Bridge to restore its managed subtitle runtime, or configure FFMPEG_PATH for development.'
    )
  }

  return new Error('Could not start FFmpeg. Check the configured FFmpeg executable and try again.')
}
