/**
 * User Registration Screen Component
 *
 * This component handles new user registration with:
 * - Email and password registration
 * - Form validation for all fields
 * - Terms of service and marketing consent options
 * - Social authentication providers
 * - Success confirmation with email verification instructions
 *
 * The registration flow includes validation, duplicate email checking,
 * and Supabase authentication integration.
 */
import type { Route } from "./+types/join";

import { CheckCircle2, UserPlus, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Form, Link, data, redirect, useNavigation } from "react-router";
import { z } from "zod";

import FormButton from "~/core/components/form-button";
import FormErrors from "~/core/components/form-error";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/core/components/ui/card";
import { Checkbox } from "~/core/components/ui/checkbox";
import { Input } from "~/core/components/ui/input";
import { Label } from "~/core/components/ui/label";

import { SignUpButtons } from "../components/auth-login-buttons";
import { passwordSchema } from "../schemas";

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
      className={`flex items-center gap-1.5 text-xs transition-colors ${
        met ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
      }`}
    >
      {met ? (
        <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <XCircle className="text-muted-foreground/50 size-3.5" />
      )}
      <span>{label}</span>
    </div>
  );
}

/**
 * Meta function for the registration page
 *
 * Sets the page title using the application name from environment variables
 */
export const meta: Route.MetaFunction = () => {
  return [
    {
      title: `Create an account | ${import.meta.env.VITE_APP_NAME}`,
    },
  ];
};

/**
 * Form validation schema for user registration
 *
 * Uses Zod to validate:
 * - Name: Required field
 * - Email: Must be a valid email format
 * - Password: Must be at least 8 characters long
 * - Confirm Password: Must match the password field
 * - Marketing: Boolean for marketing consent (defaults to false)
 * - Terms: Boolean for terms acceptance
 *
 * The schema includes a custom refinement to ensure passwords match
 */
const joinSchema = z
  .object({
    name: z.string().min(1, { message: "Name is required" }),
    email: z.string().email({ message: "Invalid email address" }),
    password: passwordSchema,
    confirmPassword: passwordSchema,
    avatarUrl: z.string().optional(),
    marketing: z.coerce.boolean().default(false),
    terms: z.coerce.boolean(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

/**
 * Server action for handling user registration form submission
 *
 * This function processes the registration form data and attempts to create a new user.
 * The flow is:
 * 1. Parse and validate form data using the join schema
 * 2. Return validation errors if the data is invalid
 * 3. Verify terms of service acceptance
 * 4. Check if a user with the provided email already exists
 * 5. Create a new user with Supabase auth
 * 6. Return success or error response
 *
 * @param request - The form submission request
 * @returns Validation errors, auth errors, or success confirmation
 */
export async function action({ request }: Route.ActionArgs) {
  // Parse form data from the request
  const formData = await request.formData();
  const {
    data: validData,
    success,
    error,
  } = joinSchema.safeParse(Object.fromEntries(formData));

  // Return validation errors if form data is invalid
  if (!success) {
    return data({ fieldErrors: error.flatten().fieldErrors }, { status: 400 });
  }

  // Verify terms of service acceptance
  if (!validData.terms) {
    return data(
      { error: "You must agree to the terms of service" },
      { status: 400 },
    );
  }

  // Check if a user with the provided email already exists
  const { getUserStatus } = await import("../lib/queries.server");
  const userStatus = await getUserStatus(validData.email);

  // Generate signup link using admin client
  const { default: adminClient } = await import(
    "~/core/lib/supa-admin-client.server"
  );
  const { getSiteUrl } = await import("~/core/lib/utils.server");

  // If user exists and is confirmed, return error
  if (userStatus.exists && userStatus.confirmed) {
    return data(
      { error: "이미 가입된 이메일입니다. 로그인을 시도해주세요." },
      { status: 400 },
    );
  }

  // If user exists but NOT confirmed, or doesn't exist, proceed to generate link
  // If unverified, this will effectively resend the verification link

  const { data: linkData, error: signUpError } =
    await adminClient.auth.admin.generateLink({
      type: "signup",
      email: validData.email,
      password: validData.password,
      options: {
        data: {
          name: validData.name,
          avatar_url: validData.avatarUrl,
          marketing_consent: validData.marketing,
        },
        redirectTo: `${getSiteUrl()}/auth/confirm?next=${encodeURIComponent("/login?message=email_verified")}`,
      },
    });

  console.log("Generated Link Data:", linkData);
  console.log("Redirect URL used:", `${getSiteUrl()}/auth/confirm`);

  if (signUpError) {
    console.error("Signup error:", signUpError);
    if (signUpError.status === 429) {
      return data(
        {
          error:
            "회원가입 시도가 너무 많습니다. 잠시 후 다시 시도해주세요. (약 1분 후 자동 해제됩니다)",
        },
        { status: 429 },
      );
    }
    return data({ error: signUpError.message }, { status: 400 });
  }

  // Send welcome email with the generated verification link
  try {
    const { sendWelcomeEmail } = await import(
      "~/features/email/services/email.service"
    );

    if (linkData?.properties?.action_link) {
      await sendWelcomeEmail({
        to: validData.email,
        userName: validData.name,
        verificationUrl: linkData.properties.action_link,
      });
    } else {
      console.error("No action link generated");
    }
  } catch (emailError) {
    console.error("Failed to send welcome email:", emailError);
  }

  // Return success response
  // If it was an existing unverified user, the message implies we sent a verification link
  return redirect("/login?message=signup_success");
}

/**
 * Registration Component
 *
 * This component renders the registration form and handles user interactions.
 * It includes:
 * - Personal information fields (name, email)
 * - Password creation with confirmation
 * - Terms of service and marketing consent checkboxes
 * - Error display for form validation and registration errors
 * - Success confirmation with email verification instructions
 * - Social registration options
 * - Sign in link for existing users
 *
 * @param actionData - Data returned from the form action, including errors or success status
 */
export default function Join({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

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
  const canSubmit = allRequirementsMet && passwordsMatch;

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8">
      <Card className="border-border/50 bg-background/50 w-full max-w-md shadow-lg backdrop-blur-xl transition-all">
        <CardHeader className="flex flex-col items-center space-y-1 pb-6">
          <div className="bg-primary/10 mb-2 rounded-full p-3">
            <UserPlus className="text-primary size-6" />
          </div>
          <CardTitle
            className="text-2xl font-bold tracking-tight"
            role="heading"
          >
            계정 생성
          </CardTitle>
          <CardDescription className="text-muted-foreground text-base">
            정보를 입력하여 서비스를 시작하세요
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <Form className="flex w-full flex-col gap-4" method="post">
            <div className="space-y-2">
              <Label
                htmlFor="name"
                className="text-sm leading-none font-medium"
              >
                이름
              </Label>
              <Input
                id="name"
                name="name"
                required
                type="text"
                placeholder="홍길동"
                className="bg-background"
              />
              {actionData &&
              "fieldErrors" in actionData &&
              actionData.fieldErrors?.name ? (
                <FormErrors errors={actionData.fieldErrors.name} />
              ) : null}
            </div>
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
                placeholder="user@example.com"
                className="bg-background"
              />
              {actionData &&
              "fieldErrors" in actionData &&
              actionData.fieldErrors?.email ? (
                <FormErrors errors={actionData.fieldErrors.email} />
              ) : null}
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-sm leading-none font-medium"
              >
                비밀번호
              </Label>
              <Input
                id="password"
                name="password"
                required
                type="password"
                placeholder="비밀번호 설정"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setShowRequirements(true)}
                className="bg-background"
              />
              {/* Condensed one-line warning message */}
              <p className="text-muted-foreground/80 text-[11px]">
                8자 이상, 영문 대/소문자, 숫자, 특수문자 각 1개 이상 필요
              </p>
              {/* Real-time validation feedback */}
              {showRequirements && password.length > 0 && (
                <div className="bg-muted/50 mt-2 flex flex-wrap gap-x-4 gap-y-1.5 rounded-md p-2">
                  {requirementStatus.map((req) => (
                    <PasswordRequirementIndicator
                      key={req.id}
                      met={req.met}
                      label={req.label}
                    />
                  ))}
                </div>
              )}
              {actionData &&
              "fieldErrors" in actionData &&
              actionData.fieldErrors?.password ? (
                <FormErrors errors={actionData.fieldErrors.password} />
              ) : null}
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="confirmPassword"
                className="text-sm leading-none font-medium"
              >
                비밀번호 확인
              </Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                required
                type="password"
                placeholder="비밀번호 재입력"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-background"
              />
              {/* Password match indicator */}
              {confirmPassword.length > 0 && (
                <div
                  className={`flex items-center gap-1.5 text-xs transition-colors ${
                    passwordsMatch
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive"
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
              {actionData &&
              "fieldErrors" in actionData &&
              actionData.fieldErrors?.confirmPassword ? (
                <FormErrors errors={actionData.fieldErrors.confirmPassword} />
              ) : null}
            </div>

            <div className="space-y-3 rounded-md border p-4">
              <div className="flex items-start gap-2">
                <Checkbox id="marketing" name="marketing" className="mt-0.5" />
                <Label
                  htmlFor="marketing"
                  className="text-muted-foreground text-sm leading-snug font-normal"
                >
                  (선택) 마케팅 이메일 및 프로모션 정보 수신에 동의합니다.
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <Checkbox id="terms" name="terms" checked className="mt-0.5" />
                <Label
                  htmlFor="terms"
                  className="text-muted-foreground text-sm leading-snug font-normal"
                >
                  <span className="text-destructive">*</span>
                  <span>
                    {" "}
                    <Link
                      to="/legal/terms-of-service"
                      viewTransition
                      className="text-foreground hover:text-primary font-medium underline transition-colors"
                    >
                      이용약관
                    </Link>
                    과{" "}
                    <Link
                      to="/legal/privacy-policy"
                      viewTransition
                      className="text-foreground hover:text-primary font-medium underline transition-colors"
                    >
                      개인정보처리방침
                    </Link>
                    을 읽었으며 이에 동의합니다.
                  </span>
                </Label>
              </div>
            </div>

            <FormButton
              label="계정 생성"
              className="w-full font-semibold"
              disabled={!canSubmit || isSubmitting}
            />
            {actionData && "error" in actionData && actionData.error ? (
              <FormErrors errors={[actionData.error]} />
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

          <SignUpButtons />
        </CardContent>
      </Card>
      <div className="flex flex-col items-center justify-center text-sm">
        <p className="text-muted-foreground">
          이미 계정이 있으신가요?{" "}
          <Link
            to="/login"
            viewTransition
            data-testid="form-signin-link"
            className="text-primary hover:text-primary/80 font-medium hover:underline"
          >
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
