import type { Route } from "./+types/share-view";

import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  Layout,
  MousePointer2,
  Share2,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLoaderData, useParams } from "react-router";

import { Badge } from "~/core/components/ui/badge";
import { Button } from "~/core/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/core/components/ui/card";
import { Separator } from "~/core/components/ui/separator";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "공유된 업무 프로세스 보기" },
    {
      name: "description",
      content: "공유 토큰으로 임시 접근하여 업무 프로세스를 조회합니다",
    },
  ];
}

export async function loader({}: Route.LoaderArgs) {
  // 공개 페이지: 인증 불필요. 서버에서는 아무 것도 반환하지 않음
  return {};
}

export default function ShareView() {
  const params = useParams();
  const token = params["*"]?.split("/").pop() || params["token"]; // 라우팅 안전 처리
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  // 탭 단위 세션 ID 생성 (세션 스토리지 사용)
  const sessionId = useMemo(() => {
    const key = "work-share-session";
    let id = sessionStorage.getItem(key);
    if (!id) {
      id =
        self.crypto?.randomUUID?.() ||
        Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(key, id);
    }
    return id;
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setError("잘못된 공유 주소입니다.");
        setLoading(false);
        return;
      }
      try {
        // 1) 토큰 클레임 (세션 귀속)
        const claimRes = await fetch("/api/work/share/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, session_id: sessionId }),
        });
        if (!claimRes.ok && claimRes.status !== 409) {
          const j = await claimRes.json().catch(() => ({}));
          throw new Error(j.error || `클레임 실패(${claimRes.status})`);
        }
        // 2) 워크플로우 조회
        const res = await fetch(`/api/work/share/workflows/${token}`, {
          headers: { "x-share-session": sessionId },
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `조회 실패(${res.status})`);
        }
        const j = await res.json();
        setData(j.workflow);
        setLoading(false);
      } catch (e: any) {
        setError(e.message || "오류가 발생했습니다.");
        setLoading(false);
      }
    };
    run();
  }, [token, sessionId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
            <Sparkles className="size-6 animate-pulse text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="font-medium text-slate-600 dark:text-slate-400">
            공유된 프로세스를 불러오는 중...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <Card className="border-destructive/20 bg-destructive/5 w-full max-w-md text-center">
          <CardHeader>
            <div className="bg-destructive/10 mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
              <span className="text-2xl">⚠️</span>
            </div>
            <CardTitle className="text-destructive">공유 링크 오류</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              링크가 만료되었거나 권한이 없습니다. 소유자에게 새로운 링크를
              요청하세요.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 font-sans dark:bg-slate-950/50">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300"
              >
                <Share2 className="mr-1 size-3" />
                Shared Workflow
              </Badge>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {data?.title}
              </h1>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {data?.description || "설명이 없습니다."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => window.print()}
              variant="outline"
              size="sm"
              className="h-9 gap-2"
            >
              <span className="text-xs">PDF 저장 / 인쇄</span>
            </Button>
            <Button
              onClick={() => window.close()}
              variant="ghost"
              size="sm"
              className="h-9 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              닫기
            </Button>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="bg-white/50 backdrop-blur-sm dark:bg-slate-900/50">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <Layers className="size-5" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium">
                  총 단계
                </p>
                <p className="text-lg font-bold">{data?.steps?.length || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/50 backdrop-blur-sm dark:bg-slate-900/50">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                <Calendar className="size-5" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium">
                  생성일
                </p>
                <p className="text-sm font-bold">
                  {new Date(data?.created_at).toLocaleDateString("ko-KR")}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/50 backdrop-blur-sm dark:bg-slate-900/50">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                <Layout className="size-5" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium">
                  상태
                </p>
                <Badge
                  variant="secondary"
                  className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400"
                >
                  활성
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Steps List */}
        <Card className="overflow-hidden border-indigo-100 bg-white shadow-lg dark:border-indigo-900/30 dark:bg-slate-900">
          <CardHeader className="bg-slate-50/50 pb-4 dark:bg-slate-900/50">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MousePointer2 className="size-5 text-indigo-500" />
              프로세스 단계 상세
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {(data?.steps || []).map((step: any, index: number) => (
                <div
                  key={step.step_id}
                  className="group flex gap-4 p-6 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                >
                  {/* Step Number */}
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                    {step.sequence_no}
                  </div>

                  {/* Step Content */}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {step.type}
                        </Badge>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                          {step.action}
                        </h3>
                      </div>
                      {step.timestamp_label && (
                        <div className="text-muted-foreground flex items-center gap-1 text-xs">
                          <Clock className="size-3" />
                          <span>{step.timestamp_label}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {step.description}
                    </p>

                    {/* Screenshot if available */}
                    {step.screenshot_url && (
                      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 shadow-sm dark:border-slate-800">
                        <img
                          src={step.screenshot_url}
                          alt={`Step ${step.sequence_no} screenshot`}
                          className="aspect-video w-full object-cover transition-transform duration-500 hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-muted-foreground text-xs">
            Powered by{" "}
            <span className="text-foreground font-semibold">Synchro</span> •
            AI-Driven Business Logic Automation
          </p>
        </div>
      </div>
    </div>
  );
}
