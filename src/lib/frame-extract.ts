/**
 * Server-side frame extraction from video using ffmpeg (fluent-ffmpeg).
 * Requires ffmpeg binary installed on the system and in PATH.
 */

import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface ExtractFrameResult {
  imageDataUrl: string;
  timestamp_seconds: number;
}

export interface ExtractFrameOptions {
  videoUrl: string;
  timestamp_seconds: number;
}

/**
 * Returns a promise that resolves if ffmpeg is available, rejects with a clear message otherwise.
 */
export function checkFfmpegAvailable(): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg.getAvailableFormats((err) => {
      if (err) {
        const msg = err.message || String(err);
        if (msg.includes('ENOENT') || msg.includes('Cannot find ffmpeg') || msg.includes('ffmpeg')) {
          reject(new Error('ffmpeg not found. Install ffmpeg and ensure it is in your PATH (e.g. winget install ffmpeg on Windows, brew install ffmpeg on macOS).'));
        } else {
          reject(err);
        }
      } else {
        resolve();
      }
    });
  });
}

/**
 * Extracts a single frame from a video URL at the given timestamp.
 * Returns a data URL (base64 JPEG) or throws on error.
 */
export function extractFrameAtTimestamp(options: ExtractFrameOptions): Promise<ExtractFrameResult> {
  const { videoUrl, timestamp_seconds } = options;

  return new Promise((resolve, reject) => {
    const tempDir = os.tmpdir();
    const outputPath = path.join(tempDir, `frame-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);

    const cmd = ffmpeg(videoUrl)
      .seekInput(timestamp_seconds)
      .outputOptions(['-vframes 1', '-f image2'])
      .output(outputPath);

    cmd
      .on('end', () => {
        try {
          const buffer = fs.readFileSync(outputPath);
          const base64 = buffer.toString('base64');
          const imageDataUrl = `data:image/jpeg;base64,${base64}`;
          fs.unlinkSync(outputPath);
          resolve({ imageDataUrl, timestamp_seconds });
        } catch (err) {
          if (fs.existsSync(outputPath)) {
            try {
              fs.unlinkSync(outputPath);
            } catch {
              // ignore
            }
          }
          reject(err);
        }
      })
      .on('error', (err: Error) => {
        if (fs.existsSync(outputPath)) {
          try {
            fs.unlinkSync(outputPath);
          } catch {
            // ignore
          }
        }
        const msg = err?.message ?? String(err);
        if (msg.includes('ENOENT') || /Cannot find ffmpeg/i.test(msg)) {
          reject(new Error('ffmpeg not found. Install ffmpeg and ensure it is in your PATH (e.g. winget install ffmpeg on Windows, brew install ffmpeg on macOS).'));
        } else {
          reject(err);
        }
      })
      .run();
  });
}
