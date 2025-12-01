import type { ActionFunctionArgs } from "react-router";

import { data } from "react-router";

import adminClient from "~/core/lib/supa-admin-client.server";
import makeServerClient from "~/core/lib/supa-client.server";

export async function action({ request }: ActionFunctionArgs) {
  const [client] = makeServerClient(request);
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return data({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const filename = formData.get("filename") as string;
    const fileType = formData.get("fileType") as string;

    if (!filename || !fileType) {
      return data(
        { error: "Filename and fileType are required" },
        { status: 400 },
      );
    }

    // 파일 확장자 추출 및 안전한 파일명 생성
    const fileExt = filename.split(".").pop() || "bin";
    const safeFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const path = `${user.id}/${safeFileName}`;

    // Signed Upload URL 생성 (유효기간 1시간)
    const { data: signedUrlData, error: signedUrlError } =
      await adminClient.storage.from("work-videos").createSignedUploadUrl(path);

    if (signedUrlError) {
      console.error("Signed URL error:", signedUrlError);
      return data({ error: signedUrlError.message }, { status: 500 });
    }

    return data({
      signedUrl: signedUrlData.signedUrl,
      path: signedUrlData.path,
      token: signedUrlData.token,
    });
  } catch (error: any) {
    console.error("Upload URL error:", error);
    return data(
      { error: error.message || "Failed to generate upload URL" },
      { status: 500 },
    );
  }
}
