import { promises as fs } from "fs";
import os from "os";
import path from "path";

import adminClient from "~/core/lib/supa-admin-client.server";

/**
 * Supabase Storage에서 비디오를 임시 디렉토리로 다운로드합니다.
 * 서버 전용. 반환된 cleanup()을 호출해 파일을 제거하세요.
 */
export async function downloadVideoFromSupabase(storagePath: string) {
  if (!storagePath) throw new Error("Invalid storage path");

  const bucket = "work-videos";
  const { data, error } = await adminClient.storage
    .from(bucket)
    .download(storagePath);
  if (error) throw error;

  // data는 Blob 객체이므로 ArrayBuffer로 변환 후 Buffer로 저장
  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "video-"));
  const fileName = path.basename(storagePath).replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = path.join(tmpDir, fileName || `video_${Date.now()}.mp4`);
  await fs.writeFile(filePath, buffer);

  return {
    filePath,
    cleanup: async () => {
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch (err) {
        // 임시 파일 삭제 실패는 치명적이지 않으므로 경고만 출력
        console.warn("[Storage] Failed to cleanup temp dir:", tmpDir, err);
      }
    },
  };
}
