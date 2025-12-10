import type { Route } from "@rr/app/features/users/api/+types/delete-account";

import { AlertTriangle, Loader2Icon } from "lucide-react";
import { useFetcher } from "react-router";

import FormErrors from "~/core/components/form-error";
import { Button } from "~/core/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/core/components/ui/card";
import { Checkbox } from "~/core/components/ui/checkbox";
import { Label } from "~/core/components/ui/label";

export default function DeleteAccountForm() {
  const fetcher = useFetcher<Route.ComponentProps["actionData"]>();
  return (
    <Card className="border-destructive/30 bg-destructive/5 dark:bg-destructive/10 w-full">
      <CardHeader>
        <div className="text-destructive flex items-center gap-2">
          <AlertTriangle className="size-5" />
          <CardTitle>계정 삭제</CardTitle>
        </div>
        <CardDescription>
          계정을 삭제하면 모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <fetcher.Form method="delete" className="space-y-6" action="/api/users">
          <div className="border-destructive/20 bg-background/50 space-y-4 rounded-md border p-4">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="confirm-delete"
                name="confirm-delete"
                required
                className="border-muted-foreground data-[state=checked]:border-destructive data-[state=checked]:bg-destructive mt-0.5"
              />
              <Label htmlFor="confirm-delete" className="leading-snug">
                계정을 삭제하는 것에 동의합니다.
              </Label>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="confirm-irreversible"
                name="confirm-irreversible"
                required
                className="border-muted-foreground data-[state=checked]:border-destructive data-[state=checked]:bg-destructive mt-0.5"
              />
              <Label htmlFor="confirm-irreversible" className="leading-snug">
                삭제된 데이터는 복구할 수 없음을 이해합니다.
              </Label>
            </div>
          </div>

          <Button
            variant="destructive"
            className="w-full sm:w-auto"
            disabled={fetcher.state === "submitting"}
          >
            {fetcher.state === "submitting" ? (
              <>
                <Loader2Icon className="mr-2 size-4 animate-spin" />
                삭제 중...
              </>
            ) : (
              "계정 영구 삭제"
            )}
          </Button>
          {fetcher.data?.error ? (
            <FormErrors errors={[fetcher.data.error]} />
          ) : null}
        </fetcher.Form>
      </CardContent>
    </Card>
  );
}
