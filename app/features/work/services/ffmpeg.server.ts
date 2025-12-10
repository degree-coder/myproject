import { spawn } from "child_process";
// Use bundled FFmpeg binary to avoid system dependency
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

export interface ExtractOptions {
  maxFrames?: number; // 상한선 (기본 8)
}

/**
 * FFmpeg로 키프레임/샘플 프레임을 추출합니다.
 * 서버에 ffmpeg가 설치되어 있어야 합니다.
 */
export async function extractFrames(
  videoPath: string,
  { maxFrames = 8 }: ExtractOptions = {},
): Promise<{ paths: string[]; cleanup: () => Promise<void> }> {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "frames-"));
  const pattern = path.join(outDir, "frame-%03d.jpg");

  // 장면 전환 감지 + 상한 적용: scene>0.3, 8장 상한
  // 상한은 -vframes와 조합, 또는 추출 후 잘라내기
  await runFfmpeg([
    "-i",
    videoPath,
    "-vf",
    "select='gt(scene,0.3)',metadata=print",
    "-vsync",
    "vfr",
    pattern,
  ]);

  // 상한 적용
  let files = (await fs.readdir(outDir))
    .filter((f) => f.startsWith("frame-") && f.endsWith(".jpg"))
    .sort();
  if (files.length === 0) {
    // 장면 전환이 안 잡힐 경우 균등 샘플링으로 대체
    await runFfmpeg([
      "-i",
      videoPath,
      "-vf",
      "fps=1",
      path.join(outDir, "sample-%03d.jpg"),
    ]);
    files = (await fs.readdir(outDir)).sort();
  }
  if (files.length > maxFrames) files = files.slice(0, maxFrames);

  const paths = files.map((f) => path.join(outDir, f));

  return {
    paths,
    cleanup: async () => {
      try {
        await fs.rm(outDir, { recursive: true, force: true });
      } catch (err) {
        // 임시 파일 삭제 실패는 치명적이지 않으므로 경고만 출력
        console.warn("[FFmpeg] Failed to cleanup temp dir:", outDir, err);
      }
    },
  };
}

/**
 * FFprobe로 동영상의 재생 시간을 추출합니다.
 */
export async function getVideoDuration(videoPath: string): Promise<number> {
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      // ffprobe-static 경로 확인 - 여러 방식 시도
      let bin: string;
      try {
        // 방법 1: ffprobePath.path
        bin = (ffprobePath as any)?.path;
        if (!bin) {
          // 방법 2: ffprobePath 자체
          bin = ffprobePath as any;
        }
        if (!bin) {
          // 방법 3: 시스템 ffprobe
          bin = "ffprobe";
        }
      } catch (e) {
        bin = "ffprobe";
      }

      console.log(`[FFprobe] Using binary: ${bin}`);

      const p = spawn(bin, [
        "-v",
        "quiet",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        videoPath,
      ]);
      let stdout = "";
      let stderr = "";

      p.stdout.on("data", (d) => (stdout += d.toString()));
      p.stderr.on("data", (d) => (stderr += d.toString()));
      p.on("error", reject);
      p.on("close", (code) => {
        console.log(
          `[FFprobe] Exit code: ${code}, stdout: "${stdout.trim()}", stderr: "${stderr.trim()}"`,
        );
        if (code === 0) {
          const duration = parseFloat(stdout.trim());
          if (isNaN(duration)) {
            reject(new Error("Invalid duration value"));
          } else {
            resolve(duration);
          }
        } else {
          reject(new Error(`ffprobe failed (${code}): ${stderr}`));
        }
      });
    });

    console.log(`[FFprobe] Video duration extracted: ${duration}s`);
    return duration;
  } catch (error) {
    console.error("[FFprobe] Failed to extract duration:", error);
    throw error;
  }
}

async function runFfmpeg(args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const bin = (ffmpegPath as unknown as string) || "ffmpeg";
    const p = spawn(bin, ["-y", ...args]);
    let stderr = "";
    p.stderr.on("data", (d) => (stderr += d.toString()));
    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg failed (${code}): ${stderr}`));
    });
  });
}
