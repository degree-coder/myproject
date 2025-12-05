import type { Route } from "@rr/app/features/users/api/+types/change-password";

import { CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";

import FetcherFormButton from "~/core/components/fetcher-form-button";
import FormErrors from "~/core/components/form-error";
import FormSuccess from "~/core/components/form-success";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/core/components/ui/card";
import { Input } from "~/core/components/ui/input";
import { Label } from "~/core/components/ui/label";

// Password requirement validation functions
const passwordRequirements = [
  { id: "length", label: "8자 이상", test: (pw: string) => pw.length >= 8 },
  {
    id: "uppercase",
    label: "영문 대문자",
    test: (pw: string) => /[A-Z]/.test(pw),
  },
  {
    id: "lowercase",
    label: "영문 소문자",
    test: (pw: string) => /[a-z]/.test(pw),
  },
  { id: "number", label: "숫자", test: (pw: string) => /[0-9]/.test(pw) },
  {
    id: "special",
    label: "특수문자",
    test: (pw: string) => /[^A-Za-z0-9]/.test(pw),
  },
];

function PasswordRequirementIndicator({
  met,
  label,
}: {
  met: boolean;
  label: string;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 text-xs ${
        met
          ? "text-green-600 dark:text-green-400"
          : "text-slate-500 dark:text-slate-400"
      }`}
    >
      {met ? (
        <CheckCircle2 className="size-3.5 text-green-600 dark:text-green-400" />
      ) : (
        <XCircle className="size-3.5 text-slate-400 dark:text-slate-500" />
      )}
      <span>{label}</span>
    </div>
  );
}

export default function ChangePasswordForm({
  hasPassword,
}: {
  hasPassword: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const fetcher = useFetcher<Route.ComponentProps["actionData"]>();

  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showRequirements, setShowRequirements] = useState(false);

  // Check each password requirement
  const requirementStatus = useMemo(() => {
    return passwordRequirements.map((req) => ({
      ...req,
      met: req.test(password),
    }));
  }, [password]);

  // Check if all requirements are met
  const allRequirementsMet = useMemo(() => {
    return requirementStatus.every((req) => req.met);
  }, [requirementStatus]);

  // Check if passwords match
  const passwordsMatch =
    password === confirmPassword && confirmPassword.length > 0;

  // Enable submit only when all requirements are met and passwords match
  // If user has existing password, current password must also be provided
  const canSubmit = hasPassword
    ? allRequirementsMet && passwordsMatch && currentPassword.length > 0
    : allRequirementsMet && passwordsMatch;

  useEffect(() => {
    if (fetcher.data && "success" in fetcher.data && fetcher.data.success) {
      formRef.current?.reset();
      formRef.current?.blur();
      formRef.current?.querySelectorAll("input").forEach((input) => {
        input.blur();
      });
      setCurrentPassword("");
      setPassword("");
      setConfirmPassword("");
      setShowRequirements(false);
    }
  }, [fetcher.data]);
  return (
    <fetcher.Form
      ref={formRef}
      method="post"
      className="w-full max-w-screen-md"
      action="/api/users/password"
    >
      <Card className="overflow-hidden rounded-2xl border border-white/20 bg-white/40 shadow-xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/40">
        <CardHeader>
          <CardTitle>
            {hasPassword ? "비밀번호 변경" : "비밀번호 설정"}
          </CardTitle>
          <CardDescription>
            {hasPassword
              ? "현재 비밀번호를 새로운 비밀번호로 변경합니다."
              : "계정에 새 비밀번호를 설정합니다."}
          </CardDescription>
        </CardHeader>
        {/* Hidden field to indicate if user has existing password */}
        <input
          type="hidden"
          name="hasExistingPassword"
          value={hasPassword.toString()}
        />
        <CardContent>
          <div className="flex w-full flex-col gap-7">
            {/* Current password field - only shown if user has existing password */}
            {hasPassword && (
              <div className="flex flex-col items-start space-y-2">
                <Label
                  htmlFor="currentPassword"
                  className="flex flex-col items-start gap-1"
                >
                  현재 비밀번호
                </Label>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  required
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="현재 비밀번호를 입력하세요"
                />
                {fetcher.data &&
                "fieldErrors" in fetcher.data &&
                (fetcher.data.fieldErrors as Record<string, string[]>)
                  ?.currentPassword ? (
                  <FormErrors
                    errors={
                      (fetcher.data.fieldErrors as Record<string, string[]>)
                        .currentPassword
                    }
                  />
                ) : null}
              </div>
            )}
            <div className="flex flex-col items-start space-y-2">
              <Label
                htmlFor="password"
                className="flex flex-col items-start gap-1"
              >
                새 비밀번호
              </Label>
              <Input
                id="password"
                name="password"
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setShowRequirements(true)}
              />
              {/* Condensed one-line warning message */}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                8자 이상, 영문 대/소문자, 숫자, 특수문자 각 1개 이상 포함
              </p>
              {/* Real-time validation feedback */}
              {showRequirements && password.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                  {requirementStatus.map((req) => (
                    <PasswordRequirementIndicator
                      key={req.id}
                      met={req.met}
                      label={req.label}
                    />
                  ))}
                </div>
              )}
              {fetcher.data &&
              "fieldErrors" in fetcher.data &&
              (fetcher.data.fieldErrors as Record<string, string[]>)
                ?.password ? (
                <FormErrors
                  errors={
                    (fetcher.data.fieldErrors as Record<string, string[]>)
                      .password
                  }
                />
              ) : null}
            </div>
            <div className="flex flex-col items-start space-y-2">
              <Label
                htmlFor="confirmPassword"
                className="flex flex-col items-start gap-1"
              >
                새 비밀번호 확인
              </Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                required
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {/* Password match indicator */}
              {confirmPassword.length > 0 && (
                <div
                  className={`flex items-center gap-1.5 text-xs ${
                    passwordsMatch
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-500 dark:text-red-400"
                  }`}
                >
                  {passwordsMatch ? (
                    <>
                      <CheckCircle2 className="size-3.5" />
                      <span>비밀번호가 일치합니다</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="size-3.5" />
                      <span>비밀번호가 일치하지 않습니다</span>
                    </>
                  )}
                </div>
              )}
              {fetcher.data &&
              "fieldErrors" in fetcher.data &&
              (fetcher.data.fieldErrors as Record<string, string[]>)
                ?.confirmPassword ? (
                <FormErrors
                  errors={
                    (fetcher.data.fieldErrors as Record<string, string[]>)
                      .confirmPassword
                  }
                />
              ) : null}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <FetcherFormButton
            label={hasPassword ? "비밀번호 변경" : "비밀번호 설정"}
            className="w-full"
            submitting={fetcher.state === "submitting"}
            disabled={!canSubmit || fetcher.state === "submitting"}
          />
          {fetcher.data && "success" in fetcher.data && fetcher.data.success ? (
            <FormSuccess message="비밀번호가 변경되었습니다" />
          ) : null}
          {fetcher.data && "error" in fetcher.data && fetcher.data.error ? (
            <FormErrors errors={[fetcher.data.error]} />
          ) : null}
        </CardFooter>
      </Card>
    </fetcher.Form>
  );
}
