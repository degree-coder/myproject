/**
 * Password Reset Request Screen Component
 *
 * This component handles the first step of the password reset flow:
 * allowing users to request a password reset link via email.
 *
 * The component includes:
 * - Email input field with validation
 * - Form submission handling
 * - Success confirmation after sending reset link
 * - Error handling for invalid emails or server issues
 */
import type { Route } from "./+types/forgot-password";

import { CheckCircle2, KeyRound } from "lucide-react";
import { useEffect, useRef } from "react";
import { Form, Link, data } from "react-router";
import { z } from "zod";

import FormButton from "~/core/components/form-button";
import FormErrors from "~/core/components/form-error";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "~/core/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/core/components/ui/card";
import { Input } from "~/core/components/ui/input";
import { Label } from "~/core/components/ui/label";

/**
 * Meta function for the forgot password page
 *
 * Sets the page title using the application name from environment variables
 */
export const meta: Route.MetaFunction = () => {
  return [
    {
      title: `Forgot Password | ${import.meta.env.VITE_APP_NAME}`,
    },
  ];
};

/**
 * Form validation schema for password reset request
 *
 * Uses Zod to validate the email field to ensure it's a valid email format
 * before attempting to send a reset link
 */
const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

/**
 * Server action for handling password reset request form submission
 *
 * This function processes the form data and attempts to send a password reset email.
 * The flow is:
 * 1. Parse and validate the email using the schema
 * 2. Return validation errors if the email is invalid
 * 3. Request a password reset email from Supabase auth
 * 4. Return success or error response
 *
 * Note: For security reasons, this endpoint returns success even if the email
 * doesn't exist in the system, to prevent email enumeration attacks.
 *
 * @param request - The form submission request
 * @returns Validation errors, auth errors, or success confirmation
 */
export async function action({ request }: Route.ActionArgs) {
  // Parse and validate form data
  const formData = await request.formData();
  const result = forgotPasswordSchema.safeParse(Object.fromEntries(formData));

  // Return validation errors if email is invalid
  if (!result.success) {
    return data(
      { fieldErrors: result.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // Generate password reset link using admin client
  const { default: adminClient } = await import(
    "~/core/lib/supa-admin-client.server"
  );
  const { getSiteUrl } = await import("~/core/lib/utils.server");

  const { data: linkData, error: resetError } =
    await adminClient.auth.admin.generateLink({
      type: "recovery",
      email: result.data.email,
      options: {
        redirectTo: `${getSiteUrl()}/auth/forgot-password/create`,
      },
    });

  // Handle rate limiting error or other errors
  if (resetError) {
    if (resetError.status === 429) {
      return data(
        {
          error:
            "요청이 너무 많습니다. 잠시 후 다시 시도해주세요. (잠시 기다려주시면 자동으로 해제됩니다)",
        },
        { status: 429 },
      );
    }
    // For security, we might want to hide other errors, but for now let's log them
    console.error("Reset password error:", resetError);
    // Return success to prevent enumeration even on error?
    // Usually we want to be vague, but if it's a system error we might want to know.
    // Let's stick to the pattern: return success unless it's a rate limit.
  }

  // Send password reset email with the generated link
  if (linkData?.properties?.action_link) {
    try {
      const { sendPasswordResetEmail } = await import(
        "~/features/email/services/email.service"
      );

      await sendPasswordResetEmail({
        to: result.data.email,
        resetUrl: linkData.properties.action_link,
      });
    } catch (emailError) {
      console.error("Failed to send password reset email:", emailError);
      // We still return success to the user to prevent enumeration
    }
  }

  // Always return success to prevent user enumeration attacks
  return { success: true };
}

/**
 * Password Reset Request Component
 *
 * This component renders the form for requesting a password reset link.
 * It includes:
 * - Email input field with validation
 * - Submit button for requesting the reset link
 * - Error display for validation and server errors
 * - Success confirmation message after sending the reset link
 *
 * @param actionData - Data returned from the form action, including errors or success status
 */
export default function ForgotPassword({ actionData }: Route.ComponentProps) {
  // Reference to the form element for resetting after successful submission
  const formRef = useRef<HTMLFormElement>(null);

  // Reset the form when the reset link is successfully sent
  useEffect(() => {
    if (actionData && "success" in actionData && actionData.success) {
      formRef.current?.reset();
      formRef.current?.blur();
    }
  }, [actionData]);
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8">
      <Card className="border-border/50 bg-background/50 w-full max-w-md shadow-lg backdrop-blur-xl transition-all">
        <CardHeader className="flex flex-col items-center space-y-1 pb-6">
          <div className="bg-primary/10 mb-2 rounded-full p-3">
            <KeyRound className="text-primary size-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            비밀번호 찾기
          </CardTitle>
          <CardDescription className="text-muted-foreground text-center text-base">
            가입한 이메일을 입력하시면 비밀번호 재설정 링크를 보내드립니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <Form
            className="flex w-full flex-col gap-4"
            method="post"
            ref={formRef}
          >
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-sm leading-none font-medium"
              >
                이메일
              </Label>
              <Input
                id="email"
                name="email"
                required
                type="email"
                placeholder="name@example.com"
                className="bg-background"
              />
              {actionData &&
              "fieldErrors" in actionData &&
              actionData.fieldErrors.email ? (
                <FormErrors errors={actionData.fieldErrors.email} />
              ) : null}
            </div>

            <FormButton
              label="재설정 링크 보내기"
              className="w-full font-semibold"
            />

            {actionData && "error" in actionData && actionData.error ? (
              <FormErrors errors={[actionData.error]} />
            ) : null}

            {actionData &&
            "success" in actionData &&
            actionData.success === true ? (
              <Alert className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
                <AlertTitle>발송 완료</AlertTitle>
                <AlertDescription>
                  이메일로 재설정 링크가 발송되었습니다. 메일함을 확인해주세요.
                </AlertDescription>
              </Alert>
            ) : null}
          </Form>
        </CardContent>
      </Card>
      <div className="flex flex-col items-center justify-center text-sm">
        <p>
          <Link
            to="/login"
            viewTransition
            className="text-primary hover:text-primary/80 font-medium hover:underline"
          >
            로그인 페이지로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  );
}
