/**
 * New Password Screen Component
 *
 * This component handles the second step of the password reset flow:
 * allowing users to create a new password after clicking a reset link.
 *
 * The component includes:
 * - Password and confirmation input fields with validation
 * - Form submission handling
 * - Success confirmation after updating password
 * - Error handling for validation issues or server errors
 */
import type { Route } from "./+types/new-password";

import { CheckCircle2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { redirect, useNavigate } from "react-router";
import { Form, data, useLoaderData } from "react-router";
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
import { Input } from "~/core/components/ui/input";
import { Label } from "~/core/components/ui/label";
import { supabaseBrowser } from "~/core/lib/supa-client.client";

import { passwordSchema } from "../schemas";

/**
 * Meta function for the new password page
 *
 * Sets the page title using the application name from environment variables
 */
export const meta: Route.MetaFunction = () => {
  return [
    {
      title: `Update password | ${import.meta.env.VITE_APP_NAME}`,
    },
  ];
};

/**
 * Form validation schema for password update
 *
 * Uses Zod to validate:
 * - Password: Must be at least 8 characters long
 * - Confirm Password: Must match the password field
 *
 * The schema includes a custom refinement to ensure passwords match
 */
const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

/**
 * Server action for handling password update form submission
 *
 * This function processes the form data and attempts to update the user's password.
 * The flow is:
 * 1. Verify the user is authenticated (has clicked the reset link)
 * 2. Parse and validate the new password using the schema
 * 3. Return validation errors if the data is invalid
 * 4. Update the user's password with Supabase auth
 * 5. Return success or error response
 *
 * @param request - The form submission request
 * @returns Validation errors, auth errors, or success confirmation
 */
// Server action removed as we are using client-side submission
export async function action({ request }: Route.ActionArgs) {
  return {};
}

/**
 * Password Update Component
 *
 * This component renders the form for creating a new password after a reset.
 * It includes:
 * - Password input field with validation
 * - Password confirmation field with matching validation
 * - Submit button for updating the password
 * - Error display for validation and server errors
 * - Success confirmation message after updating the password
 *
 * @param actionData - Data returned from the form action, including errors or success status
 */
export default function ChangePassword({ actionData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const data = Object.fromEntries(formData);

    const result = updatePasswordSchema.safeParse(data);

    if (!result.success) {
      const firstError = result.error.flatten().fieldErrors;
      // Just show the first error for simplicity or handle field errors better
      const errorMessage = Object.values(firstError).flat()[0];
      setError(errorMessage || "Invalid input");
      setIsLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabaseBrowser.auth.updateUser({
        password: result.data.password,
      });

      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess(true);
        formRef.current?.reset();
        // Redirect to login page after 2 seconds
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-center">
          <CardTitle className="text-2xl font-semibold">
            비밀번호 변경
          </CardTitle>
          <CardDescription className="text-center text-base">
            새로운 비밀번호를 입력해주세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form
            className="flex w-full flex-col gap-4"
            onSubmit={handleSubmit}
            ref={formRef}
          >
            <div className="flex flex-col items-start space-y-2">
              <Label htmlFor="name" className="flex flex-col items-start gap-1">
                새 비밀번호 (New Password)
              </Label>
              <Input
                id="password"
                name="password"
                required
                type="password"
                placeholder="새 비밀번호 입력"
              />
            </div>
            <div className="flex flex-col items-start space-y-2">
              <Label htmlFor="name" className="flex flex-col items-start gap-1">
                비밀번호 확인 (Confirm Password)
              </Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                required
                type="password"
                placeholder="비밀번호 재입력"
              />
            </div>
            <FormButton label="비밀번호 변경하기" isLoading={isLoading} />
            {error ? <FormErrors errors={[error]} /> : null}
            {success ? (
              <div className="flex items-center justify-center gap-2 text-sm text-green-500">
                <CheckCircle2Icon className="size-4" />
                <p>비밀번호가 성공적으로 변경되었습니다.</p>
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
