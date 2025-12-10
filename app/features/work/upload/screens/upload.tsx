import type { Route } from "./+types/upload";

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Film,
  Loader2,
  Sparkles,
  Upload as UploadIcon,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useLoaderData, useRevalidator, useSearchParams } from "react-router";

import { Button } from "~/core/components/ui/button";
import { Progress } from "~/core/components/ui/progress";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "동영상 업로드 - AI 처리" },
    { name: "description", content: "동영상을 업로드하고 AI로 처리합니다" },
  ];
}

type UploadStatus =
  | "idle"
  | "uploading"
  | "processing"
  | "completed"
  | "error"
  | "rate_limited";

interface VideoFile {
  file: File;
  preview: string;
  status: UploadStatus;
  progress: number;
  error?: string;
  duration_seconds?: number;
  resetTime?: string;
  resultUrl?: string;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { default: makeServerClient } = await import(
    "~/core/lib/supa-client.server"
  );
  const [supabase] = makeServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { user: null, rateLimitStatus: null };
  }

  // Rate Limit 상태 체크
  try {
    const { checkVideoAnalysisRateLimitStatus } = await import(
      "~/features/work/rate-limiting/rate-limit.guard"
    );
    const rateLimitStatus = await checkVideoAnalysisRateLimitStatus(supabase);
    return { user, rateLimitStatus };
  } catch (error) {
    console.error("Rate limit check failed:", error);
    return { user, rateLimitStatus: null };
  }
}

export default function Upload() {
  const { user, rateLimitStatus } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [searchParams] = useSearchParams();
  const teamId = searchParams.get("teamId");
  const [videoFile, setVideoFile] = useState<VideoFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Rate Limit 상태 확인
  const isRateLimited = rateLimitStatus?.isLimitExceeded === true;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const videoFile = files.find((file) => file.type.startsWith("video/"));

    if (videoFile) {
      processFile(videoFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      processFile(files[0]);
    }
  };

  const processFile = (file: File) => {
    // 파일 크기 검증 (50MB 제한)
    const maxSize = 50 * 1024 * 1024; // 50MB in bytes
    if (file.size > maxSize) {
      alert(
        `파일 크기가 50MB를 초과했습니다. 현재 파일 크기: ${(file.size / (1024 * 1024)).toFixed(2)}MB`,
      );
      return;
    }

    // 파일 타입 검증
    if (!file.type.startsWith("video/")) {
      alert("동영상 파일만 업로드할 수 있습니다.");
      return;
    }

    const preview = URL.createObjectURL(file);

    // Extract video duration
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = preview;

    video.onloadedmetadata = () => {
      const duration = Math.round(video.duration);
      setVideoFile({
        file,
        preview,
        status: "idle",
        progress: 0,
        duration_seconds: duration,
      });
    };

    video.onerror = () => {
      // If duration extraction fails, proceed without it
      setVideoFile({
        file,
        preview,
        status: "idle",
        progress: 0,
      });
    };
  };

  const handleUpload = async () => {
    if (!videoFile || !user) return;
    try {
      // 1) Signed URL 발급 요청
      setVideoFile({ ...videoFile, status: "uploading", progress: 0 });

      const urlFormData = new FormData();
      urlFormData.append("filename", videoFile.file.name);
      urlFormData.append("fileType", videoFile.file.type);

      const urlRes = await fetch("/api/work/upload-url", {
        method: "POST",
        body: urlFormData,
      });

      if (!urlRes.ok) {
        const j = await urlRes.json().catch(() => ({}));
        throw new Error(j.error || `업로드 URL 생성 실패(${urlRes.status})`);
      }

      const { signedUrl, path, token } = await urlRes.json();

      // 2) Supabase Storage로 직접 업로드
      const { supabaseBrowser } = await import("~/core/lib/supa-client.client");

      const { data: uploadData, error: uploadError } =
        await supabaseBrowser.storage
          .from("work-videos")
          .uploadToSignedUrl(path, token, videoFile.file);

      if (uploadError) {
        throw new Error(uploadError.message || "Storage 업로드 실패");
      }

      // 3) 비디오 레코드 생성
      const createRes = await fetch("/api/work/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: videoFile.file.name.replace(/\.[^/.]+$/, ""),
          original_filename: videoFile.file.name,
          mime_type: videoFile.file.type,
          file_size: videoFile.file.size,
          storage_path: path,
          duration_seconds: videoFile.duration_seconds || null,
        }),
      });
      if (!createRes.ok) {
        const j = await createRes.json().catch(() => ({}));
        throw new Error(j.error || `비디오 생성 실패(${createRes.status})`);
      }
      const { video_id } = await createRes.json();

      // 4) 분석 시작
      setVideoFile((prev) =>
        prev ? { ...prev, status: "processing", progress: 0 } : null,
      );
      const analyzeBody: any = { video_id };
      if (teamId) {
        analyzeBody.team_id = teamId;
      }

      const analyzeRes = await fetch("/api/work/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analyzeBody),
      });
      if (!analyzeRes.ok) {
        const j = await analyzeRes.json().catch(() => ({}));

        // Rate Limit 에러 처리 (429)
        if (analyzeRes.status === 429) {
          const rateLimitError = new Error(
            j.error || "일일 분석 요청 한도를 초과했습니다",
          );
          setVideoFile((prev) =>
            prev
              ? {
                  ...prev,
                  status: "rate_limited",
                  error: rateLimitError.message,
                  resetTime: j.resetTime,
                }
              : null,
          );
          return; // 여기서 처리 중단
        }

        throw new Error(j.error || `분석 시작 실패(${analyzeRes.status})`);
      }
      const { workflow_id } = await analyzeRes.json();

      // 워크플로우 ID 저장 (취소 시 사용)
      setVideoFile((prev) =>
        prev ? { ...prev, workflowId: workflow_id } : null,
      );

      // 5) 진행 상황 폴링
      await pollAnalysisProgress(workflow_id);

      // 6) 결과 URL 생성 및 완료 상태 업데이트 (자동 이동 없음)
      const resultUrl = teamId
        ? `/work/business-logic?workflow=${workflow_id}&teamId=${teamId}`
        : `/work/business-logic?workflow=${workflow_id}`;

      setVideoFile((prev) =>
        prev
          ? { ...prev, status: "completed", progress: 100, resultUrl }
          : null,
      );
    } catch (error: any) {
      console.error("Upload error:", error);
      setVideoFile((prev) =>
        prev
          ? {
              ...prev,
              status: "error",
              error: error?.message || "업로드 중 오류가 발생했습니다",
            }
          : null,
      );
    }
  };

  async function pollAnalysisProgress(workflowId: number) {
    return new Promise<void>((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/work/workflows/${workflowId}/status`);
          if (!res.ok) throw new Error(`상태 조회 실패(${res.status})`);
          const { status, progress } = await res.json();
          setVideoFile((prev) =>
            prev
              ? {
                  ...prev,
                  progress,
                  status: status === "analyzed" ? "completed" : "processing",
                }
              : null,
          );
          if (status === "analyzed") {
            clearInterval(interval);
            resolve();
          }
        } catch (e) {
          clearInterval(interval);
          reject(e);
        }
      }, 2000);
    });
  }

  const handleRemove = () => {
    if (videoFile) {
      URL.revokeObjectURL(videoFile.preview);
    }
    setVideoFile(null);
    revalidator.revalidate();
  };

  return (
    <div className="flex w-full flex-col bg-slate-50/50 p-6 dark:bg-slate-950/50">
      <div className="container mx-auto max-w-5xl">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center"
        >
          <div className="mb-4 inline-flex items-center justify-center rounded-full bg-indigo-100 p-3 dark:bg-indigo-900/30">
            <Sparkles className="size-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h1 className="text-foreground mb-3 text-4xl font-bold tracking-tight">
            AI Video Analysis
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            동영상을 업로드하면 AI가 업무 프로세스를 자동으로 분석합니다.
            <br className="hidden sm:block" />
            빠르고 정확한 자동화 분석을 경험해보세요.
          </p>
        </motion.div>

        {/* Rate Limit Warning */}
        <AnimatePresence>
          {isRateLimited && rateLimitStatus && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 overflow-hidden"
            >
              <div className="rounded-2xl border border-orange-200/50 bg-orange-50/50 p-6 backdrop-blur-sm dark:border-orange-900/50 dark:bg-orange-950/30">
                <div className="flex items-start gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/50">
                    <AlertCircle className="size-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-orange-900 dark:text-orange-100">
                      일일 사용량 초과 (Daily Limit Reached)
                    </h4>
                    <p className="mt-1 text-orange-700 dark:text-orange-300">
                      오늘의 무료 분석 횟수를 모두 사용했습니다. 내일 다시
                      시도해주세요.
                      {rateLimitStatus.resetTime && (
                        <span className="mt-2 block font-medium">
                          초기화 시간:{" "}
                          {new Date(rateLimitStatus.resetTime).toLocaleString(
                            "ko-KR",
                            {
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <div className="grid gap-8 lg:grid-cols-1">
          <AnimatePresence mode="wait">
            {!videoFile ? (
              <motion.div
                key="upload-zone"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <div
                  onDragOver={isRateLimited ? undefined : handleDragOver}
                  onDragLeave={isRateLimited ? undefined : handleDragLeave}
                  onDrop={isRateLimited ? undefined : handleDrop}
                  className={`group relative overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-500 ${
                    isRateLimited
                      ? "border-muted bg-muted/50 cursor-not-allowed"
                      : isDragging
                        ? "scale-[1.02] border-indigo-500 bg-indigo-50/50 shadow-2xl shadow-indigo-500/10 dark:border-indigo-400 dark:bg-indigo-950/20"
                        : "border-border/50 bg-background/50 hover:border-indigo-400 hover:bg-slate-50/80 dark:hover:border-indigo-500/50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex min-h-[400px] flex-col items-center justify-center p-12 text-center">
                    <div className="relative mb-8">
                      <div
                        className={`absolute inset-0 animate-ping rounded-full bg-indigo-400/20 duration-1000 ${isDragging ? "opacity-100" : "opacity-0"}`}
                      />
                      <div
                        className={`flex size-24 items-center justify-center rounded-full transition-all duration-300 ${
                          isDragging
                            ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300"
                            : "bg-muted text-muted-foreground group-hover:bg-indigo-50 group-hover:text-indigo-500 dark:group-hover:bg-indigo-900/30 dark:group-hover:text-indigo-400"
                        }`}
                      >
                        <UploadIcon className="size-10" />
                      </div>
                    </div>

                    <h3 className="text-foreground mb-3 text-2xl font-bold">
                      {isRateLimited
                        ? "사용량 초과"
                        : "동영상 파일을 올려주세요"}
                    </h3>
                    <p className="text-muted-foreground mb-8 max-w-md">
                      {isRateLimited
                        ? "오늘 사용 가능한 분석 횟수를 모두 소진했습니다."
                        : "MP4, MOV, AVI, WebM 지원. 최대 파일 크기 50MB."}
                    </p>

                    {!isRateLimited && (
                      <div className="flex flex-col items-center gap-4">
                        <label htmlFor="file-upload" className="relative z-10">
                          <Button
                            size="lg"
                            className="h-12 rounded-full bg-indigo-600 px-8 text-base font-medium hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                            asChild
                          >
                            <span className="cursor-pointer">
                              파일 선택 (Select File)
                            </span>
                          </Button>
                          <input
                            id="file-upload"
                            type="file"
                            accept="video/*"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                        </label>
                        {rateLimitStatus && (
                          <p className="text-muted-foreground text-xs font-medium">
                            오늘 사용량: {rateLimitStatus.currentCount}/
                            {rateLimitStatus.maxDailyRequests}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="processing-zone"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="overflow-hidden rounded-3xl border border-white/20 bg-white/40 shadow-xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/40"
              >
                <div className="grid gap-0 lg:grid-cols-2">
                  {/* Left: Video Preview */}
                  <div className="relative flex flex-col justify-center bg-slate-900 p-8 lg:p-12">
                    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
                      <video
                        src={videoFile.preview}
                        className="size-full object-contain"
                        controls={false}
                        muted
                      />
                      {/* Overlay Gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />

                      {/* File Info Overlay */}
                      <div className="absolute bottom-0 left-0 w-full p-6">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-lg bg-white/10 backdrop-blur-md">
                            <Film className="size-5 text-white" />
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <h3 className="truncate text-lg font-medium text-white">
                              {videoFile.file.name}
                            </h3>
                            <p className="text-sm text-slate-300">
                              {(videoFile.file.size / (1024 * 1024)).toFixed(2)}{" "}
                              MB
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Controls & Progress */}
                  <div className="flex flex-col p-8 lg:p-12">
                    <div className="mb-8 flex items-center justify-between">
                      <h2 className="text-foreground text-2xl font-bold">
                        처리 상태 (Processing Status)
                      </h2>
                      {videoFile.status !== "uploading" &&
                        videoFile.status !== "processing" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleRemove}
                            className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <X className="size-5" />
                          </Button>
                        )}
                    </div>

                    <div className="flex-1">
                      <div className="space-y-8">
                        {/* Status Steps */}
                        <div className="space-y-6">
                          <StatusStep
                            status={videoFile.status}
                            step="uploading"
                            label="동영상 업로드"
                            description="서버로 파일을 안전하게 전송합니다"
                            active={videoFile.status === "uploading"}
                            completed={["processing", "completed"].includes(
                              videoFile.status,
                            )}
                          />
                          <StatusStep
                            status={videoFile.status}
                            step="processing"
                            label="AI 심층 분석"
                            description="객체 인식 및 워크플로우 분석 중"
                            active={videoFile.status === "processing"}
                            completed={videoFile.status === "completed"}
                          />
                          <StatusStep
                            status={videoFile.status}
                            step="completed"
                            label="결과 생성 완료"
                            description="분석이 완료되었습니다"
                            active={false}
                            completed={videoFile.status === "completed"}
                          />
                        </div>

                        {/* Progress Bar */}
                        {(videoFile.status === "uploading" ||
                          videoFile.status === "processing") && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm font-medium">
                              <span className="text-indigo-600 dark:text-indigo-400">
                                {videoFile.status === "uploading"
                                  ? "업로드 중..."
                                  : "분석 중..."}
                              </span>
                              <span className="text-muted-foreground">
                                {videoFile.progress}%
                              </span>
                            </div>
                            <Progress
                              value={videoFile.progress}
                              className="h-2 bg-slate-100 dark:bg-slate-800"
                            />
                          </div>
                        )}

                        {/* Error Message */}
                        {videoFile.status === "error" && (
                          <div className="border-destructive/20 bg-destructive/5 text-destructive rounded-xl border p-4">
                            <div className="flex items-center gap-2 font-medium">
                              <AlertCircle className="size-4" />
                              업로드 실패
                            </div>
                            <p className="mt-1 text-sm opacity-90">
                              {videoFile.error}
                            </p>
                          </div>
                        )}

                        {/* Rate Limit Message */}
                        {videoFile.status === "rate_limited" && (
                          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-400">
                            <div className="flex items-center gap-2 font-medium">
                              <AlertCircle className="size-4" />
                              사용량 초과
                            </div>
                            <p className="mt-1 text-sm opacity-90">
                              {videoFile.error}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="border-border/50 mt-8 border-t pt-8">
                      {videoFile.status === "idle" && (
                        <div className="flex gap-3">
                          <Button
                            onClick={handleUpload}
                            size="lg"
                            className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                          >
                            분석 시작 (Start Analysis)
                            <ArrowRight className="ml-2 size-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="lg"
                            onClick={handleRemove}
                            className="border-border hover:bg-muted rounded-xl"
                          >
                            취소
                          </Button>
                        </div>
                      )}

                      {videoFile.status === "completed" && (
                        <Button
                          size="lg"
                          onClick={() => {
                            if (videoFile.resultUrl) {
                              window.location.href = videoFile.resultUrl;
                            }
                          }}
                          className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                        >
                          결과 확인하기 (View Results)
                          <ArrowRight className="ml-2 size-4" />
                        </Button>
                      )}

                      {(videoFile.status === "error" ||
                        videoFile.status === "rate_limited") && (
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={handleRemove}
                          className="w-full rounded-xl"
                        >
                          다른 파일 업로드
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function StatusStep({
  status,
  step,
  label,
  description,
  active,
  completed,
}: {
  status: UploadStatus;
  step: string;
  label: string;
  description: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <div className="flex gap-4">
      <div className="relative flex flex-col items-center">
        <div
          className={`flex size-8 items-center justify-center rounded-full border-2 transition-colors duration-300 ${
            completed
              ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500"
              : active
                ? "border-indigo-600 bg-white text-indigo-600 dark:border-indigo-500 dark:bg-slate-900 dark:text-indigo-500"
                : "border-muted bg-muted text-muted-foreground"
          }`}
        >
          {completed ? (
            <CheckCircle2 className="size-5" />
          ) : active ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <div className="size-2 rounded-full bg-current" />
          )}
        </div>
        {step !== "completed" && (
          <div
            className={`my-2 h-full w-0.5 ${
              completed ? "bg-indigo-600 dark:bg-indigo-500" : "bg-border"
            }`}
          />
        )}
      </div>
      <div
        className={`pb-6 ${active || completed ? "opacity-100" : "opacity-50"}`}
      >
        <h4 className="text-foreground font-semibold">{label}</h4>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
    </div>
  );
}
