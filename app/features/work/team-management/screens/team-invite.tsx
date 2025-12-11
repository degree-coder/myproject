import { CheckCircle, Clock, Users, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { redirect, useNavigate, useParams } from "react-router";

import { Alert, AlertDescription } from "~/core/components/ui/alert";
import { Badge } from "~/core/components/ui/badge";
import { Button } from "~/core/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/core/components/ui/card";

export async function loader({ request }: { request: Request }) {
  const { default: makeServerClient } = await import(
    "~/core/lib/supa-client.server"
  );
  const [client] = makeServerClient(request);
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    const url = new URL(request.url);
    throw redirect(
      `/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`,
    );
  }
  return null;
}

interface InviteInfo {
  team: {
    team_id: string;
    name: string;
    description: string | null;
  };
  invite: {
    email: string;
    role: string;
    expires_at: string;
    is_expired: boolean;
    is_accepted: boolean;
  };
}

export default function TeamInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;

    async function loadInvite() {
      try {
        const res = await fetch(`/api/teams/invites/${token}`);
        if (!res.ok) {
          const err = await res.json();
          setError(err.error || "초대 정보를 불러올 수 없습니다");
          return;
        }
        const data = await res.json();
        setInviteInfo(data);
      } catch (e) {
        setError("초대 정보를 불러오는 중 오류가 발생했습니다");
      } finally {
        setLoading(false);
      }
    }

    loadInvite();
  }, [token]);

  async function handleAccept() {
    if (!token) return;

    setAccepting(true);
    setError(null);

    try {
      const res = await fetch(`/api/teams/invites/${token}/accept`, {
        method: "POST",
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "초대 수락에 실패했습니다");
        return;
      }

      const data = await res.json();
      setSuccess(true);

      // 3초 후 팀 관리 페이지로 이동
      setTimeout(() => {
        navigate(`/work/team-management?team=${data.team_id}`);
      }, 3000);
    } catch (e) {
      setError("초대 수락 중 오류가 발생했습니다");
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <Clock className="text-muted-foreground h-10 w-10 animate-spin" />
              <p className="text-muted-foreground text-sm">
                초대 정보 확인 중...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !inviteInfo) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
        <Card className="border-destructive/50 w-full max-w-md">
          <CardHeader>
            <div className="text-destructive flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              <CardTitle>초대를 찾을 수 없습니다</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              {error ||
                "유효하지 않은 초대 링크입니다. 링크가 만료되었거나 이미 사용되었을 수 있습니다."}
            </p>
            <Button onClick={() => navigate("/work")} className="w-full">
              홈으로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
        <Card className="w-full max-w-md border-emerald-500/50">
          <CardHeader>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500">
              <CheckCircle className="h-5 w-5" />
              <CardTitle>팀 가입 완료!</CardTitle>
            </div>
            <CardDescription>
              <span className="text-foreground font-semibold">
                {inviteInfo.team.name}
              </span>
              에 성공적으로 가입되었습니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              잠시 후 팀 관리 페이지로 이동합니다...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { team, invite } = inviteInfo;

  if (invite.is_accepted) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>이미 수락된 초대</CardTitle>
            <CardDescription>이 초대는 이미 수락되었습니다</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() =>
                navigate(`/work/team-management?team=${team.team_id}`)
              }
              className="w-full"
            >
              팀 관리로 이동
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invite.is_expired) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
        <Card className="border-destructive/50 w-full max-w-md">
          <CardHeader>
            <div className="text-destructive flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              <CardTitle>만료된 초대</CardTitle>
            </div>
            <CardDescription>이 초대는 만료되었습니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              초대 링크가 만료되었습니다. 팀 관리자에게 새 초대를 요청하세요.
            </p>
            <Button
              onClick={() => navigate("/work")}
              className="w-full"
              variant="outline"
            >
              홈으로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 rounded-md p-2">
              <Users className="text-primary h-5 w-5" />
            </div>
            <CardTitle>팀 초대</CardTitle>
          </div>
          <CardDescription>새로운 팀 협업 초대가 도착했습니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2 text-center">
            <h3 className="text-xl font-bold tracking-tight">{team.name}</h3>
            {team.description && (
              <p className="text-muted-foreground text-sm">
                {team.description}
              </p>
            )}
          </div>

          <div className="bg-muted/50 space-y-3 rounded-lg border p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">이메일</span>
              <span className="text-foreground font-medium">
                {invite.email}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">역할</span>
              <Badge variant="outline" className="font-normal">
                {invite.role === "owner"
                  ? "소유자"
                  : invite.role === "admin"
                    ? "관리자"
                    : "사용자"}
              </Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">만료일</span>
              <span className="text-foreground font-medium">
                {new Date(invite.expires_at).toLocaleDateString("ko-KR")}
              </span>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => navigate("/work")}
              variant="outline"
              disabled={accepting}
              className="w-full"
            >
              거절
            </Button>
            <Button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full"
            >
              {accepting ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  수락 중...
                </>
              ) : (
                "초대 수락"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
