import { type Route } from "@rr/app/features/users/api/+types/edit-profile";
import { Camera, UserIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

import FetcherFormButton from "~/core/components/fetcher-form-button";
import FormErrors from "~/core/components/form-error";
import FormSuccess from "~/core/components/form-success";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "~/core/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/core/components/ui/card";
import { Checkbox } from "~/core/components/ui/checkbox";
import { Input } from "~/core/components/ui/input";
import { Label } from "~/core/components/ui/label";

export default function EditProfileForm({
  name,
  avatarUrl,
  marketingConsent,
}: {
  name: string;
  marketingConsent: boolean;
  avatarUrl: string | null;
}) {
  const fetcher = useFetcher<Route.ComponentProps["actionData"]>();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (fetcher.data && "success" in fetcher.data && fetcher.data.success) {
      formRef.current?.blur();
      formRef.current?.querySelectorAll("input").forEach((input) => {
        input.blur();
      });
    }
  }, [fetcher.data]);
  const [avatar, setAvatar] = useState<string | null>(avatarUrl);
  const onChangeAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatar(URL.createObjectURL(file));
    }
  };
  return (
    <fetcher.Form
      method="post"
      className="w-full"
      encType="multipart/form-data"
      ref={formRef}
      action="/api/users/profile"
    >
      <Card>
        <CardHeader>
          <CardTitle>프로필 정보</CardTitle>
          <CardDescription>
            서비스에서 사용되는 기본 프로필 정보를 관리합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="flex flex-col items-center gap-3">
              <div className="group relative">
                <Avatar className="border-border size-24 cursor-pointer border-2 transition-opacity group-hover:opacity-80">
                  {avatar ? (
                    <AvatarImage
                      src={avatar}
                      alt="프로필 이미지"
                      className="object-cover"
                    />
                  ) : null}
                  <AvatarFallback className="bg-muted">
                    <UserIcon className="text-muted-foreground size-10" />
                  </AvatarFallback>
                </Avatar>
                <div className="pointer-events-none absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="size-6 text-white" />
                </div>
                <Input
                  id="avatar"
                  name="avatar"
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  onChange={onChangeAvatar}
                  aria-label="프로필 사진 변경"
                />
              </div>
              <p className="text-muted-foreground text-xs">프로필 사진 변경</p>
            </div>

            <div className="w-full flex-1 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">이름</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  type="text"
                  placeholder="이름을 입력하세요"
                  defaultValue={name}
                  className="max-w-md"
                />
                {fetcher.data &&
                "fieldErrors" in fetcher.data &&
                fetcher.data.fieldErrors?.name ? (
                  <FormErrors errors={fetcher.data?.fieldErrors?.name} />
                ) : null}
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">
                  이미지 업로드 가이드
                </Label>
                <ul className="text-muted-foreground list-inside list-disc space-y-1 text-xs">
                  <li>최대 크기: 1MB</li>
                  <li>지원 형식: PNG, JPG, GIF, WEBP</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-muted/30 flex items-start space-x-2 rounded-md border p-4">
            <Checkbox
              id="marketingConsent"
              name="marketingConsent"
              defaultChecked={marketingConsent}
              className="mt-0.5"
            />
            <div className="space-y-1 leading-none">
              <Label
                htmlFor="marketingConsent"
                className="cursor-pointer font-medium"
              >
                마케팅 정보 수신 동의
              </Label>
              <p className="text-muted-foreground text-sm">
                이벤트, 프로모션 등 다양한 마케팅 소식을 이메일로
                받아보시겠습니까?
              </p>
            </div>
          </div>
          {fetcher.data &&
          "fieldErrors" in fetcher.data &&
          fetcher.data.fieldErrors?.marketingConsent ? (
            <FormErrors errors={fetcher.data?.fieldErrors?.marketingConsent} />
          ) : null}
        </CardContent>
        <CardFooter className="bg-muted/10 flex flex-col gap-4 border-t px-6 py-4 sm:flex-row sm:justify-end">
          {fetcher.data && "success" in fetcher.data && fetcher.data.success ? (
            <FormSuccess
              message="프로필이 저장되었습니다."
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
            submitting={fetcher.state === "submitting"}
            label="변경사항 저장"
            className="w-full sm:w-auto"
            variant="default"
          />
        </CardFooter>
      </Card>
    </fetcher.Form>
  );
}
