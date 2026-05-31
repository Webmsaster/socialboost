import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export type Aspect = "9:16" | "16:9" | "1:1";

export interface RenderScene {
  imageUrl: string;
  duration?: number; // seconds, default 5
  textOverlay?: string;
}

export interface RenderRequest {
  scenes: RenderScene[];
  voiceoverDataUrl?: string;
  aspect?: Aspect;
  brandName?: string;
}

const ASPECT_DIMENSIONS: Record<Aspect, { w: number; h: number }> = {
  "9:16": { w: 1080, h: 1920 },
  "16:9": { w: 1920, h: 1080 },
  "1:1": { w: 1080, h: 1080 },
};

const FPS = 30;
const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

// Internal DoS caps for the standalone worker.
const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024; // 10MB per fetched asset
const FFMPEG_TIMEOUT_MS = 120_000; // kill ffmpeg after 120s

function ffmpegRun(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let timedOut = false;

    // Kill runaway ffmpeg processes so a single job cannot pin the worker.
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, FFMPEG_TIMEOUT_MS);

    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`ffmpeg timed out after ${FFMPEG_TIMEOUT_MS}ms`));
      } else if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-1200)}`));
      }
    });
  });
}

async function downloadToFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download ${url} failed: ${res.status}`);

  // Fast path: reject before reading the body if Content-Length is too large.
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_DOWNLOAD_BYTES) {
    throw new Error(`Download ${url} too large: ${declared} bytes (max ${MAX_DOWNLOAD_BYTES})`);
  }

  // Stream the body and abort once the cumulative size exceeds the cap, in case
  // Content-Length is missing or lies.
  const body = res.body;
  if (!body) throw new Error(`Download ${url} failed: empty body`);

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_DOWNLOAD_BYTES) {
          await reader.cancel();
          throw new Error(`Download ${url} exceeded ${MAX_DOWNLOAD_BYTES} bytes`);
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  await writeFile(dest, Buffer.concat(chunks));
}

export async function renderVideo(req: RenderRequest): Promise<string> {
  const aspect = req.aspect ?? "9:16";
  const { w, h } = ASPECT_DIMENSIONS[aspect];

  const workDir = join(tmpdir(), `sb-render-${randomUUID()}`);
  await mkdir(workDir, { recursive: true });

  try {
    // 1. Download every scene image and the voiceover (if any).
    const sceneClipPaths: string[] = [];
    for (let i = 0; i < req.scenes.length; i++) {
      const scene = req.scenes[i];
      const duration = Math.max(2, Math.min(10, scene.duration ?? 5));
      const imgPath = join(workDir, `scene-${i}.png`);
      await downloadToFile(scene.imageUrl, imgPath);

      const clipPath = join(workDir, `clip-${i}.mp4`);

      // Ken-Burns: single-frame input + zoompan with d=totalFrames is the
      // canonical pattern. Using `-loop 1 -t N` together with zoompan d=N
      // double-counts frames (zoompan multiplies per input frame) and blows
      // the output up to minutes of video.
      const totalFrames = Math.round(duration * FPS);
      const overscan = 1.2;
      const ow = Math.round(w * overscan);
      const oh = Math.round(h * overscan);

      // Smooth linear zoom 1.0 → ~1.15 over the clip, driven by `on` (output frame counter).
      const zoomExpr = `'1+min(0.15,(on/${totalFrames})*0.18)'`;
      const filters: string[] = [
        `scale=${ow}:${oh}:force_original_aspect_ratio=increase`,
        `crop=${ow}:${oh}`,
        `zoompan=z=${zoomExpr}:d=${totalFrames}:s=${w}x${h}:fps=${FPS}`,
        `format=yuv420p`,
      ];

      if (scene.textOverlay && scene.textOverlay.trim()) {
        const txtPath = join(workDir, `text-${i}.txt`);
        await writeFile(txtPath, scene.textOverlay.trim());
        filters.push(
          `drawtext=fontfile=${FONT}:textfile=${txtPath}:fontcolor=white:fontsize=${Math.round(h / 22)}:box=1:boxcolor=black@0.55:boxborderw=24:line_spacing=8:x=(w-text_w)/2:y=h-text_h-${Math.round(h / 8)}`,
        );
      }

      const args = [
        "-y",
        "-i", imgPath,
        "-vf", filters.join(","),
        "-frames:v", String(totalFrames),
        "-r", String(FPS),
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-an",
        clipPath,
      ];
      await ffmpegRun(args);
      sceneClipPaths.push(clipPath);
    }

    // 2. Concat list file.
    const listPath = join(workDir, "concat.txt");
    const listBody = sceneClipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
    await writeFile(listPath, listBody);

    // 3. Voiceover handling.
    let voiceoverPath: string | null = null;
    if (req.voiceoverDataUrl) {
      const match = /^data:(audio\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(req.voiceoverDataUrl);
      if (match) {
        const ext = match[1].split("/")[1] || "mp3";
        voiceoverPath = join(workDir, `voiceover.${ext}`);
        await writeFile(voiceoverPath, Buffer.from(match[2], "base64"));
      } else if (req.voiceoverDataUrl.startsWith("http")) {
        voiceoverPath = join(workDir, "voiceover.mp3");
        await downloadToFile(req.voiceoverDataUrl, voiceoverPath);
      }
    }

    // 4. Final encode with optional audio.
    const outPath = join(workDir, "output.mp4");
    const finalArgs = ["-y", "-f", "concat", "-safe", "0", "-i", listPath];
    if (voiceoverPath) {
      finalArgs.push("-i", voiceoverPath, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest");
    } else {
      finalArgs.push("-c:v", "copy", "-an");
    }
    finalArgs.push("-movflags", "+faststart", outPath);
    await ffmpegRun(finalArgs);

    // Move the result out of the temp dir so the workDir can be cleaned up.
    const keepPath = join(tmpdir(), `sb-final-${randomUUID()}.mp4`);
    await import("node:fs/promises").then((fs) => fs.copyFile(outPath, keepPath));
    return keepPath;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
