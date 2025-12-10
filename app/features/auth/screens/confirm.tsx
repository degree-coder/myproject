/**
 * Email Confirmation Screen
 *
 * This component handles the verification of various email-related actions:
 * - Email verification for new accounts
 * - Password recovery confirmation
 * - Email change confirmation
 *
 * When users click on links in verification emails sent by Supabase, they are
 * directed to this page with a token hash and type parameter. This component
 * verifies the token with Supabase and completes the respective action.
 *
 * This is a critical security component that ensures email ownership before
 * completing sensitive account actions.
 */
import type { Route } from "./+types/confirm";

import { useEffect, useState } from "react";
import { data, redirect, useNavigate } from "react-router";
import { z } from "zod";

import { supabaseBrowser } from "~/core/lib/supa-client.client";
import makeServerClient from "~/core/lib/supa-client.server";

/**
 * Meta function for the confirmation page
 *
 * Sets the page title using the application name from environment variables
 */
export const meta: Route.MetaFunction = () => {
  return [
    {
      title: `Confirm | ${import.meta.env.VITE_APP_NAME}`,
    },
  ];
};

/**
 * Schema for validating URL parameters in the confirmation link
 *
 * The schema validates three key parameters:
 * - token_hash: The verification token provided by Supabase
 * - type: The type of confirmation (email verification, password recovery, or email change)
 * - next: The URL to redirect to after successful confirmation (defaults to home page)
 */
const searchParamsSchema = z.object({
  token_hash: z.string().optional(),
  type: z.enum(["email", "recovery", "email_change", "signup"]).optional(),
  code: z.string().optional(),
  next: z.string().default("/"),
});

export async function loader({ request }: Route.LoaderArgs) {
  const { searchParams } = new URL(request.url);

  const { success, data: validData } = searchParamsSchema.safeParse(
    Object.fromEntries(searchParams),
  );

  if (!success) {
    return data({ error: "Invalid confirmation code" }, { status: 400 });
  }

  const [client, headers] = makeServerClient(request);

  // Handle PKCE code exchange
  if (validData.code) {
    const { error } = await client.auth.exchangeCodeForSession(validData.code);
    if (error) {
      return data({ error: error.message }, { status: 400 });
    }
    return redirect(validData.next, { headers });
  }

  // Handle Token Hash (OTP) verification
  if (validData.token_hash && validData.type) {
    const { error, data: verifyOtpData } = await client.auth.verifyOtp({
      token_hash: validData.token_hash,
      type: validData.type,
    });

    if (error) {
      return data({ error: error.message }, { status: 400 });
    }

    if (validData.type === "email_change") {
      // 이메일 변경 완료 메시지와 함께 리다이렉트
      const message = "이메일이 성공적으로 변경되었습니다";
      return redirect(
        `${validData.next}?message=${encodeURIComponent(message)}`,
        { headers },
      );
    }

    return redirect(validData.next, { headers });
  }

  return data({ error: "Invalid confirmation link" }, { status: 400 });
}

/**
 * Email Confirmation Component
 *
 * This component is only rendered if there's an error during the confirmation process.
 * Under normal circumstances, the loader function will redirect the user directly to
 * the next URL after successful confirmation before this component is rendered.
 *
 * If there's an error (e.g., expired token, invalid token, already confirmed),
 * this component displays the error message to inform the user about the failure.
 *
 * @param loaderData - Data from the loader containing any error messages
 */
export default function Confirm({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    // Check if we have a hash with access_token (Implicit Flow)
    if (window.location.hash && window.location.hash.includes("access_token")) {
      setIsVerifying(true);

      // The Supabase client automatically parses the hash and sets the session
      // We just need to wait for it and then redirect
      supabaseBrowser.auth.onAuthStateChange((event, session) => {
        if (session) {
          // Get 'next' from search params
          const params = new URLSearchParams(window.location.search);
          const next = params.get("next") || "/";
          navigate(next);
        }
      });
    }
  }, [navigate]);

  if (isVerifying) {
    return (
      <div className="flex flex-col items-center justify-center gap-2.5">
        <h1 className="text-2xl font-semibold">Verifying...</h1>
        <p className="text-muted-foreground">
          Please wait while we verify your email.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2.5">
      {/* Display error heading */}
      <h1 className="text-2xl font-semibold">Confirmation failed</h1>
      {/* Display specific error message from Supabase */}
      <p className="text-muted-foreground">{loaderData.error}</p>
    </div>
  );
}
