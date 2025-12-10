import type { Route } from "./+types/team-management";

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Eye,
  FileVideo,
  Link as LinkIcon,
  Loader2,
  Mail,
  MoreVertical,
  Plus,
  Search,
  Share2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { Alert, AlertDescription } from "~/core/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/core/components/ui/alert-dialog";
import { Badge } from "~/core/components/ui/badge";
import { Button } from "~/core/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/core/components/ui/card";
import { Checkbox } from "~/core/components/ui/checkbox";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/core/components/ui/dropdown-menu";
import { Input } from "~/core/components/ui/input";
import { Label } from "~/core/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/core/components/ui/select";
import { Separator } from "~/core/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/core/components/ui/table";
import { Textarea } from "~/core/components/ui/textarea";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "팀관리" },
    { name: "description", content: "팀 관리 페이지" },
  ];
}

// Type definitions
interface Team {
  team_id: string;
  name: string;
  description: string | null;
  created_at: string;
  owner_id: string;
}

interface TeamMember {
  member_id: string;
  email: string;
  role: string;
  status: string;
  invited_at: string;
  joined_at: string | null;
  user_id: string | null;
}

interface Workflow {
  workflow_id: number;
  title: string;
  description: string | null;
  status: "analyzed" | "analyzing" | "pending";
  created_at: Date | string;
  team_id: string | null;
  owner_id: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  steps?: any[];
  sourceVideo?: any;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { default: makeServerClient } = await import(
    "~/core/lib/supa-client.server"
  );
  const [client] = makeServerClient(request);
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    throw new Response("Unauthorized", { status: 401 });
  }

  return { user };
}

export default function TeamManagement({ loaderData }: Route.ComponentProps) {
  const user = loaderData?.user as
    | ({
        id: string;
        email: string | null;
      } & Record<string, any>)
    | null;

  if (!user) {
    return <div>인증되지 않았습니다.</div>;
  }

  // Type assertion to ensure user is properly typed
  const typedUser = user as {
    id: string;
    email: string | null;
  } & Record<string, any>;

  // State
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState<string>("");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [teamProcesses, setTeamProcesses] = useState<Workflow[]>([]);
  const [myStatus, setMyStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // 현재 선택된 팀 정보
  const selectedTeam = teams.find((team) => team.team_id === teamId);

  // Dialog states
  const [isCreateTeamDialogOpen, setIsCreateTeamDialogOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [userWorkflows, setUserWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflows, setSelectedWorkflows] = useState<string[]>([]);

  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const [isMigrateDialogOpen, setIsMigrateDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [workflowToUnshare, setWorkflowToUnshare] = useState<string | null>(
    null,
  );

  const [isLoading, setIsLoading] = useState(false);

  // Computed values
  const myRole = members.find((m) => m.user_id === typedUser.id)?.role || null;
  const isAdmin = myRole === "owner" || myRole === "admin";

  const filteredMembers = members.filter((member) => {
    const matchesSearch = member.email
      ? member.email.toLowerCase().includes(searchQuery.toLowerCase())
      : false;
    const matchesStatus =
      filterStatus === "all" || member.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Load teams
  useEffect(() => {
    let cancelled = false;
    async function loadTeams() {
      try {
        const res = await fetch("/api/teams");
        if (!res.ok) throw new Error("Failed to load teams");
        const json = await res.json();
        if (!cancelled) {
          setTeams(json.teams || []);
          // Only set initial teamId if no team is selected
          if (json.teams && json.teams.length > 0 && !teamId) {
            setTeamId(json.teams[0].team_id);
          }
        }
      } catch (e) {
        console.error("[Team] Failed to load teams", e);
        toast.error("팀 목록을 불러오는데 실패했습니다");
      }
    }
    loadTeams();
    return () => {
      cancelled = true;
    };
  }, [typedUser.id]);

  // Reset states when team changes
  useEffect(() => {
    if (!teamId) return;
    console.log(`[Team] Team changed to: ${teamId}, resetting states`);
    setMembers([]);
    setTeamProcesses([]);
    setMyStatus(null);
    setSearchQuery("");
    setFilterStatus("all");
  }, [teamId]);

  // Load team members
  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    async function loadMembers() {
      try {
        console.log(`[Team] Loading members for team: ${teamId}`);
        const res = await fetch(`/api/teams/${teamId}/members`);
        if (!res.ok) throw new Error("Failed to load members");
        const json = await res.json();
        if (!cancelled) {
          setMembers(json.members || []);
          const myMember = json.members?.find(
            (m: TeamMember) => m.user_id === typedUser.id,
          );
          setMyStatus(myMember?.status || null);
          console.log(`[Team] Set my status to: ${myMember?.status}`);
        }
      } catch (e) {
        console.error("[Team] Failed to load members", e);
        toast.error("팀원 목록을 불러오는데 실패했습니다");
      }
    }
    loadMembers();
    return () => {
      cancelled = true;
    };
  }, [teamId, typedUser.id]);

  // Load team workflows
  useEffect(() => {
    if (!teamId || myStatus !== "active") return;
    let cancelled = false;
    async function loadWorkflows() {
      try {
        console.log(
          `[Team] Loading workflows for team: ${teamId}, status: ${myStatus}`,
        );
        const res = await fetch(`/api/teams/${teamId}/workflows`);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          console.error(`[Team] API Error: ${res.status}`, errorData);
          throw new Error(
            errorData.error || `Failed to load workflows (${res.status})`,
          );
        }
        const json = await res.json();
        console.log(`[Team] Loaded workflows:`, json.workflows);
        if (!cancelled) {
          setTeamProcesses(json.workflows || []);
        }
      } catch (e) {
        console.error("[Team] Failed to load workflows", e);
        toast.error("팀 업무 프로세스 목록을 불러오는데 실패했습니다");
      }
    }
    loadWorkflows();
    return () => {
      cancelled = true;
    };
  }, [teamId, myStatus]);

  // Load user's personal workflows
  useEffect(() => {
    let cancelled = false;
    async function loadUserWorkflows() {
      try {
        console.log("[Team] Loading user workflows...");
        console.log("[Team] typedUser:", typedUser);

        if (!typedUser) {
          console.error("[Team] User not authenticated");
          return;
        }

        // API 호출로 사용자 워크플로우 가져오기
        console.log("[Team] Fetching from /api/work/workflows...");
        const res = await fetch("/api/work/workflows");
        console.log("[Team] Response status:", res.status);

        if (!res.ok) {
          const errorText = await res.text();
          console.error("[Team] API error:", errorText);
          throw new Error("Failed to load user workflows");
        }

        const json = await res.json();
        console.log("[Team] API response:", json);
        console.log("[Team] User workflows loaded:", json.workflows);
        console.log("[Team] Workflows count:", json.workflows?.length || 0);

        if (!cancelled) {
          setUserWorkflows(json.workflows || []);
          console.log("[Team] State updated with workflows");
        }
      } catch (e) {
        console.error("[Team] Failed to load user workflows", e);
      }
    }
    loadUserWorkflows();
    return () => {
      cancelled = true;
    };
  }, [typedUser]);

  // Create new team
  async function handleCreateTeam() {
    if (!newTeamName.trim()) {
      toast.error("팀 이름을 입력해주세요");
      return;
    }

    setIsCreatingTeam(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTeamName.trim(),
          description: newTeamDescription.trim(),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "팀 생성 실패");
      }

      const json = await res.json();
      const newTeam = json.team;

      // Add new team to the list and select it
      setTeams([newTeam, ...teams]);
      setTeamId(newTeam.team_id);

      // Load members for the new team
      try {
        const membersRes = await fetch(`/api/teams/${newTeam.team_id}/members`);
        if (membersRes.ok) {
          const membersJson = await membersRes.json();
          setMembers(membersJson.members || []);
          const myMember = membersJson.members?.find(
            (m: TeamMember) => m.user_id === typedUser.id,
          );
          setMyStatus(myMember?.status || null);
        }
      } catch (e) {
        console.error("Failed to load members after team creation", e);
      }

      toast.success("팀이 생성되었습니다");
      setIsCreateTeamDialogOpen(false);
      setNewTeamName("");
      setNewTeamDescription("");
    } catch (e: any) {
      toast.error(e.message || "팀 생성에 실패했습니다");
    } finally {
      setIsCreatingTeam(false);
    }
  }

  // Invite team member
  async function handleInvite() {
    if (!teamId || !inviteEmail) {
      toast.error("이메일을 입력해주세요");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || errorData.message || "초대 실패");
      }

      const json = await res.json();
      toast.success(`${inviteEmail}로 초대 이메일을 발송했습니다`);

      // Close dialog and reset form
      setIsInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("member");
      setInviteToken(null);

      // Reload members
      const membersRes = await fetch(`/api/teams/${teamId}/members`);
      if (membersRes.ok) {
        const membersJson = await membersRes.json();
        setMembers(membersJson.members || []);
      }
    } catch (e: any) {
      toast.error(e.message || "초대에 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  }

  // Copy invite link
  function copyInviteLink() {
    if (!inviteToken) return;
    const link = `${window.location.origin}/work/invite/${inviteToken}`;
    navigator.clipboard.writeText(link);
    toast.success("초대 링크가 복사되었습니다");
  }

  // Close invite dialog
  function closeInviteDialog() {
    setIsInviteDialogOpen(false);
    setInviteEmail("");
    setInviteRole("member");
    setInviteToken(null);
  }

  // Open delete dialog
  function openDeleteDialog(member: TeamMember) {
    setSelectedMember(member);
    setIsDeleteDialogOpen(true);
  }

  // Delete member
  async function handleDelete() {
    if (!selectedMember || !teamId) return;

    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/teams/${teamId}/members/${selectedMember.member_id}`,
        {
          method: "DELETE",
        },
      );

      if (!res.ok) throw new Error("삭제 실패");

      toast.success("팀원이 삭제되었습니다");
      setIsDeleteDialogOpen(false);
      setSelectedMember(null);

      // Reload members
      const membersRes = await fetch(`/api/teams/${teamId}/members`);
      if (membersRes.ok) {
        const membersJson = await membersRes.json();
        setMembers(membersJson.members || []);
      }
    } catch (e: any) {
      toast.error(e.message || "삭제에 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  }

  // Change member role
  async function handleRoleChange(member: TeamMember, newRole: string) {
    if (!teamId) return;

    try {
      const res = await fetch(
        `/api/teams/${teamId}/members/${member.member_id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        },
      );

      if (!res.ok) throw new Error("역할 변경 실패");

      toast.success("역할이 변경되었습니다");

      // Reload members
      const membersRes = await fetch(`/api/teams/${teamId}/members`);
      if (membersRes.ok) {
        const membersJson = await membersRes.json();
        setMembers(membersJson.members || []);
      }
    } catch (e: any) {
      toast.error(e.message || "역할 변경에 실패했습니다");
    }
  }

  // Share workflows with team
  async function handleShareWorkflows() {
    if (!teamId || selectedWorkflows.length === 0) {
      toast.error("공유할 업무 프로세스를 선택해주세요");
      return;
    }

    console.log("[Share] Team ID:", teamId);
    console.log("[Share] Selected workflows:", selectedWorkflows);
    console.log(
      "[Share] User workflows available:",
      userWorkflows.map((w) => ({
        id: w.workflow_id,
        title: w.title,
        team_id: w.team_id,
      })),
    );

    setIsSharing(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/migrate-workflows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow_ids: selectedWorkflows,
        }),
      });

      console.log("[Share] Response status:", res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error("[Share] API error:", errorText);
        throw new Error("공유 실패");
      }

      const json = await res.json();
      console.log("[Share] API response:", json);
      toast.success(
        `${json.migrated_count}개의 업무 프로세스가 팀에 공유되었습니다`,
      );
      setIsShareDialogOpen(false);
      setSelectedWorkflows([]);

      // Reload team workflows
      const workflowsRes = await fetch(`/api/teams/${teamId}/workflows`);
      if (workflowsRes.ok) {
        const workflowsJson = await workflowsRes.json();
        setTeamProcesses(workflowsJson.workflows || []);
      }
    } catch (e: any) {
      toast.error(e.message || "공유에 실패했습니다");
    } finally {
      setIsSharing(false);
    }
  }

  // Open unshare confirmation
  function handleRemoveWorkflow(workflowId: string) {
    setWorkflowToUnshare(workflowId);
  }

  // Confirm unshare
  async function confirmUnshare() {
    if (!teamId || !workflowToUnshare) return;

    try {
      const res = await fetch(
        `/api/teams/${teamId}/workflows/${workflowToUnshare}`,
        {
          method: "DELETE",
        },
      );

      if (!res.ok) throw new Error("공유 중지 실패");

      toast.success("업무 프로세스 공유가 중지되었습니다");
      setWorkflowToUnshare(null);

      // Reload team workflows
      const workflowsRes = await fetch(`/api/teams/${teamId}/workflows`);
      if (workflowsRes.ok) {
        const workflowsJson = await workflowsRes.json();
        setTeamProcesses(workflowsJson.workflows || []);
      }
    } catch (e: any) {
      toast.error(e.message || "공유 중지에 실패했습니다");
    }
  }

  // Migrate workflows
  async function handleMigrateWorkflows() {
    if (!teamId) return;

    setIsMigrating(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/migrate-workflows`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("마이그레이션 실패");

      const json = await res.json();
      toast.success(`${json.migrated_count}개의 워크플로우가 이관되었습니다`);
      setIsMigrateDialogOpen(false);

      // Reload workflows
      const workflowsRes = await fetch(`/api/teams/${teamId}/workflows`);
      if (workflowsRes.ok) {
        const workflowsJson = await workflowsRes.json();
        setTeamProcesses(workflowsJson.workflows || []);
      }
    } catch (e: any) {
      toast.error(e.message || "마이그레이션에 실패했습니다");
    } finally {
      setIsMigrating(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full bg-slate-50/50 p-4 lg:p-8 dark:bg-slate-950/50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-7xl space-y-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground text-3xl font-bold tracking-tight">
              팀 관리
            </h1>
            <p className="text-muted-foreground mt-2">
              팀원을 초대하고 워크플로우를 공유하세요
            </p>
          </div>
        </div>

        {/* Unified Team Management UI */}
        {teams.length === 0 ? (
          <div className="bg-card flex h-[450px] shrink-0 items-center justify-center rounded-md border border-dashed">
            <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
              <div className="bg-muted flex h-20 w-20 items-center justify-center rounded-full">
                <Users className="text-muted-foreground h-10 w-10" />
              </div>
              <h3 className="text-foreground mt-4 text-lg font-semibold">
                팀이 없습니다
              </h3>
              <p className="text-muted-foreground mt-2 mb-4 text-sm">
                새로운 팀을 생성하고 팀원들을 초대하여 협업을 시작하세요.
              </p>
              <Button onClick={() => setIsCreateTeamDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />첫 팀 생성하기
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 1. Team Selection & Actions */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 hidden h-12 w-12 items-center justify-center rounded-xl sm:flex">
                    <Users className="text-primary h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold tracking-tight">
                        {selectedTeam ? selectedTeam.name : "팀 선택"}
                      </h2>
                      {myRole && (
                        <Badge variant="secondary" className="font-semibold">
                          {myRole === "owner"
                            ? "소유자"
                            : myRole === "admin"
                              ? "관리자"
                              : "사용자"}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={teamId} onValueChange={setTeamId}>
                        <SelectTrigger className="text-muted-foreground hover:text-foreground h-8 w-[200px] border-none bg-transparent p-0 text-sm shadow-none focus:ring-0">
                          <SelectValue placeholder="팀 변경하기" />
                        </SelectTrigger>
                        <SelectContent>
                          {teams.map((team) => (
                            <SelectItem key={team.team_id} value={team.team_id}>
                              <div className="flex items-center gap-2">
                                <div className="bg-primary h-2 w-2 rounded-full"></div>
                                {team.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsCreateTeamDialogOpen(true)}
                        className="text-primary hover:bg-primary/10 hover:text-primary h-8 px-2 text-xs"
                      >
                        <Plus className="mr-1 h-3 w-3" /> 새 팀
                      </Button>
                    </div>
                  </div>
                </div>

                {isAdmin && (
                  <Button onClick={() => setIsInviteDialogOpen(true)}>
                    <UserPlus className="mr-2 h-4 w-4" /> 팀원 초대
                  </Button>
                )}
              </CardHeader>
            </Card>

            {/* 2. Statistics Bar */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    전체 팀원
                  </CardTitle>
                  <Users className="text-muted-foreground h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{members.length}</div>
                  <p className="text-muted-foreground text-xs">
                    현재 팀에 소속된 전체 인원
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">활동 중</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-500">
                    {members.filter((m) => m.status === "active").length}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    정상적으로 활동 중인 팀원
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">대기 중</CardTitle>
                  <Mail className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-500">
                    {members.filter((m) => m.status === "pending").length}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    초대 수락을 기다리는 중
                  </p>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* 3. Member List */}
            <div className="space-y-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <h3 className="text-lg font-semibold tracking-tight">
                  팀원 목록
                </h3>
                <div className="flex flex-1 flex-col gap-2 md:max-w-md md:flex-row">
                  <div className="relative flex-1">
                    <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
                    <Input
                      placeholder="이메일로 검색..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="상태 필터" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 상태</SelectItem>
                      <SelectItem value="active">활동 중</SelectItem>
                      <SelectItem value="pending">대기 중</SelectItem>
                      <SelectItem value="inactive">제외됨</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {filteredMembers.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed text-center">
                  <Users className="text-muted-foreground/50 h-8 w-8" />
                  <p className="text-muted-foreground mt-2 text-sm font-medium">
                    팀원이 없습니다
                  </p>
                  {!searchQuery && filterStatus === "all" && isAdmin && (
                    <Button
                      variant="link"
                      onClick={() => setIsInviteDialogOpen(true)}
                    >
                      팀원 초대하기
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>이메일</TableHead>
                        <TableHead>역할</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead className="hidden md:table-cell">
                          초대일
                        </TableHead>
                        <TableHead className="hidden md:table-cell">
                          가입일
                        </TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers.map((member) => (
                        <TableRow key={member.member_id}>
                          <TableCell className="font-medium">
                            {member.email}
                          </TableCell>
                          <TableCell>
                            {isAdmin && member.role !== "owner" ? (
                              <Select
                                value={member.role}
                                onValueChange={(val) =>
                                  handleRoleChange(member, val)
                                }
                                disabled={!isAdmin}
                              >
                                <SelectTrigger className="hover:bg-muted/50 h-8 w-[100px] border-none bg-transparent shadow-none">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">관리자</SelectItem>
                                  <SelectItem value="member">사용자</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="outline" className="font-normal">
                                {member.role === "owner"
                                  ? "소유자"
                                  : member.role === "admin"
                                    ? "관리자"
                                    : "사용자"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                member.status === "active"
                                  ? "default"
                                  : member.status === "pending"
                                    ? "secondary"
                                    : "outline"
                              }
                              className={
                                member.status === "active"
                                  ? "border-transparent bg-emerald-500 hover:bg-emerald-600"
                                  : ""
                              }
                            >
                              {member.status === "active"
                                ? "활동 중"
                                : member.status === "pending"
                                  ? "대기 중"
                                  : "제외됨"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground hidden md:table-cell">
                            {new Date(member.invited_at).toLocaleDateString(
                              "ko-KR",
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground hidden md:table-cell">
                            {member.joined_at
                              ? new Date(member.joined_at).toLocaleDateString(
                                  "ko-KR",
                                )
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {isAdmin &&
                              member.role !== "owner" &&
                              member.status !== "inactive" && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => openDeleteDialog(member)}
                                    >
                                      <X className="mr-2 h-4 w-4" />
                                      팀에서 제외
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <Separator />

            {/* 4. Team Processes Section */}
            {teamId && myStatus === "active" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold tracking-tight">
                      팀 업무 프로세스
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      이 팀에 공유된 업무 프로세스 목록입니다
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{teamProcesses.length}개</Badge>
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedWorkflows([]);
                          setIsShareDialogOpen(true);
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        공유하기
                      </Button>
                    )}
                  </div>
                </div>

                {teamProcesses.length === 0 ? (
                  <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed text-center">
                    <LinkIcon className="text-muted-foreground/50 h-8 w-8" />
                    <p className="text-muted-foreground mt-2 text-sm font-medium">
                      공유된 프로세스가 없습니다
                    </p>
                    <p className="text-muted-foreground text-xs">
                      개인 워크플로우를 팀원들과 공유해보세요.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {teamProcesses.map((workflow) => (
                      <Card
                        key={workflow.workflow_id}
                        className="group hover:border-primary/50 overflow-hidden transition-all hover:shadow-md"
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="bg-primary/10 rounded-lg p-2">
                              <FileVideo className="text-primary h-5 w-5" />
                            </div>
                            <Badge
                              variant="outline"
                              className="text-xs font-normal"
                            >
                              {workflow.status}
                            </Badge>
                          </div>
                          <CardTitle className="mt-4 line-clamp-1 text-base">
                            {workflow.title}
                          </CardTitle>
                          {workflow.description && (
                            <CardDescription className="line-clamp-2 text-xs">
                              {workflow.description}
                            </CardDescription>
                          )}
                        </CardHeader>
                        <CardFooter className="bg-muted/30 pt-4">
                          <div className="flex w-full items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              asChild
                            >
                              <Link
                                to={`/work/business-logic?workflow=${workflow.workflow_id}`}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                보기
                              </Link>
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive h-8 w-8"
                                onClick={() =>
                                  handleRemoveWorkflow(
                                    workflow.workflow_id.toString(),
                                  )
                                }
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Invite Dialog */}
        <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>팀원 초대</DialogTitle>
              <DialogDescription>
                이메일로 팀원을 초대하고 역할을 지정하세요.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">역할</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">사용자</SelectItem>
                    <SelectItem value="admin">관리자</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {inviteToken && (
                <div className="bg-muted space-y-2 rounded-md p-3">
                  <Label>초대 링크</Label>
                  <div className="flex gap-2">
                    <Input
                      value={`${window.location.origin}/work/invite/${inviteToken}`}
                      readOnly
                      className="bg-background text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={copyInviteLink}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    이 링크를 초대할 팀원에게 전송하세요.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={closeInviteDialog}
                disabled={isLoading}
              >
                {inviteToken ? "완료" : "취소"}
              </Button>
              {!inviteToken && (
                <Button
                  onClick={handleInvite}
                  disabled={isLoading || !inviteEmail}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      초대 중...
                    </>
                  ) : (
                    "초대하기"
                  )}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Member Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>팀원 제외</DialogTitle>
              <DialogDescription>
                선택한 팀원을 팀에서 제외하시겠습니까? 이 작업은 되돌릴 수
                없습니다.
              </DialogDescription>
            </DialogHeader>
            {selectedMember && (
              <div className="rounded-md border p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{selectedMember.email}</div>
                  <Badge variant="outline">{selectedMember.role}</Badge>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={isLoading}
              >
                취소
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    제외 중...
                  </>
                ) : (
                  "팀에서 제외"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Migrate Workflows Dialog */}
        <Dialog
          open={isMigrateDialogOpen}
          onOpenChange={setIsMigrateDialogOpen}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>워크플로우 이관</DialogTitle>
              <DialogDescription>
                기존 워크플로우를 이 팀으로 이관합니다.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  팀 소유자의 모든 미소속 워크플로우가 이 팀으로 이관됩니다.
                </AlertDescription>
              </Alert>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsMigrateDialogOpen(false)}
                disabled={isMigrating}
              >
                취소
              </Button>
              <Button onClick={handleMigrateWorkflows} disabled={isMigrating}>
                {isMigrating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    이관 중...
                  </>
                ) : (
                  "워크플로우 이관"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Team Dialog */}
        <Dialog
          open={isCreateTeamDialogOpen}
          onOpenChange={setIsCreateTeamDialogOpen}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>새 팀 생성</DialogTitle>
              <DialogDescription>
                새로운 팀을 생성하여 협업을 시작하세요.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="team-name">
                  팀 이름 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="team-name"
                  placeholder="팀 이름을 입력하세요"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  disabled={isCreatingTeam}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-description">팀 설명</Label>
                <Textarea
                  id="team-description"
                  placeholder="팀에 대한 설명을 입력하세요"
                  value={newTeamDescription}
                  onChange={(e) => setNewTeamDescription(e.target.value)}
                  disabled={isCreatingTeam}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateTeamDialogOpen(false);
                  setNewTeamName("");
                  setNewTeamDescription("");
                }}
                disabled={isCreatingTeam}
              >
                취소
              </Button>
              <Button
                onClick={handleCreateTeam}
                disabled={isCreatingTeam || !newTeamName.trim()}
              >
                {isCreatingTeam ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  "팀 생성"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Share Workflows Dialog */}
        <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
          <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>업무 프로세스 공유</DialogTitle>
              <DialogDescription>
                내 업무 프로세스를 선택하여 팀에 공유합니다.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {userWorkflows.length > 0 && (
                <div className="space-y-2">
                  <Label>공유할 업무 프로세스 선택</Label>
                  <div className="max-h-60 overflow-y-auto rounded-md border p-2">
                    {userWorkflows.map((workflow: any) => (
                      <div
                        key={workflow.workflow_id}
                        className="hover:bg-muted/50 flex items-center space-x-2 rounded p-2"
                      >
                        <Checkbox
                          id={`share-workflow-${workflow.workflow_id}`}
                          checked={selectedWorkflows.includes(
                            workflow.workflow_id.toString(),
                          )}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedWorkflows([
                                ...selectedWorkflows,
                                workflow.workflow_id.toString(),
                              ]);
                            } else {
                              setSelectedWorkflows(
                                selectedWorkflows.filter(
                                  (id) =>
                                    id !== workflow.workflow_id.toString(),
                                ),
                              );
                            }
                          }}
                          disabled={isSharing}
                        />
                        <Label
                          htmlFor={`share-workflow-${workflow.workflow_id}`}
                          className="flex flex-1 cursor-pointer items-center gap-2 text-sm font-normal"
                        >
                          <span className="font-medium">{workflow.title}</span>
                          {workflow.team_id &&
                            workflow.team_id !== "" &&
                            workflow.team_id !== null && (
                              <Badge
                                variant="secondary"
                                className="text-[10px]"
                              >
                                공유됨
                              </Badge>
                            )}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {userWorkflows.length === 0 && (
                <div className="text-muted-foreground flex h-20 items-center justify-center rounded-md border border-dashed text-sm">
                  공유할 업무 프로세스가 없습니다.
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsShareDialogOpen(false);
                  setSelectedWorkflows([]);
                }}
                disabled={isSharing}
              >
                취소
              </Button>
              <Button
                onClick={handleShareWorkflows}
                disabled={isSharing || selectedWorkflows.length === 0}
              >
                {isSharing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    공유 중...
                  </>
                ) : (
                  "확인"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Unshare Confirmation Dialog */}
        <AlertDialog
          open={!!workflowToUnshare}
          onOpenChange={(open) => !open && setWorkflowToUnshare(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>공유를 중지하시겠습니까?</AlertDialogTitle>
              <AlertDialogDescription>
                이 업무 프로세스를 팀에서 제거합니다. 팀원들은 더 이상 이
                프로세스에 접근할 수 없게 됩니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmUnshare}
                className="bg-destructive hover:bg-destructive/90"
              >
                공유 중지
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </div>
  );
}
