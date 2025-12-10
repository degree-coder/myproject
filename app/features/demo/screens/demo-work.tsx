import type { Route } from "./+types/demo-work";

import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit,
  FileVideo,
  Layout,
  Lightbulb,
  ListChecks,
  Loader2,
  LogIn,
  Menu,
  Play,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "~/core/components/ui/alert";
import { Badge } from "~/core/components/ui/badge";
import { BorderBeam } from "~/core/components/ui/border-beam";
import { Button } from "~/core/components/ui/button";
import { Card } from "~/core/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/core/components/ui/dialog";
import { OptimizedImage } from "~/core/components/ui/optimized-image";
import { Sheet, SheetContent, SheetTrigger } from "~/core/components/ui/sheet";
import { useIsMobile } from "~/core/hooks/use-mobile";
import { WorkflowThumbnail } from "~/features/work/components/workflow-thumbnail";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "업무프로세스 데모 - 체험하기" },
    {
      name: "description",
      content: "로그인 없이 AI 업무 프로세스 분석 기능을 체험해보세요",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  // 데모 페이지는 인증 불필요 - DB에서 데모 데이터 로드
  const { getDemoWorkflows } = await import("../queries.server");
  const workflows = await getDemoWorkflows();
  return { isDemoMode: true, workflows };
}

interface VideoAnalysis {
  id: string;
  title: string;
  duration: string;
  uploadDate: string;
  status: "analyzed" | "analyzing" | "pending";
  thumbnail: string;
  steps: LogicStep[];
}

interface LogicStep {
  id: number;
  action: string;
  description: string;
  timestamp: string;
  confidence: number;
  type: "click" | "input" | "navigate" | "wait" | "decision";
  notes?: string;
}

// Helper functions
function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().split("T")[0];
}

// Demo Style Step Component (Visual Only)
function DemoStyleStep({
  step,
  index,
  isExpanded,
  onToggle,
}: {
  step: LogicStep;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  const getStepIcon = (type: LogicStep["type"]) => {
    switch (type) {
      case "click":
        return "🖱️";
      case "input":
        return "⌨️";
      case "navigate":
        return "🧭";
      case "wait":
        return "⏱️";
      case "decision":
        return "🔀";
      default:
        return "📝";
    }
  };

  const getStepColor = (type: LogicStep["type"]) => {
    switch (type) {
      case "click":
        return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900";
      case "input":
        return "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900";
      case "navigate":
        return "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900";
      case "wait":
        return "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-900";
      case "decision":
        return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      layout
    >
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={onToggle}
        className={`group relative cursor-pointer overflow-hidden rounded-xl border transition-all duration-300 ${
          isExpanded
            ? "border-indigo-500/50 bg-indigo-50/50 shadow-xl shadow-indigo-500/10 dark:border-indigo-400/50 dark:bg-indigo-950/20"
            : "border-white/20 bg-white/40 hover:border-indigo-300/50 hover:bg-white/60 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
        } backdrop-blur-sm`}
      >
        <div className="p-4">
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-700 shadow-sm transition-colors dark:bg-slate-800 dark:text-slate-300">
              {index + 1}
            </div>

            <div className="flex-1">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{getStepIcon(step.type)}</span>
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                    {step.action}
                  </h4>
                </div>
                <button className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
                  {isExpanded ? (
                    <ChevronDown className="size-5" />
                  ) : (
                    <ChevronRight className="size-5" />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={`${getStepColor(step.type)} border-0`}
                >
                  {step.type === "click" && "클릭"}
                  {step.type === "input" && "입력"}
                  {step.type === "navigate" && "이동"}
                  {step.type === "wait" && "대기"}
                  {step.type === "decision" && "판단"}
                </Badge>
                <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <Clock className="size-3" />
                  {step.timestamp}
                </span>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-4 space-y-4 overflow-hidden"
                  >
                    <div className="rounded-lg bg-slate-50/50 p-3 dark:bg-slate-900/50">
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {step.description}
                      </p>
                    </div>

                    {step.notes && (
                      <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 dark:border-indigo-900/30 dark:bg-indigo-950/20">
                        <div className="mb-2 flex items-center gap-2">
                          <Lightbulb className="size-4 text-indigo-600 dark:text-indigo-400" />
                          <span className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
                            추가 설명
                          </span>
                        </div>
                        <p className="text-sm text-indigo-700 dark:text-indigo-300">
                          {step.notes}
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function DemoWork({ loaderData }: Route.ComponentProps) {
  const { isDemoMode, workflows: dbWorkflows } = loaderData;
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // DB 데이터를 VideoAnalysis 형식으로 변환
  const mockVideos: VideoAnalysis[] = dbWorkflows.map((workflow: any) => ({
    id: workflow.workflow_id.toString(),
    title: workflow.title,
    duration: formatDuration(workflow.duration_seconds),
    uploadDate: formatDate(workflow.created_at),
    status: workflow.status as "analyzed" | "analyzing" | "pending",
    thumbnail:
      workflow.thumbnail_url &&
      workflow.thumbnail_url !== "/placeholder-video.jpg"
        ? workflow.thumbnail_url
        : null,
    steps: (workflow.steps || [])
      .sort((a: any, b: any) => a.sequence_no - b.sequence_no)
      .map((step: any) => ({
        id: step.step_id,
        action: step.action,
        description: step.description,
        timestamp: step.timestamp_label || "00:00",
        confidence: step.confidence || 0,
        type: step.type as "click" | "input" | "navigate" | "wait" | "decision",
        notes: step.notes || undefined,
      })),
  }));

  const [selectedVideo, setSelectedVideo] = useState<VideoAnalysis | null>(
    mockVideos[0] || null,
  );
  const [expandedSteps, setExpandedSteps] = useState<number[]>([]);
  const [showDemoBanner, setShowDemoBanner] = useState(true);

  const toggleStep = (stepId: number) => {
    setExpandedSteps((prev) =>
      prev.includes(stepId)
        ? prev.filter((id) => id !== stepId)
        : [...prev, stepId],
    );
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="p-6">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Bot className="size-5" />
          </div>
          <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Demo 업무 프로세스
          </span>
        </div>
        <Link to="/login">
          <Button className="w-full bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400">
            <Plus className="mr-2 size-4" />
            업로드 (로그인)
          </Button>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="space-y-2">
          {mockVideos.map((video) => (
            <div
              key={video.id}
              onClick={() => {
                setSelectedVideo(video);
                if (isMobile) setIsMobileSidebarOpen(false);
              }}
              className={`group relative cursor-pointer rounded-xl border p-3 transition-all duration-200 ${
                selectedVideo?.id === video.id
                  ? "border-indigo-500 bg-indigo-50/50 shadow-md dark:border-indigo-400 dark:bg-indigo-950/30"
                  : "border-transparent hover:border-slate-200 hover:bg-white/50 dark:hover:border-slate-700 dark:hover:bg-slate-800/50"
              }`}
            >
              <div className="flex gap-3">
                <WorkflowThumbnail
                  src={video.thumbnail}
                  alt={video.title}
                  size="sm"
                  duration={video.duration}
                  className="shrink-0 transition-transform duration-300 group-hover:scale-105"
                />
                <div className="min-w-0 flex-1">
                  <h4
                    className={`truncate text-sm font-medium ${
                      selectedVideo?.id === video.id
                        ? "text-indigo-900 dark:text-indigo-100"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {video.title}
                  </h4>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {video.uploadDate}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={`h-5 px-1.5 text-[10px] ${
                        video.status === "analyzed"
                          ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300"
                      }`}
                    >
                      {video.status === "analyzed" ? "완료" : "분석중"}
                    </Badge>
                    <span className="text-xs text-slate-400">
                      {video.steps.length} steps
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full bg-slate-50/50 dark:bg-slate-950/50">
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Desktop Sidebar */}
        <div className="hidden w-80 shrink-0 border-r border-slate-200 bg-white/40 backdrop-blur-xl lg:block dark:border-slate-800 dark:bg-slate-900/40">
          <SidebarContent />
        </div>

        {/* Mobile Header & Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Mobile Header */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-white/40 px-4 py-3 backdrop-blur-xl lg:hidden dark:border-slate-800 dark:bg-slate-900/40">
            <Sheet
              open={isMobileSidebarOpen}
              onOpenChange={setIsMobileSidebarOpen}
            >
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0">
                <SidebarContent />
              </SheetContent>
            </Sheet>
            <span className="font-semibold">Demo Workflows</span>
            <div className="w-9" /> {/* Spacer */}
          </div>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-4 lg:p-8">
            <div className="mx-auto max-w-4xl">
              {/* Demo Banner */}
              {showDemoBanner && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6"
                >
                  <Alert className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 dark:border-blue-900 dark:from-blue-950 dark:to-indigo-950">
                    <Sparkles className="size-5 text-blue-600 dark:text-blue-400" />
                    <AlertTitle className="text-lg font-bold text-blue-900 dark:text-blue-100">
                      🎉 체험 모드로 둘러보는 중입니다
                    </AlertTitle>
                    <AlertDescription className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-blue-800 dark:text-blue-200">
                        실제로 동영상을 업로드하고 AI 분석을 받으려면
                        로그인하세요. 무료로 시작할 수 있습니다!
                      </p>
                      <div className="flex gap-2">
                        <Link to="/login">
                          <Button size="sm" className="gap-2">
                            <LogIn className="size-4" />
                            로그인하기
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowDemoBanner(false)}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )}

              {selectedVideo ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-6"
                >
                  {/* Header Card */}
                  <div className="rounded-2xl border border-white/20 bg-white/40 p-6 shadow-xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/40">
                    <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                      <div className="flex gap-4">
                        <div className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-slate-900 shadow-lg">
                          {selectedVideo.thumbnail ? (
                            <OptimizedImage
                              src={selectedVideo.thumbnail}
                              alt={selectedVideo.title}
                              width={96}
                              height={96}
                              priority
                              className="h-full w-full"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-slate-100 dark:bg-slate-800">
                              <div className="rounded-full bg-white/80 p-3 shadow-sm dark:bg-slate-700/80">
                                <Play className="size-6 fill-slate-900 text-slate-900 dark:fill-slate-100 dark:text-slate-100" />
                              </div>
                            </div>
                          )}
                        </div>
                        <div>
                          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            {selectedVideo.title}
                          </h1>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                              <Clock className="size-4" />
                              {selectedVideo.duration}
                            </span>
                            <span className="flex items-center gap-1">
                              <Layout className="size-4" />
                              {selectedVideo.steps.length} steps
                            </span>
                            <span className="flex items-center gap-1">
                              <Sparkles className="size-4" />
                              AI Confidence: 98%
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          disabled
                          className="border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500"
                        >
                          <Play className="mr-2 size-4" />
                          영상 보기 (로그인)
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Steps List */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                      <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                        <ListChecks className="size-5 text-indigo-600 dark:text-indigo-400" />
                        추출된 업무 로직
                      </h3>
                    </div>

                    <div className="space-y-3 pb-20">
                      {selectedVideo.steps.map((step, index) => (
                        <DemoStyleStep
                          key={step.id}
                          step={step}
                          index={index}
                          isExpanded={expandedSteps.includes(step.id)}
                          onToggle={() => toggleStep(step.id)}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="flex h-[60vh] flex-col items-center justify-center text-center">
                  <div className="mb-4 rounded-full bg-slate-100 p-6 dark:bg-slate-800">
                    <Bot className="size-12 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    선택된 데모가 없습니다
                  </h3>
                  <p className="mt-2 text-slate-500 dark:text-slate-400">
                    왼쪽 목록에서 예시를 선택하세요.
                  </p>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
