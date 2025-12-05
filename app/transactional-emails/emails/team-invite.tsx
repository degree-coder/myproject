import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* Email templates require inline styles for cross-client compatibility */

interface TeamInviteEmailProps {
  teamName: string;
  inviterName: string;
  role: string;
  inviteUrl: string;
}

export default function TeamInviteEmail({
  teamName = "Synchro Team",
  inviterName = "관리자",
  role = "member",
  inviteUrl = "https://synchro.it.com/work/invite/token",
}: TeamInviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {inviterName}님이 {teamName} 팀에 초대했습니다.
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Img
              src="https://synchro.it.com/logo.svg"
              width="120"
              height="40"
              alt="싱크로 로고"
              style={logo}
            />
          </Section>

          {/* Hero Section */}
          <Section style={hero}>
            <Heading style={heroHeading}>팀 초대장이 도착했습니다!</Heading>
            <Text style={heroText}>
              <span style={{ fontWeight: "600", color: "#1e293b" }}>
                {inviterName}
              </span>
              님이 귀하를{" "}
              <span style={{ fontWeight: "600", color: "#3b82f6" }}>
                {teamName}
              </span>{" "}
              팀에 초대했습니다.
            </Text>
          </Section>

          {/* Main Content */}
          <Section style={content}>
            <Section style={inviteBox}>
              <Text style={inviteDetail}>
                <span style={label}>팀 이름:</span> {teamName}
              </Text>
              <Text style={inviteDetail}>
                <span style={label}>초대자:</span> {inviterName}
              </Text>
              <Text style={inviteDetail}>
                <span style={label}>역할:</span>{" "}
                {role === "owner"
                  ? "소유자"
                  : role === "admin"
                    ? "관리자"
                    : "팀원"}
              </Text>
            </Section>

            <Text style={description}>
              팀에 합류하여 업무 프로세스를 공유하고 효율적으로 협업해보세요.
              아래 버튼을 클릭하여 초대를 수락할 수 있습니다.
            </Text>

            <Section style={ctaSection}>
              <Button style={primaryButton} href={inviteUrl}>
                초대 수락하기
              </Button>
              <Text style={buttonText}>
                이 초대 링크는 7일 동안 유효합니다.
              </Text>
            </Section>
          </Section>

          {/* Support */}
          <Section style={supportSection}>
            <Text style={supportText}>
              초대를 원하지 않으시거나 실수로 전송된 경우 이 이메일을 무시하셔도
              됩니다.
              <br />
              궁금한 점이 있으신가요?{" "}
              <Link
                href="mailto:support@mail.synchro.it.com"
                style={supportLink}
              >
                support@mail.synchro.it.com
              </Link>
              으로 문의해주세요.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Synchro - AI Powered Workflow Automation
            </Text>
            <Text style={footerSmall}>
              © 2024 Synchro. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: "#f8fafc",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
};

const container = {
  maxWidth: "600px",
  margin: "0 auto",
  padding: "20px",
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.05)",
};

const header = {
  textAlign: "center" as const,
  padding: "40px 0 20px",
};

const logo = {
  borderRadius: "8px",
};

const hero = {
  textAlign: "center" as const,
  padding: "0 0 30px",
  borderBottom: "1px solid #e2e8f0",
};

const heroHeading = {
  fontSize: "28px",
  fontWeight: "700",
  color: "#1e293b",
  margin: "0 0 16px",
  lineHeight: "1.2",
};

const heroText = {
  fontSize: "18px",
  color: "#64748b",
  margin: "0",
  lineHeight: "1.5",
};

const content = {
  padding: "40px 0",
};

const inviteBox = {
  backgroundColor: "#f1f5f9",
  borderRadius: "8px",
  padding: "24px",
  marginBottom: "24px",
};

const inviteDetail = {
  fontSize: "16px",
  color: "#334155",
  margin: "8px 0",
};

const label = {
  fontWeight: "600",
  color: "#64748b",
  marginRight: "8px",
};

const description = {
  fontSize: "16px",
  color: "#475569",
  lineHeight: "1.6",
  textAlign: "center" as const,
  marginBottom: "32px",
};

const ctaSection = {
  textAlign: "center" as const,
};

const primaryButton = {
  backgroundColor: "#4f46e5",
  color: "#ffffff",
  padding: "16px 32px",
  borderRadius: "8px",
  textDecoration: "none" as const,
  fontWeight: "600",
  fontSize: "16px",
  display: "inline-block",
  boxShadow: "0 4px 6px rgba(79, 70, 229, 0.2)",
};

const buttonText = {
  fontSize: "13px",
  color: "#94a3b8",
  marginTop: "12px",
};

const supportSection = {
  textAlign: "center" as const,
  padding: "30px 0",
  borderTop: "1px solid #e2e8f0",
};

const supportText = {
  fontSize: "14px",
  color: "#94a3b8",
  lineHeight: "1.6",
  margin: "0",
};

const supportLink = {
  color: "#4f46e5",
  textDecoration: "none" as const,
};

const footer = {
  textAlign: "center" as const,
  padding: "20px 0 0",
  borderTop: "1px solid #e2e8f0",
};

const footerText = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#cbd5e1",
  margin: "0 0 8px",
};

const footerSmall = {
  fontSize: "12px",
  color: "#cbd5e1",
  margin: "0",
};
