/**
 * Home Page Component
 *
 * This file implements the main landing page of the application with internationalization support.
 * It demonstrates the use of i18next for multi-language content, React Router's data API for
 * server-side rendering, and responsive design with Tailwind CSS.
 *
 * Key features:
 * - Server-side translation with i18next
 * - Client-side translation with useTranslation hook
 * - SEO-friendly metadata using React Router's meta export
 * - Responsive typography with Tailwind CSS
 */
import type { Route } from "./+types/home";

import { ArrowRight, LogIn, Play, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, redirect } from "react-router";

import { Button } from "~/core/components/ui/button";
import { Card } from "~/core/components/ui/card";
import { Container } from "~/core/components/ui/container";
import { Section } from "~/core/components/ui/section";

/**
 * Loader function for server-side data fetching
 *
 * This function redirects all home page requests to the login page.
 *
 * @param request - The incoming HTTP request
 * @returns Redirect to login page
 */
export async function loader({ request }: Route.LoaderArgs) {
  // Check if user is authenticated
  const [{ default: makeServerClient }, i18next] = await Promise.all([
    import("~/core/lib/supa-client.server"),
    import("~/core/lib/i18next.server"),
  ]);
  const [client] = makeServerClient(request);
  const {
    data: { user },
  } = await client.auth.getUser();

  // If user is logged in, redirect to work page
  if (user) {
    return redirect("/work");
  }

  // Load translations for server-side rendering
  const t = await i18next.default.getFixedT(request);
  return { title: t("home.title") };
}

/**
 * Home page component
 *
 * This is the main landing page component of the application. It displays a simple,
 * centered layout with a headline and subtitle, both internationalized using i18next.
 *
 * Features:
 * - Uses the useTranslation hook for client-side translation
 * - Implements responsive design with Tailwind CSS
 * - Maintains consistent translations between server and client
 *
 * The component is intentionally simple to serve as a starting point for customization.
 * It demonstrates the core patterns used throughout the application:
 * - Internationalization
 * - Responsive design
 * - Clean, semantic HTML structure
 *
 * @returns JSX element representing the home page
 */
export default function Home() {
  const { t } = useTranslation();

  return (
    <div className="bg-background min-h-[calc(100vh-4rem)] w-full">
      <Container size="lg">
        {/* Hero Section */}
        <Section
          spacing="lg"
          as="div"
          className="flex flex-col items-center justify-center gap-8 text-center"
        >
          <div className="bg-secondary mb-4 inline-flex items-center justify-center rounded-full p-3">
            <Sparkles className="text-primary size-6" />
          </div>

          <div className="space-y-6">
            <h1 className="text-foreground text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              <span className="from-primary dark:from-primary bg-gradient-to-r to-blue-500 bg-clip-text text-transparent dark:to-blue-400">
                AI가 분석하는
              </span>
              <br />
              업무 프로세스 자동화
            </h1>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg sm:text-xl">
              동영상을 업로드하면 AI가 자동으로 업무 단계를 분석하고
              <br className="hidden sm:block" />
              팀원들과 공유할 수 있는 프로세스 문서를 만들어드려요
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Link to="/service">
              <Button
                size="lg"
                className="group w-full gap-2 rounded-xl px-8 text-base font-medium sm:w-auto"
              >
                <Sparkles className="size-5" />
                서비스 알아보기
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link to="/demo">
              <Button
                size="lg"
                variant="outline"
                className="group w-full gap-2 rounded-xl px-8 text-base font-medium sm:w-auto"
              >
                <Play className="size-5 transition-transform group-hover:scale-110" />
                무료 체험하기
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </Section>

        {/* Features Grid */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="group border-border bg-card hover:border-primary/50 hover:shadow-primary/10 overflow-hidden rounded-2xl border p-6 shadow-lg backdrop-blur-xl transition-all hover:shadow-xl">
            <div className="bg-secondary text-primary group-hover:bg-primary group-hover:text-primary-foreground mb-4 flex size-12 items-center justify-center rounded-xl transition-colors">
              <Sparkles className="size-6" />
            </div>
            <h3 className="text-card-foreground mb-2 text-lg font-bold">
              AI 자동 분석
            </h3>
            <p className="text-muted-foreground text-sm">
              동영상에서 업무 단계를 자동으로 추출하고 분석합니다
            </p>
          </Card>

          <Card className="group border-border bg-card hover:border-primary/50 hover:shadow-primary/10 overflow-hidden rounded-2xl border p-6 shadow-lg backdrop-blur-xl transition-all hover:shadow-xl">
            <div className="bg-secondary text-primary group-hover:bg-primary group-hover:text-primary-foreground mb-4 flex size-12 items-center justify-center rounded-xl transition-colors">
              <span className="text-xl">📝</span>
            </div>
            <h3 className="text-card-foreground mb-2 text-lg font-bold">
              프로세스 문서화
            </h3>
            <p className="text-muted-foreground text-sm">
              단계별로 정리된 업무 프로세스를 팀원들과 공유하세요
            </p>
          </Card>

          <Card className="group border-border bg-card hover:border-primary/50 hover:shadow-primary/10 overflow-hidden rounded-2xl border p-6 shadow-lg backdrop-blur-xl transition-all hover:shadow-xl">
            <div className="bg-secondary text-primary group-hover:bg-primary group-hover:text-primary-foreground mb-4 flex size-12 items-center justify-center rounded-xl transition-colors">
              <span className="text-xl">👥</span>
            </div>
            <h3 className="text-card-foreground mb-2 text-lg font-bold">
              팀 협업
            </h3>
            <p className="text-muted-foreground text-sm">
              팀원들과 함께 업무 프로세스를 관리하고 개선하세요
            </p>
          </Card>
        </div>

        {/* Demo CTA Section */}
        <Section
          spacing="lg"
          as="div"
          className="border-border from-secondary/50 to-background overflow-hidden rounded-3xl border bg-gradient-to-br p-8 text-center backdrop-blur-sm"
        >
          <p className="text-foreground mb-6 text-lg font-medium">
            💡 <strong>로그인 없이</strong> 바로 체험해보세요
          </p>
          <Link to="/demo">
            <Button variant="outline" size="lg" className="gap-2 rounded-xl">
              <Play className="size-4" />
              샘플 데이터로 체험하기
            </Button>
          </Link>
        </Section>
      </Container>
    </div>
  );
}
