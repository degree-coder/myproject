/**
 * Login Screen Component
 *
 * This component handles user authentication via email/password login,
 * social authentication providers, and provides options for password reset
 * and email verification. It demonstrates form validation, error handling,
 * and Supabase authentication integration.
 */
import type { Route } from "./+types/login";

import { AlertCircle, CheckCircle2Icon, Loader2Icon, Play } from "lucide-react";
import { useRef } from "react";
import { Form, Link, data, redirect, useFetcher } from "react-router";
import { z } from "zod";

import FormButton from "~/core/components/form-button";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "~/core/components/ui/alert";
import { Button } from "~/core/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/core/components/ui/card";
import { Input } from "~/core/components/ui/input";
import { Label } from "~/core/components/ui/label";
import makeServerClient from "~/core/lib/supa-client.server";

import FormErrors from "../../../core/components/form-error";
import { SignInButtons } from "../components/auth-login-buttons";

/**
 * Meta function for the login page
 *
 * Sets the page title using the application name from environment variables
 */
export const meta: Route.MetaFunction = () => {
  return [
    {
      title: `Log in | ${import.meta.env.VITE_APP_NAME}`,
    },
  ];
};

/**
 * Form validation schema for login
 *
 * Uses Zod to validate:
 * - Email: Must be a valid email format
 * - Password: Must be at least 8 characters long
 *
 * Error messages are provided for user feedback
 */
const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters long" }),
});

/**
 * Loader function for the login page
 *
 * This function handles URL parameters to display success messages
 * from other authentication flows (e.g., signup completion).
 */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const message = url.searchParams.get("message");

  return { message };
}

/**
 * Server action for handling login form submission
 *
 * This function processes the login form data and attempts to authenticate the user.
 * The flow is:
 * 1. Parse and validate form data using the login schema
 * 2. Return validation errors if the data is invalid
 * 3. Attempt to sign in with Supabase using email/password
 * 4. Return authentication errors if sign-in fails
 * 5. Redirect to home page with auth cookies if successful
 *
 * @param request - The form submission request
 * @returns Validation errors, auth errors, or redirect on success
 */
export async function action({ request }: Route.ActionArgs) {
  // Parse form data from the request
  const formData = await request.formData();
  const {
    data: validData,
    success,
    error,
  } = loginSchema.safeParse(Object.fromEntries(formData));

  // Return validation errors if form data is invalid
  if (!success) {
    return data({ fieldErrors: error.flatten().fieldErrors }, { status: 400 });
  }

  // Supabase 인증 복원
  const [client, headers] = makeServerClient(request);
  const { error: signInError } = await client.auth.signInWithPassword({
    ...validData,
  });

  if (signInError) {
    // Handle rate limiting error
    if (signInError.status === 429) {
      return data(
        {
          error:
            "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요. (약 1분 후 자동 해제됩니다)",
        },
        { status: 429 },
      );
    }
    return data({ error: signInError.message }, { status: 400 });
  }

  // 로그인 성공 후 /work로 리다이렉트
  return redirect("/work", { headers });
}

/**
 * Login Component
 *
 * This component renders the login form and handles user interactions.
 * It includes:
 * - Email and password input fields with validation
 * - Error display for form validation and authentication errors
 * - Password reset link
 * - Email verification resend functionality
 * - Social login options
 * - Sign up link for new users
 *
 * @param actionData - Data returned from the form action, including any errors
 */
export default function Login({
  actionData,
  loaderData,
}: Route.ComponentProps) {
  // Reference to the form element for accessing form data
  const formRef = useRef<HTMLFormElement>(null);

  // Fetcher for submitting the email verification resend request
  const fetcher = useFetcher();

  /**
   * Handler for resending email verification
   *
   * When a user tries to log in with an unverified email, they can click
   * to resend the verification email. This function:
   * 1. Prevents the default button behavior
   * 2. Gets the current form data (email only)
   * 3. Submits it to the resend endpoint
   */
  const onResendClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    formData.delete("password"); // Only need the email for resending verification
    fetcher.submit(formData, {
      method: "post",
      action: "/auth/api/resend",
    });
  };
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8">
      <Card className="border-border/50 bg-background/50 w-full max-w-md shadow-lg backdrop-blur-xl transition-all">
        <CardHeader className="flex flex-col items-center space-y-1 pb-6">
          <div className="bg-primary/10 mb-2 rounded-full p-3">
            <KeyIcon className="text-primary size-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            로그인
          </CardTitle>
          <CardDescription className="text-muted-foreground text-base">
            계정 정보를 입력해주세요
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {/* Success message for signup completion */}
          {loaderData?.message === "signup_success" && (
            <Alert className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400">
              <CheckCircle2Icon className="size-4" />
              <AlertTitle>회원가입 완료!</AlertTitle>
              <AlertDescription>
                계정 생성이 완료되었습니다. 이메일을 확인한 후 로그인해주세요.
              </AlertDescription>
            </Alert>
          )}
          {/* Success message for email verification */}
          {loaderData?.message === "email_verified" && (
            <Alert className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400">
              <CheckCircle2Icon className="size-4" />
              <AlertTitle>이메일 인증 완료!</AlertTitle>
              <AlertDescription>
                이메일 인증이 성공적으로 완료되었습니다. 이제 로그인해주세요.
              </AlertDescription>
            </Alert>
          )}
          <Form
            className="flex w-full flex-col gap-4"
            method="post"
            ref={formRef}
          >
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                이메일
              </Label>
              <Input
                id="email"
                name="email"
                required
                type="email"
                placeholder="email@example.com"
                className="bg-background"
              />
              {actionData &&
              "fieldErrors" in actionData &&
              actionData.fieldErrors.email ? (
                <FormErrors errors={actionData.fieldErrors.email} />
              ) : null}
            </div>
            <div className="space-y-2">
              <div className="flex w-full items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-sm leading-none font-medium"
                >
                  비밀번호
                </Label>
                <Link
                  to="/auth/forgot-password/reset"
                  className="text-primary hover:text-primary/80 text-xs font-medium hover:underline"
                  tabIndex={-1}
                  viewTransition
                >
                  비밀번호 찾기
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                required
                type="password"
                placeholder="비밀번호를 입력해주세요"
                className="bg-background"
              />

              {actionData &&
              "fieldErrors" in actionData &&
              actionData.fieldErrors.password ? (
                <FormErrors errors={actionData.fieldErrors.password} />
              ) : null}
            </div>
            <FormButton label="로그인" className="w-full font-semibold" />
            {actionData && "error" in actionData ? (
              actionData.error === "Email not confirmed" ? (
                <Alert variant="destructive" className="bg-destructive/10">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>이메일 확인 필요</AlertTitle>
                  <AlertDescription className="flex flex-col items-start gap-2">
                    로그인 전에 이메일을 확인해주세요.
                    <Button
                      variant="outline"
                      className="text-foreground flex items-center justify-between gap-2"
                      onClick={onResendClick}
                    >
                      확인 이메일 재전송
                      {fetcher.state === "submitting" ? (
                        <Loader2Icon
                          data-testid="resend-confirmation-email-spinner"
                          className="size-4 animate-spin"
                        />
                      ) : null}
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : (
                <FormErrors errors={[String(actionData.error)]} />
              )
            ) : null}
          </Form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background text-muted-foreground px-2">
                또는
              </span>
            </div>
          </div>

          <SignInButtons />
        </CardContent>
      </Card>
      <div className="flex flex-col items-center justify-center gap-4 text-sm">
        <p className="text-muted-foreground">
          계정이 없으신가요?{" "}
          <Link
            to="/join"
            viewTransition
            data-testid="form-signup-link"
            className="text-primary hover:text-primary/80 font-medium hover:underline"
          >
            회원가입
          </Link>
        </p>
        <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/50 px-4 py-2 dark:border-indigo-900 dark:bg-indigo-950/20">
          <Play className="size-4 text-indigo-600 dark:text-indigo-400" />
          <p className="text-muted-foreground">
            <Link
              to="/demo"
              viewTransition
              className="font-medium text-indigo-600 underline transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              로그인 없이 데모 체험하기
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// Icon component
function KeyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.6 9.6" />
      <path d="m15.5 7.5 3 3L22 7l-3-3" />
    </svg>
  );
}
