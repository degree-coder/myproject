import type { Route } from "@rr/app/features/users/api/+types/change-email";

import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";

import FetcherFormButton from "~/core/components/fetcher-form-button";
import FormErrors from "~/core/components/form-error";
import FormSuccess from "~/core/components/form-success";
import { CardContent, CardFooter } from "~/core/components/ui/card";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/core/components/ui/card";
import { Input } from "~/core/components/ui/input";
import { Label } from "~/core/components/ui/label";

export default function ChangeEmailForm({ email }: { email: string }) {
  const fetcher = useFetcher<Route.ComponentProps["actionData"]>();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (fetcher.data && "success" in fetcher.data && fetcher.data.success) {
      formRef.current?.reset();
      formRef.current?.blur();
      formRef.current?.querySelectorAll("input").forEach((input) => {
        if (!input.disabled) {
          input.blur();
        }
      });
    }
  }, [fetcher.data]);
  return (
    <fetcher.Form
      ref={formRef}
      method="post"
      className="w-full"
      action="/api/users/email"
    >
      <Card>
        <CardHeader>
          <CardTitle>{email ? "이메일 변경" : "이메일 추가"}</CardTitle>
          <CardDescription>
            {email
              ? "현재 등록된 이메일 주소를 변경합니다."
              : "계정에 새 이메일 주소를 추가합니다."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex w-full flex-col gap-6 sm:flex-row sm:items-start">
            <div className="w-full flex-1 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentEmail">현재 이메일</Label>
                <Input
                  id="currentEmail"
                  name="currentEmail"
                  required
                  type="email"
                  disabled
                  value={email}
                  className="bg-muted text-muted-foreground max-w-md opacity-100" // Opacity reset for better readability
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">새 이메일</Label>
                <Input
                  id="email"
                  name="email"
                  required
                  type="email"
                  placeholder="새로운 이메일 주소를 입력하세요"
                  className="max-w-md"
                />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/10 flex flex-col gap-4 border-t px-6 py-4 sm:flex-row sm:justify-end">
          {fetcher.data && "success" in fetcher.data && fetcher.data.success ? (
            <FormSuccess
              message="이메일 변경을 위한 확인 메일이 발송되었습니다."
              className="mr-auto w-full sm:w-auto"
            />
          ) : null}
          {fetcher.data && "error" in fetcher.data && fetcher.data.error ? (
            <FormErrors
              errors={[fetcher.data.error]}
              className="mr-auto w-full sm:w-auto"
            />
          ) : null}

          <FetcherFormButton
            label={email ? "이메일 변경" : "이메일 추가"}
            className="w-full sm:w-auto"
            submitting={fetcher.state === "submitting"}
            disabled={fetcher.state === "submitting"}
          />
        </CardFooter>
      </Card>
    </fetcher.Form>
  );
}
