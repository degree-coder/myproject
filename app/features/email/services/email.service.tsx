import { render } from "@react-email/render";
import { Resend } from "resend";

import ResetPasswordEmail from "~/transactional-emails/emails/reset-password";
import TeamInviteEmail from "~/transactional-emails/emails/team-invite";
import WelcomeEmail from "~/transactional-emails/emails/welcome";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendWelcomeEmailParams {
  to: string;
  userName?: string;
  verificationUrl?: string;
}

export async function sendWelcomeEmail({
  to,
  userName,
  verificationUrl,
}: SendWelcomeEmailParams) {
  try {
    // Generate email HTML using React Email
    const emailHtml = await render(
      <WelcomeEmail userName={userName} verificationUrl={verificationUrl} />,
    );

    const { data, error } = await resend.emails.send({
      from: "Synchro <onboarding@send.mail.synchro.it.com>",
      to: [to],
      subject: "[Synchro] 가입을 환영합니다",
      html: emailHtml,
      replyTo: "support@send.mail.synchro.it.com",
    });

    if (error) {
      console.error("Email send error:", error);
      throw new Error(`Failed to send welcome email: ${error.message}`);
    }

    console.log("Welcome email sent successfully:", data);
    return { success: true, data };
  } catch (error) {
    console.error("Welcome email service error:", error);
    throw error;
  }
}

interface SendPasswordResetEmailParams {
  to: string;
  userName?: string;
  resetUrl?: string;
}

export async function sendPasswordResetEmail({
  to,
  userName,
  resetUrl,
}: SendPasswordResetEmailParams) {
  try {
    // Generate email HTML using React Email
    const emailHtml = await render(
      <ResetPasswordEmail userName={userName} resetUrl={resetUrl} />,
    );

    const { data, error } = await resend.emails.send({
      from: "Synchro <support@send.mail.synchro.it.com>",
      to: [to],
      subject: "[Synchro] 비밀번호 재설정 안내",
      html: emailHtml,
      replyTo: "support@send.mail.synchro.it.com",
    });

    if (error) {
      console.error("Email send error:", error);
      throw new Error(`Failed to send password reset email: ${error.message}`);
    }

    console.log("Password reset email sent successfully:", data);
    return { success: true, data };
  } catch (error) {
    console.error("Password reset email service error:", error);
    throw error;
  }
}

interface SendChangeEmailEmailParams {
  to: string;
  userName?: string;
  newEmail: string;
  confirmationUrl: string;
}

export async function sendChangeEmailEmail({
  to,
  userName,
  newEmail,
  confirmationUrl,
}: SendChangeEmailEmailParams) {
  try {
    const { default: ChangeEmail } = await import(
      "~/transactional-emails/emails/change-email"
    );
    // Generate email HTML using React Email
    const emailHtml = await render(
      <ChangeEmail
        userName={userName}
        newEmail={newEmail}
        confirmationUrl={confirmationUrl}
      />,
    );

    const { data, error } = await resend.emails.send({
      from: "Synchro <support@send.mail.synchro.it.com>",
      to: [to],
      subject: "[Synchro] 이메일 변경 인증",
      html: emailHtml,
      replyTo: "support@send.mail.synchro.it.com",
    });

    if (error) {
      console.error("Email send error:", error);
      throw new Error(`Failed to send change email email: ${error.message}`);
    }

    console.log("Change email email sent successfully:", data);
    return { success: true, data };
  } catch (error) {
    console.error("Change email email service error:", error);
    throw error;
  }
}

interface SendTeamInviteEmailParams {
  to: string;
  teamName: string;
  inviterName: string;
  role: string;
  inviteUrl: string;
}

export async function sendTeamInviteEmail({
  to,
  teamName,
  inviterName,
  role,
  inviteUrl,
}: SendTeamInviteEmailParams) {
  try {
    const emailHtml = await render(
      <TeamInviteEmail
        teamName={teamName}
        inviterName={inviterName}
        role={role}
        inviteUrl={inviteUrl}
      />,
    );

    const { data, error } = await resend.emails.send({
      from: "Synchro <support@send.mail.synchro.it.com>",
      to: [to],
      subject: `[Synchro] ${teamName} 팀 초대 안내`,
      html: emailHtml,
      replyTo: "support@send.mail.synchro.it.com",
    });

    if (error) {
      console.error("Email send error:", error);
      throw new Error(`Failed to send team invite email: ${error.message}`);
    }

    console.log("Team invite email sent successfully:", data);
    return { success: true, data };
  } catch (error) {
    console.error("Team invite email service error:", error);
    throw error;
  }
}

interface EmailTemplate {
  subject: string;
  html: string;
}

export async function generateWelcomeEmailTemplate(
  userName?: string,
  verificationUrl?: string,
): Promise<EmailTemplate> {
  const html = await render(
    <WelcomeEmail userName={userName} verificationUrl={verificationUrl} />,
  );

  return {
    subject: "[Synchro] 가입을 환영합니다",
    html,
  };
}
