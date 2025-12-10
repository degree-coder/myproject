import type { DragEndEvent } from "@dnd-kit/core";

import type { Route } from "./+types/business-logic";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit,
  Edit3,
  FileText,
  FileVideo,
  GripVertical,
  Image as ImageIcon,
  Layout,
  Lightbulb,
  List,
  ListChecks,
  Loader2,
  Maximize,
  Menu,
  Pause,
  Play,
  Plus,
  Save,
  Settings,
  Sparkles,
  Trash2,
  Users,
  Volume2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  data,
  useFetcher,
  useNavigate,
  useRevalidator,
  useSearchParams,
} from "react-router";
import { toast } from "sonner";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "~/core/components/ui/alert";
import { Badge } from "~/core/components/ui/badge";
import { Button } from "~/core/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/core/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/core/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/core/components/ui/dropdown-menu";
import { Input } from "~/core/components/ui/input";
import { Label } from "~/core/components/ui/label";
import { OptimizedImage } from "~/core/components/ui/optimized-image";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/core/components/ui/sheet";
import { Textarea } from "~/core/components/ui/textarea";
import { useIsMobile } from "~/core/hooks/use-mobile";
import { WorkflowThumbnail } from "~/features/work/components/workflow-thumbnail";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "업무프로세스 " },
    {
      name: "description",
      content: "동영상을 AI로 분석하여 업무 프로세스 자동 생성",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const [{ default: makeServerClient }, { getUserWorkflows }] =
      await Promise.all([
        import("~/core/lib/supa-client.server"),
        import("../queries.server"),
      ]);
    const [client] = makeServerClient(request);
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const workflows = await getUserWorkflows(user.id);

    // 메모 작성자 프로필 조회 (실패해도 워크플로우는 정상 반환)
    let authorProfiles: Record<string, string> = {};
    try {
      const authorIds = new Set<string>();
      workflows.forEach((workflow: any) => {
        workflow.steps?.forEach((step: any) => {
          if (step.notes_author_id) {
            authorIds.add(step.notes_author_id);
          }
        });
      });

      if (authorIds.size > 0) {
        const { default: adminClient } = await import(
          "~/core/lib/supa-admin-client.server"
        );
        const { data: profiles } = await adminClient
          .from("profiles")
          .select("profile_id, name")
          .in("profile_id", Array.from(authorIds));

        if (profiles) {
          authorProfiles = profiles.reduce(
            (acc: Record<string, string>, p: any) => {
              acc[p.profile_id] = p.name;
              return acc;
            },
            {},
          );
        }
      }
    } catch (profileError) {
      console.warn("[Loader] Failed to fetch author profiles:", profileError);
      // 프로필 조회 실패해도 워크플로우는 정상 반환
    }

    return { workflows, authorProfiles };
  } catch (error: any) {
    // Handle Supabase rate limit error specifically
    if (error?.status === 429 || error?.code === "over_request_rate_limit") {
      console.warn(
        "Supabase rate limit reached, using cached data if available",
      );
      // Return empty workflows instead of redirecting to login
      return { workflows: [], authorProfiles: {}, rateLimitWarning: true };
    }

    // For other auth errors, still redirect to login
    if (error?.status === 401) {
      throw new Response("Unauthorized", { status: 401 });
    }

    // For other errors, return empty data
    console.error("Loader error:", error);
    return { workflows: [], authorProfiles: {}, error: true };
  }
}

// 메모 저장 및 스텝 편집 action
export async function action({ request }: Route.ActionArgs) {
  const { default: makeServerClient } = await import(
    "~/core/lib/supa-client.server"
  );
  const [client, headers] = makeServerClient(request);
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return data({ error: "Unauthorized" }, { status: 401, headers });
  }

  try {
    const formData = await request.formData();
    const actionType = formData.get("actionType") as string;

    if (actionType === "updateNotes") {
      const stepId = parseInt(formData.get("stepId") as string);
      const notes = formData.get("notes") as string;

      if (isNaN(stepId)) {
        return data({ error: "Invalid step ID" }, { status: 400, headers });
      }

      // DB 업데이트 (작성자 ID 포함)
      const { updateStepNotes } = await import("../queries.server");
      await updateStepNotes(stepId, notes || "", user.id);

      return data(
        { success: true, message: "메모가 저장되었습니다" },
        { headers },
      );
    } else if (actionType === "updateStep") {
      const stepId = parseInt(formData.get("stepId") as string);
      const action = formData.get("action") as string;
      const description = formData.get("description") as string;

      if (isNaN(stepId)) {
        return data({ error: "Invalid step ID" }, { status: 400, headers });
      }

      // DB 업데이트
      const { updateStepDetails } = await import("../queries.server");
      await updateStepDetails(stepId, action, description);

      return data(
        { success: true, message: "스텝이 수정되었습니다" },
        { headers },
      );
    } else if (actionType === "deleteStep") {
      const stepId = parseInt(formData.get("stepId") as string);

      if (isNaN(stepId)) {
        return data({ error: "Invalid step ID" }, { status: 400, headers });
      }

      // DB 삭제
      const { deleteStep } = await import("../queries.server");
      await deleteStep(stepId);

      return data(
        { success: true, message: "스텝이 삭제되었습니다" },
        { headers },
      );
    } else if (actionType === "updateStepType") {
      const stepId = parseInt(formData.get("stepId") as string);
      const type = formData.get("type") as string;

      if (isNaN(stepId)) {
        return data({ error: "Invalid step ID" }, { status: 400, headers });
      }

      // DB 업데이트
      const { updateStepType } = await import("../queries.server");
      await updateStepType(stepId, type);

      return data(
        { success: true, message: "단계 유형이 수정되었습니다" },
        { headers },
      );
    } else if (actionType === "reorderSteps") {
      const workflowId = parseInt(formData.get("workflowId") as string);
      const stepIds = JSON.parse(formData.get("stepIds") as string) as number[];

      if (isNaN(workflowId) || !Array.isArray(stepIds)) {
        return data({ error: "Invalid parameters" }, { status: 400, headers });
      }

      // DB 재정렬
      const { reorderSteps } = await import("../queries.server");
      await reorderSteps(workflowId, stepIds);

      return data(
        { success: true, message: "단계 순서가 변경되었습니다" },
        { headers },
      );
    } else if (actionType === "addStep") {
      const workflowId = parseInt(formData.get("workflowId") as string);
      const sequenceNo = parseInt(formData.get("sequenceNo") as string);
      const action = formData.get("action") as string;
      const description = formData.get("description") as string;

      if (isNaN(workflowId) || isNaN(sequenceNo)) {
        return data({ error: "Invalid parameters" }, { status: 400, headers });
      }

      // DB에 새 단계 추가
      const { addStep } = await import("../queries.server");
      await addStep(
        workflowId,
        sequenceNo,
        action || "새 단계",
        description || "",
      );

      return data(
        { success: true, message: "새 단계가 추가되었습니다" },
        { headers },
      );
    } else if (actionType === "uploadScreenshot") {
      const stepId = parseInt(formData.get("stepId") as string);
      const file = formData.get("file") as File;

      if (isNaN(stepId) || !file) {
        return data({ error: "Invalid parameters" }, { status: 400, headers });
      }

      // Upload to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `step-screenshots/${stepId}/${fileName}`;

      const { error: uploadError } = await client.storage
        .from("work-screenshots") // Ensure this bucket exists or use a common one
        .upload(filePath, file);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        return data(
          { error: "Failed to upload image" },
          { status: 500, headers },
        );
      }

      // Get Public URL
      const {
        data: { publicUrl },
      } = client.storage.from("work-screenshots").getPublicUrl(filePath);

      // Update DB
      const { updateStepScreenshot } = await import("../queries.server");
      await updateStepScreenshot(stepId, publicUrl);

      return data(
        { success: true, message: "스크린샷이 업로드되었습니다" },
        { headers },
      );
    } else if (actionType === "deleteScreenshot") {
      const stepId = parseInt(formData.get("stepId") as string);

      if (isNaN(stepId)) {
        return data({ error: "Invalid step ID" }, { status: 400, headers });
      }

      // Update DB (Set to null)
      const { updateStepScreenshot } = await import("../queries.server");
      await updateStepScreenshot(stepId, null);

      // Note: We are not deleting the file from storage to keep it simple and avoid permission issues,
      // but in a real app you might want to delete it.

      return data(
        { success: true, message: "스크린샷이 삭제되었습니다" },
        { headers },
      );
    } else if (actionType === "deleteWorkflow") {
      const workflowId = parseInt(formData.get("workflowId") as string);

      if (isNaN(workflowId)) {
        return data({ error: "Invalid workflow ID" }, { status: 400, headers });
      }

      // DB 삭제
      const { deleteWorkflow } = await import("../queries.server");
      await deleteWorkflow(workflowId);

      return data(
        { success: true, message: "워크플로우가 삭제되었습니다" },
        { headers },
      );
    }

    return data({ error: "Invalid action type" }, { status: 400, headers });
  } catch (error) {
    console.error("Action error:", error);
    return data(
      { error: "Failed to process request" },
      { status: 500, headers },
    );
  }
}

interface VideoAnalysis {
  id: string;
  title: string;
  duration: string;
  uploadDate: string;
  status: "analyzed" | "analyzing" | "pending";
  thumbnail: string;
  videoUrl?: string;
  steps: LogicStep[];
  teamId?: string;
  teamName?: string;
}

interface LogicStep {
  id: number;
  action: string;
  description: string;
  timestamp: string;
  confidence: number;
  type: "click" | "input" | "navigate" | "wait" | "decision";
  screenshot_url?: string;
  notes?: string;
  notes_author_id?: string;
  notes_updated_at?: string;
}

// Demo style step component with modern UI and sortable support
function DemoStyleStep({
  step,
  index,
  isEditMode,
  editedStep,
  currentAction,
  currentDescription,
  getStepColor,
  handleStepTitleChange,
  handleStepDescriptionChange,
  handleDeleteStep,
  openEditDialog,
  getEditedStep,
  handleTypeChange,
  mounted,
  handleUploadScreenshot,
  handleDeleteScreenshot,
  authorProfiles,
}: {
  step: LogicStep;
  index: number;
  isEditMode: boolean;
  editedStep:
    | { action: string; description: string; type?: string }
    | undefined;
  currentAction: string;
  currentDescription: string;
  getStepColor: (type: LogicStep["type"]) => string;
  handleStepTitleChange: (stepId: number, newTitle: string) => void;
  handleStepDescriptionChange: (stepId: number, newDescription: string) => void;
  handleDeleteStep: (stepId: number) => void;
  openEditDialog: (step: LogicStep) => void;
  getEditedStep: (
    stepId: number,
  ) => { action: string; description: string; type?: string } | undefined;
  handleTypeChange: (stepId: number, newType: string) => void;
  mounted: boolean;
  handleUploadScreenshot: (stepId: number, file: File) => void;
  handleDeleteScreenshot: (stepId: number) => void;
  authorProfiles: Record<string, string>;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const isExpanded = isHovered || isLocked;
  const [isEditingType, setIsEditingType] = useState(false);
  const [editedType, setEditedType] = useState(step.type);
  const [localAction, setLocalAction] = useState(currentAction);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUploadScreenshot(step.id, file);
    }
  };

  // Sync local action when currentAction changes (step.id changes)
  useEffect(() => {
    setLocalAction(currentAction);
  }, [currentAction, step.id]);

  // Sortable hooks for drag and drop
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

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

  const actionTypes = [
    {
      value: "click",
      label: "클릭",
      color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    },
    {
      value: "input",
      label: "입력",
      color:
        "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    },
    {
      value: "navigate",
      label: "이동",
      color:
        "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    },
    {
      value: "wait",
      label: "대기",
      color:
        "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
    },
    {
      value: "decision",
      label: "판단",
      color:
        "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    },
  ];

  const handleLocalTypeChange = (newType: string) => {
    setEditedType(newType as LogicStep["type"]);
    handleTypeChange(step.id, newType);
    setIsEditingType(false);
  };

  const currentTypeColor =
    actionTypes.find((t) => t.value === editedType)?.color ||
    getStepColor(step.type);

  return (
    <motion.div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      layout
    >
      <div
        {...(mounted ? attributes : {})}
        {...(mounted && isEditMode ? listeners : {})}
        onMouseEnter={() => !isEditMode && setIsHovered(true)}
        onMouseLeave={() => !isEditMode && setIsHovered(false)}
        onClick={(e) => {
          if (!isEditMode) {
            e.stopPropagation();
            setIsLocked(!isLocked);
          }
        }}
        className={`group relative cursor-pointer overflow-hidden rounded-xl border transition-all duration-300 ${
          isEditMode
            ? "cursor-move border-indigo-200 bg-white shadow-lg hover:border-indigo-300 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-900 dark:hover:bg-indigo-900/20"
            : isExpanded
              ? "border-indigo-500/50 bg-indigo-50/50 shadow-xl shadow-indigo-500/10 dark:border-indigo-400/50 dark:bg-indigo-950/20"
              : "border-white/20 bg-white/40 hover:border-indigo-300/50 hover:bg-white/60 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
        } backdrop-blur-sm`}
      >
        <div className="p-4">
          <div className="flex items-start gap-4">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-sm transition-colors ${
                isEditMode
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300"
                  : "bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {index + 1}
            </div>

            <div className="flex-1">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{getStepIcon(step.type)}</span>
                  {isEditMode ? (
                    <Input
                      value={localAction}
                      onChange={(e) => {
                        setLocalAction(e.target.value);
                        handleStepTitleChange(step.id, e.target.value);
                      }}
                      className="h-8 border-indigo-200 font-medium focus:border-indigo-500 dark:border-indigo-800"
                    />
                  ) : (
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                      {currentAction}
                    </h4>
                  )}
                </div>
                {isEditMode && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteStep(step.id);
                    }}
                    className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
                {!isEditMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsLocked(!isLocked);
                    }}
                    className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                  >
                    {isExpanded ? (
                      <ChevronDown className="size-5" />
                    ) : (
                      <ChevronRight className="size-5" />
                    )}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                {isEditMode ? (
                  <DropdownMenu
                    open={isEditingType}
                    onOpenChange={setIsEditingType}
                  >
                    <DropdownMenuTrigger asChild>
                      <Badge
                        variant="outline"
                        className={`cursor-pointer hover:opacity-80 ${currentTypeColor}`}
                      >
                        <Edit className="mr-1 size-3" />
                        {actionTypes.find((t) => t.value === editedType)?.label}
                      </Badge>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {actionTypes.map((type) => (
                        <DropdownMenuItem
                          key={type.value}
                          onClick={() => handleLocalTypeChange(type.value)}
                          className={type.color}
                        >
                          {type.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
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
                )}
                {/* <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <Clock className="size-3" />
                  {step.timestamp}
                </div> */}
              </div>

              <AnimatePresence>
                {(isExpanded || isEditMode) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-4 space-y-4 overflow-hidden"
                  >
                    {isEditMode ? (
                      <div>
                        <Textarea
                          value={currentDescription}
                          onChange={(e) =>
                            handleStepDescriptionChange(step.id, e.target.value)
                          }
                          placeholder="이 단계에 대한 설명을 입력하세요"
                          rows={3}
                          className="resize-none border-indigo-200 focus:border-indigo-500 dark:border-indigo-800"
                        />
                      </div>
                    ) : (
                      <div className="rounded-lg bg-slate-50/50 p-3 dark:bg-slate-900/50">
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {currentDescription}
                        </p>
                      </div>
                    )}

                    {/* Screenshot */}
                    {(step.screenshot_url || isEditMode) && (
                      <div className="relative overflow-hidden rounded-lg border border-slate-200 shadow-sm dark:border-slate-800">
                        {step.screenshot_url ? (
                          <div className="relative aspect-video">
                            <img
                              src={step.screenshot_url}
                              alt={currentAction}
                              className="h-full w-full object-cover"
                            />
                            {isEditMode && (
                              <div className="absolute top-2 right-2">
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="h-8 w-8 shadow-md"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (
                                      confirm(
                                        "정말로 이 스크린샷을 삭제하시겠습니까?",
                                      )
                                    ) {
                                      handleDeleteScreenshot(step.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : (
                          isEditMode && (
                            <div
                              className="flex aspect-video cursor-pointer flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <ImageIcon className="mb-2 size-8 text-slate-400" />
                              <span className="text-sm font-medium text-slate-500">
                                스크린샷 업로드
                              </span>
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={onFileChange}
                                aria-label="스크린샷 이미지 파일 선택"
                              />
                            </div>
                          )
                        )}
                      </div>
                    )}

                    {/* Notes Section */}
                    {!isEditMode && (
                      <>
                        {step.notes ? (
                          <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 dark:border-indigo-900/30 dark:bg-indigo-950/20">
                            <div className="mb-2 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Lightbulb className="size-4 text-indigo-600 dark:text-indigo-400" />
                                <span className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
                                  추가 설명
                                </span>
                                {(step.notes_author_id ||
                                  step.notes_updated_at) && (
                                  <span className="text-xs text-indigo-500 dark:text-indigo-400">
                                    ·{" "}
                                    {step.notes_author_id &&
                                    authorProfiles[step.notes_author_id]
                                      ? `${authorProfiles[step.notes_author_id]}님`
                                      : ""}
                                    {step.notes_updated_at && (
                                      <>
                                        {" "}
                                        {new Date(
                                          step.notes_updated_at,
                                        ).toLocaleDateString("ko-KR", {
                                          month: "short",
                                          day: "numeric",
                                        })}{" "}
                                        작성
                                      </>
                                    )}
                                  </span>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditDialog(step);
                                }}
                                className="h-6 w-6 p-0 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                              >
                                <Edit className="size-3 text-indigo-600 dark:text-indigo-400" />
                              </Button>
                            </div>
                            <p className="text-sm text-indigo-700 dark:text-indigo-300">
                              {step.notes}
                            </p>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditDialog(step);
                            }}
                            className="w-full border-dashed border-slate-300 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-indigo-700 dark:hover:text-indigo-400"
                          >
                            <Plus className="mr-2 size-4" />
                            메모 추가하기
                          </Button>
                        )}
                      </>
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

// Helper function to format duration
function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Helper function to format date
function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().split("T")[0];
}

export default function BusinessLogic({ loaderData }: Route.ComponentProps) {
  const {
    workflows: dbWorkflows,
    authorProfiles = {},
    rateLimitWarning,
  } = loaderData;
  const fetcher = useFetcher();
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const teamId = searchParams.get("teamId");
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Transform database workflows to VideoAnalysis format (메모이제이션)
  const mockVideos: VideoAnalysis[] = useMemo(
    () =>
      dbWorkflows.map((workflow: any) => {
        // Generate Supabase Storage URL if storage_path exists
        const videoUrl = workflow.sourceVideo?.storage_path
          ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/work-videos/${workflow.sourceVideo.storage_path}`
          : undefined;

        return {
          id: workflow.workflow_id.toString(),
          title: workflow.title,
          duration: formatDuration(workflow.duration_seconds),
          uploadDate: formatDate(workflow.created_at),
          status: workflow.status as "analyzed" | "analyzing" | "pending",
          thumbnail:
            workflow.thumbnail_url &&
            workflow.thumbnail_url !== "/placeholder-video.jpg"
              ? workflow.thumbnail_url
              : "",
          videoUrl,
          steps: (workflow.steps || [])
            .sort((a: any, b: any) => a.sequence_no - b.sequence_no)
            .map((step: any) => ({
              id: step.step_id,
              action: step.action,
              description: step.description,
              timestamp: formatDuration(step.timestamp_seconds),
              confidence: step.confidence || 0,
              type: step.type as
                | "click"
                | "input"
                | "navigate"
                | "wait"
                | "decision",
              screenshot_url: step.screenshot_url || undefined,
              notes: step.notes || undefined,
              notes_author_id: step.notes_author_id || undefined,
              notes_updated_at: step.notes_updated_at || undefined,
            })),
          teamId: workflow.team_id || undefined,
          teamName: workflow.team?.name || undefined,
        };
      }),
    [dbWorkflows],
  );

  const [selectedTeamId, setSelectedTeamId] = useState<string>("all");

  // Get unique teams from workflows
  const uniqueTeams = useMemo(() => {
    const teams = new Map<string, string>();
    mockVideos.forEach((video) => {
      if (video.teamId && video.teamName) {
        teams.set(video.teamId, video.teamName);
      }
    });
    return Array.from(teams.entries()).map(([id, name]) => ({ id, name }));
  }, [mockVideos]);

  // Filter videos based on selected team
  const filteredVideos = useMemo(() => {
    if (selectedTeamId === "all") return mockVideos;
    return mockVideos.filter((video) => video.teamId === selectedTeamId);
  }, [mockVideos, selectedTeamId]);

  const [selectedVideo, setSelectedVideo] = useState<VideoAnalysis | null>(
    mockVideos[0] || null,
  );
  const [editingStep, setEditingStep] = useState<LogicStep | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [isVideoPlayerOpen, setIsVideoPlayerOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedSteps, setEditedSteps] = useState<
    Map<number, { action: string; description: string; type?: string }>
  >(new Map());
  const [deletedStepIds, setDeletedStepIds] = useState<Set<number>>(new Set());
  const [addedSteps, setAddedSteps] = useState<LogicStep[]>([]);
  const [workflowToDelete, setWorkflowToDelete] = useState<string | null>(null);
  const originalVideoRef = useRef<VideoAnalysis | null>(null);

  // Optimistic UI states for screenshots
  const [pendingUploads, setPendingUploads] = useState<Map<number, File>>(
    new Map(),
  );
  const [pendingScreenshotDeletes, setPendingScreenshotDeletes] = useState<
    Set<number>
  >(new Set());

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // URL query param으로 워크플로우 선택
  useEffect(() => {
    const workflowId = searchParams.get("workflow");
    if (workflowId && mockVideos.length > 0) {
      const targetVideo = mockVideos.find((v) => v.id === workflowId);
      if (targetVideo) {
        setSelectedVideo(targetVideo);
      }
    }
  }, [searchParams, mockVideos]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // 비디오 변경 시 수정 모드 리셋
  useEffect(() => {
    setIsEditMode(false);
    setEditedSteps(new Map());
    originalVideoRef.current = null; // 원본 상태 ref 초기화
  }, [selectedVideo?.id]);

  const openEditDialog = (step: LogicStep) => {
    setEditingStep(step);
    setEditNotes(step.notes || "");
    setIsEditDialogOpen(true);
  };

  const handleSaveNotes = () => {
    if (!selectedVideo || !editingStep) return;

    // 낙관적 업데이트: 즉시 UI에 반영
    const updatedSteps = selectedVideo.steps.map((step) =>
      step.id === editingStep.id ? { ...step, notes: editNotes } : step,
    );
    setSelectedVideo({ ...selectedVideo, steps: updatedSteps });

    // FormData로 DB에 저장
    const formData = new FormData();
    formData.append("actionType", "updateNotes");
    formData.append("stepId", editingStep.id.toString());
    formData.append("notes", editNotes);

    fetcher.submit(formData, { method: "post" });

    // 다이얼로그 닫고 상태 초기화
    setIsEditDialogOpen(false);
    setEditingStep(null);
    setEditNotes("");

    toast.success("메모가 저장되었습니다");
  };

  // fetcher 성공 시 데이터 리로드 (rate limit 방지를 위해 디바운스 추가)
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      const timeoutId = setTimeout(() => {
        revalidator.revalidate();
      }, 1000); // 1초 디바운스

      return () => clearTimeout(timeoutId);
    }
  }, [fetcher.state, fetcher.data, revalidator]);

  // dbWorkflows 업데이트 시 선택된 비디오도 동기화
  useEffect(() => {
    if (selectedVideo) {
      const updatedVideo = mockVideos.find((v) => v.id === selectedVideo.id);
      if (
        updatedVideo &&
        JSON.stringify(updatedVideo) !== JSON.stringify(selectedVideo)
      ) {
        setSelectedVideo(updatedVideo);
      }
    }
  }, [dbWorkflows]); // mockVideos 대신 dbWorkflows를 의존성으로 사용

  const handleUploadScreenshot = (stepId: number, file: File) => {
    // Create preview URL
    const previewUrl = URL.createObjectURL(file);

    // Update UI immediately
    if (selectedVideo) {
      const updatedSteps = selectedVideo.steps.map((step) =>
        step.id === stepId ? { ...step, screenshot_url: previewUrl } : step,
      );
      setSelectedVideo({ ...selectedVideo, steps: updatedSteps });
    }

    // Add to pending uploads
    setPendingUploads((prev) => new Map(prev).set(stepId, file));

    // Remove from pending deletes if it was there
    if (pendingScreenshotDeletes.has(stepId)) {
      const newDeletes = new Set(pendingScreenshotDeletes);
      newDeletes.delete(stepId);
      setPendingScreenshotDeletes(newDeletes);
    }
  };

  const handleDeleteScreenshot = (stepId: number) => {
    // Update UI immediately
    if (selectedVideo) {
      const updatedSteps = selectedVideo.steps.map((step) =>
        step.id === stepId ? { ...step, screenshot_url: undefined } : step,
      );
      setSelectedVideo({ ...selectedVideo, steps: updatedSteps });
    }

    // Add to pending deletes
    setPendingScreenshotDeletes((prev) => new Set(prev).add(stepId));

    // Remove from pending uploads if it was there
    if (pendingUploads.has(stepId)) {
      const newUploads = new Map(pendingUploads);
      newUploads.delete(stepId);
      setPendingUploads(newUploads);
    }
  };

  const handleEditProcess = () => {
    if (!isEditMode) {
      // Store original state for cancel functionality
      originalVideoRef.current = selectedVideo
        ? { ...selectedVideo, steps: [...selectedVideo.steps] }
        : null;

      // Initialize edited steps with current values when entering edit mode
      const newEditedSteps = new Map<
        number,
        { action: string; description: string }
      >();
      selectedVideo?.steps.forEach((step) => {
        newEditedSteps.set(step.id, {
          action: step.action,
          description: step.description,
        });
      });
      setEditedSteps(newEditedSteps);
      setDeletedStepIds(new Set());
      setAddedSteps([]);
      setIsEditMode(true);
      toast.success("수정 모드가 활성화되었습니다");
    } else {
      // Save all pending operations: reorders first, then deletes, adds, and edits
      if (!selectedVideo) return;

      // Process reordering if steps have been reordered
      if (originalVideoRef.current) {
        const originalOrder = originalVideoRef.current.steps.map((s) => s.id);
        const currentOrder = selectedVideo.steps.map((s) => s.id);

        if (JSON.stringify(originalOrder) !== JSON.stringify(currentOrder)) {
          const formData = new FormData();
          formData.append("actionType", "reorderSteps");
          formData.append("workflowId", selectedVideo.id);
          formData.append("stepIds", JSON.stringify(currentOrder));
          fetcher.submit(formData, { method: "post" });
        }
      }

      // Process deletions
      deletedStepIds.forEach((stepId) => {
        const formData = new FormData();
        formData.append("actionType", "deleteStep");
        formData.append("stepId", stepId.toString());
        fetcher.submit(formData, { method: "post" });
      });

      // Process additions
      addedSteps.forEach((step, index) => {
        const formData = new FormData();
        formData.append("actionType", "addStep");
        formData.append("workflowId", selectedVideo.id);
        formData.append(
          "sequenceNo",
          (selectedVideo.steps.length + index + 1).toString(),
        );
        formData.append("action", step.action);
        formData.append("description", step.description);
        fetcher.submit(formData, { method: "post" });
      });

      // Process edits
      editedSteps.forEach((data, stepId) => {
        // Skip if step was deleted
        if (deletedStepIds.has(stepId)) return;

        const originalStep = originalVideoRef.current?.steps.find(
          (s) => s.id === stepId,
        );
        if (
          originalStep &&
          (originalStep.action !== data.action ||
            originalStep.description !== data.description)
        ) {
          const formData = new FormData();
          formData.append("actionType", "updateStep");
          formData.append("stepId", stepId.toString());
          formData.append("action", data.action);
          formData.append("description", data.description);
          fetcher.submit(formData, { method: "post" });
        }

        // Type update check
        if (data.type && originalStep && originalStep.type !== data.type) {
          const formData = new FormData();
          formData.append("actionType", "updateStepType");
          formData.append("stepId", stepId.toString());
          formData.append("type", data.type);
          fetcher.submit(formData, { method: "post" });
        }
      });

      // Process screenshot uploads
      pendingUploads.forEach((file, stepId) => {
        const formData = new FormData();
        formData.append("actionType", "uploadScreenshot");
        formData.append("stepId", stepId.toString());
        formData.append("file", file);
        fetcher.submit(formData, {
          method: "post",
          encType: "multipart/form-data",
        });
      });

      // Process screenshot deletes
      pendingScreenshotDeletes.forEach((stepId) => {
        const formData = new FormData();
        formData.append("actionType", "deleteScreenshot");
        formData.append("stepId", stepId.toString());
        fetcher.submit(formData, { method: "post" });
      });

      setIsEditMode(false);
      setEditedSteps(new Map());
      setDeletedStepIds(new Set());
      setAddedSteps([]);
      setPendingUploads(new Map());
      setPendingScreenshotDeletes(new Set());
      toast.success("모든 변경사항이 저장되었습니다");
    }
  };

  const handleCancelEdit = () => {
    if (originalVideoRef.current) {
      setSelectedVideo(originalVideoRef.current);
    }
    setIsEditMode(false);
    setEditedSteps(new Map());
    setDeletedStepIds(new Set());
    setAddedSteps([]);
    setPendingUploads(new Map());
    setPendingScreenshotDeletes(new Set());
    toast.info("수정이 취소되었습니다");
  };

  const handleStepTitleChange = (stepId: number, newTitle: string) => {
    if (!selectedVideo) return;

    const updatedSteps = selectedVideo.steps.map((step) =>
      step.id === stepId ? { ...step, action: newTitle } : step,
    );
    setSelectedVideo({ ...selectedVideo, steps: updatedSteps });

    const currentEdit = editedSteps.get(stepId) || {
      action: "",
      description: "",
    };
    const step = selectedVideo.steps.find((s) => s.id === stepId);
    if (step) {
      setEditedSteps(
        new Map(
          editedSteps.set(stepId, {
            ...currentEdit,
            action: newTitle,
            description: currentEdit.description || step.description,
          }),
        ),
      );
    }
  };

  const handleStepDescriptionChange = (
    stepId: number,
    newDescription: string,
  ) => {
    if (!selectedVideo) return;

    const updatedSteps = selectedVideo.steps.map((step) =>
      step.id === stepId ? { ...step, description: newDescription } : step,
    );
    setSelectedVideo({ ...selectedVideo, steps: updatedSteps });

    const currentEdit = editedSteps.get(stepId) || {
      action: "",
      description: "",
    };
    const step = selectedVideo.steps.find((s) => s.id === stepId);
    if (step) {
      setEditedSteps(
        new Map(
          editedSteps.set(stepId, {
            ...currentEdit,
            description: newDescription,
            action: currentEdit.action || step.action,
          }),
        ),
      );
    }
  };

  const handleTypeChange = (stepId: number, newType: string) => {
    if (!selectedVideo) return;

    const updatedSteps = selectedVideo.steps.map((step) =>
      step.id === stepId ? { ...step, type: newType as any } : step,
    );
    setSelectedVideo({ ...selectedVideo, steps: updatedSteps });

    const currentEdit = editedSteps.get(stepId) || {
      action: "",
      description: "",
    };
    const step = selectedVideo.steps.find((s) => s.id === stepId);
    if (step) {
      setEditedSteps(
        new Map(
          editedSteps.set(stepId, {
            ...currentEdit,
            type: newType,
            action: currentEdit.action || step.action,
            description: currentEdit.description || step.description,
          }),
        ),
      );
    }
  };

  const handleDeleteStep = (stepId: number) => {
    if (!selectedVideo) return;

    // Filter out the deleted step
    const updatedSteps = selectedVideo.steps.filter(
      (step) => step.id !== stepId,
    );
    setSelectedVideo({ ...selectedVideo, steps: updatedSteps });

    // Mark as deleted
    const newDeletedIds = new Set(deletedStepIds);
    newDeletedIds.add(stepId);
    setDeletedStepIds(newDeletedIds);
  };

  const handleAddStep = () => {
    if (!selectedVideo) return;

    const newStep: LogicStep = {
      id: -Date.now(), // Temporary ID
      action: "새 단계",
      description: "새로운 단계 설명을 입력하세요",
      timestamp: "0:00",
      confidence: 1,
      type: "click",
    };

    setSelectedVideo({
      ...selectedVideo,
      steps: [...selectedVideo.steps, newStep],
    });

    setAddedSteps([...addedSteps, newStep]);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && selectedVideo) {
      const oldIndex = selectedVideo.steps.findIndex(
        (step) => step.id === active.id,
      );
      const newIndex = selectedVideo.steps.findIndex(
        (step) => step.id === over.id,
      );

      const newSteps = arrayMove(selectedVideo.steps, oldIndex, newIndex);
      setSelectedVideo({ ...selectedVideo, steps: newSteps });
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

  const getEditedStep = (stepId: number) => editedSteps.get(stepId);

  const handleDeleteWorkflow = () => {
    if (!workflowToDelete) return;

    const formData = new FormData();
    formData.append("actionType", "deleteWorkflow");
    formData.append("workflowId", workflowToDelete);

    fetcher.submit(formData, { method: "post" });

    // 선택된 워크플로우가 삭제된 경우 선택 해제
    if (selectedVideo?.id === workflowToDelete) {
      setSelectedVideo(null);
    }

    setWorkflowToDelete(null);
  };

  // Sidebar Component
  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="p-6">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Bot className="size-5" />
          </div>
          <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
            업무 프로세스
          </span>
        </div>
        <Button
          className="w-full bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          asChild
        >
          <Link to="/work/upload">
            <Plus className="mr-2 size-4" />
            업로드
          </Link>
        </Button>
      </div>

      <div className="px-6 pb-4">
        <div className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          팀 필터
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between border-slate-200 bg-white/50 hover:bg-white hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:bg-slate-900 dark:hover:text-indigo-400"
            >
              <div className="flex items-center gap-2 truncate">
                <Users className="size-4 text-slate-500" />
                <span className="truncate">
                  {selectedTeamId === "all"
                    ? "전체 보기"
                    : uniqueTeams.find((t) => t.id === selectedTeamId)?.name ||
                      "팀 선택"}
                </span>
              </div>
              <ChevronDown className="size-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64" align="start">
            <DropdownMenuItem
              onClick={() => setSelectedTeamId("all")}
              className="gap-2"
            >
              <div className="flex size-6 items-center justify-center rounded bg-slate-100 dark:bg-slate-800">
                <List className="size-3.5" />
              </div>
              <span className="flex-1">전체 보기</span>
              {selectedTeamId === "all" && (
                <CheckCircle2 className="size-4 text-indigo-600" />
              )}
            </DropdownMenuItem>
            {uniqueTeams.map((team) => (
              <DropdownMenuItem
                key={team.id}
                onClick={() => setSelectedTeamId(team.id)}
                className="gap-2"
              >
                <div className="flex size-6 items-center justify-center rounded bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                  <Users className="size-3.5" />
                </div>
                <span className="flex-1 truncate">{team.name}</span>
                {selectedTeamId === team.id && (
                  <CheckCircle2 className="size-4 text-indigo-600" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="space-y-2">
          {filteredVideos.map((video) => (
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
      {/* Rate Limit Warning */}
      {rateLimitWarning && (
        <Alert variant="destructive" className="mx-auto mt-4 max-w-2xl">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>알림</AlertTitle>
          <AlertDescription>
            사용량이 많아 일부 데이터를 불러오지 못했습니다. 잠시 후 다시
            시도해주세요.
          </AlertDescription>
        </Alert>
      )}

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
            <span className="font-semibold"></span>
            <div className="w-9" /> {/* Spacer */}
          </div>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-4 lg:p-8">
            <div className="mx-auto max-w-4xl">
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
                          <div
                            className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/30 opacity-0 transition-opacity hover:opacity-100"
                            onClick={() => setIsVideoPlayerOpen(true)}
                          >
                            <Play className="size-8 text-white" />
                          </div>
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
                        {isEditMode ? (
                          <>
                            <Button
                              variant="outline"
                              onClick={handleCancelEdit}
                              className="border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                            >
                              취소
                            </Button>
                            <Button
                              onClick={handleEditProcess}
                              className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                            >
                              <Save className="mr-2 size-4" />
                              저장하기
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              onClick={() =>
                                setWorkflowToDelete(selectedVideo.id)
                              }
                              className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
                            >
                              <Trash2 className="mr-2 size-4" />
                              삭제
                            </Button>
                            <Button
                              onClick={handleEditProcess}
                              className="bg-white text-slate-900 shadow-sm hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                            >
                              <Edit3 className="mr-2 size-4" />
                              편집 모드
                            </Button>
                          </>
                        )}
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
                      {isEditMode && (
                        <Button
                          onClick={handleAddStep}
                          size="sm"
                          className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                        >
                          <Plus className="mr-2 size-4" />
                          단계 추가
                        </Button>
                      )}
                    </div>

                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={selectedVideo.steps.map((s) => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-3 pb-20">
                          <AnimatePresence mode="popLayout">
                            {selectedVideo.steps.map((step, index) => (
                              <DemoStyleStep
                                key={step.id}
                                step={step}
                                index={index}
                                isEditMode={isEditMode}
                                editedStep={getEditedStep(step.id)}
                                currentAction={
                                  getEditedStep(step.id)?.action || step.action
                                }
                                currentDescription={
                                  getEditedStep(step.id)?.description ||
                                  step.description
                                }
                                getStepColor={getStepColor}
                                handleStepTitleChange={handleStepTitleChange}
                                handleStepDescriptionChange={
                                  handleStepDescriptionChange
                                }
                                handleDeleteStep={handleDeleteStep}
                                openEditDialog={openEditDialog}
                                getEditedStep={getEditedStep}
                                handleTypeChange={handleTypeChange}
                                mounted={mounted}
                                handleUploadScreenshot={handleUploadScreenshot}
                                handleDeleteScreenshot={handleDeleteScreenshot}
                                authorProfiles={authorProfiles}
                              />
                            ))}
                          </AnimatePresence>
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                </motion.div>
              ) : (
                <div className="flex h-[60vh] flex-col items-center justify-center text-center">
                  <div className="mb-4 rounded-full bg-slate-100 p-6 dark:bg-slate-800">
                    <Bot className="size-12 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    선택된 워크플로우가 없습니다
                  </h3>
                  <p className="mt-2 text-slate-500 dark:text-slate-400">
                    왼쪽 목록에서 분석 결과를 선택하거나 새로운 영상을
                    업로드하세요.
                  </p>
                  <Button
                    className="mt-6 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                    asChild
                  >
                    <Link to="/work/upload">
                      <Plus className="mr-2 size-4" />
                      업로드
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Edit Note Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>메모 편집</DialogTitle>
            <DialogDescription>
              이 단계에 대한 추가 설명이나 메모를 작성하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="메모를 입력하세요..."
              rows={5}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              취소
            </Button>
            <Button onClick={handleSaveNotes}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Workflow Alert */}
      <Dialog
        open={!!workflowToDelete}
        onOpenChange={(open) => !open && setWorkflowToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>워크플로우 삭제</DialogTitle>
            <DialogDescription>
              정말로 이 워크플로우를 삭제하시겠습니까? 이 작업은 되돌릴 수
              없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkflowToDelete(null)}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleDeleteWorkflow}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Player Dialog */}
      <Dialog open={isVideoPlayerOpen} onOpenChange={setIsVideoPlayerOpen}>
        <DialogContent className="max-w-4xl overflow-hidden border-slate-800 bg-black p-0">
          <div className="relative aspect-video w-full">
            {selectedVideo?.videoUrl ? (
              <video
                src={selectedVideo.videoUrl}
                controls
                autoPlay
                className="h-full w-full"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-400">
                <FileVideo className="size-12" />
                <span className="ml-2">비디오를 찾을 수 없습니다</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
