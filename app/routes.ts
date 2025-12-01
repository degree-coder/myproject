/**
 * Application Routes Configuration
 *
 * This file defines all routes for the application using React Router's
 * file-based routing system. Routes are organized by feature and access level.
 *
 * The structure uses layouts for shared UI elements and prefixes for route grouping.
 * This approach creates a hierarchical routing system that's both maintainable and scalable.
 */
import {
  type RouteConfig,
  index,
  layout,
  prefix,
  route,
} from "@react-router/dev/routes";

export default [
  route("/robots.txt", "core/screens/robots.ts"),
  route("/sitemap.xml", "core/screens/sitemap.ts"),
  ...prefix("/debug", [
    // You should delete this in production.
    route("/sentry", "debug/sentry.tsx"),
    route("/analytics", "debug/analytics.tsx"),
  ]),
  // API Routes. Routes that export actions and loaders but no UI.
  ...prefix("/api", [
    ...prefix("/settings", [
      route("/theme", "features/settings/api/set-theme.tsx"),
      route("/locale", "features/settings/api/set-locale.tsx"),
    ]),
    ...prefix("/users", [
      index("features/users/api/delete-account.tsx"),
      route("/password", "features/users/api/change-password.tsx"),
      route("/email", "features/users/api/change-email.tsx"),
      route("/profile", "features/users/api/edit-profile.tsx"),
      route("/providers", "features/users/api/connect-provider.tsx"),
      route(
        "/providers/:provider",
        "features/users/api/disconnect-provider.tsx",
      ),
    ]),
    ...prefix("/teams", [
      route("/", "routes/api/teams/index.ts"),
      route("/:teamId/members", "routes/api/teams/$teamId.members.ts"),
      route(
        "/:teamId/members/:memberId",
        "routes/api/teams/$teamId.members.$memberId.ts",
      ),
      route("/:teamId/workflows", "routes/api/teams/$teamId.workflows.ts"),
      route(
        "/:teamId/workflows/:workflowId",
        "routes/api/teams/$teamId.workflows.$workflowId.ts",
      ),
      route(
        "/:teamId/workflows/:workflowId/shares",
        "routes/api/teams/$teamId.workflows.$workflowId.shares.ts",
      ),
      route(
        "/:teamId/migrate-workflows",
        "routes/api/teams/$teamId.migrate-workflows.ts",
      ),
      route("/invites/:token", "routes/api/teams/invites.$token.ts"),
      route(
        "/invites/:token/accept",
        "routes/api/teams/invites.$token.accept.ts",
      ),
    ]),
    ...prefix("/work", [
      route("/upload", "routes/api/work/upload.ts"),
      route("/upload-url", "routes/api/work/upload-url.ts"),
      route("/videos", "routes/api/work/videos.ts"),
      route("/analyze", "routes/api/work/analyze.ts"),
      route("/workflows", "routes/api/work/workflows.ts"),
      route(
        "/workflows/:workflowId/status",
        "routes/api/work/workflows.$workflowId.status.ts",
      ),
      route(
        "/workflows/:workflowId",
        "routes/api/work/workflows.$workflowId.delete.ts",
      ),
      // Team management APIs (legacy workflow-based, will be deprecated)
      route(
        "/workflows/:workflowId/members",
        "routes/api/work/workflows.$workflowId.members.ts",
      ),
      route(
        "/workflows/:workflowId/members/:memberId",
        "routes/api/work/workflows.$workflowId.members.$memberId.ts",
      ),
      route(
        "/workflows/:workflowId/invites",
        "routes/api/work/workflows.$workflowId.invites.ts",
      ),
      route("/share/create", "routes/api/work/share.create.ts"),
      route("/share/claim", "routes/api/work/share.claim.ts"),
      route(
        "/share/workflows/:token",
        "routes/api/work/share.workflows.$token.ts",
      ),
    ]),
  ]),

  layout("features/work/layouts/work.layout.tsx", [
    ...prefix("/work", [
      index("features/work/screens/index.tsx"),
      route(
        "/business-logic",
        "features/work/business-logic/screens/business-logic.tsx",
      ),
      route("/upload", "features/work/upload/screens/upload.tsx"),
      route(
        "/team-management",
        "features/work/team-management/screens/team-management.tsx",
      ),
      route(
        "/invite/:token",
        "features/work/team-management/screens/team-invite.tsx",
      ),
    ]),
  ]),

  // Admin routes with admin layout
  layout("features/admin/layouts/admin.layout.tsx", [
    ...prefix("/admin", [index("features/admin/screens/super-dashboard.tsx")]),
  ]),

  // Account routes with custom layout (back button only, no navigation)
  // Account routes with custom layout (back button only, no navigation)
  layout("core/layouts/profile.layout.tsx", { id: "profile" }, [
    route("/profile/edit", "features/users/screens/profile.edit.tsx"),
  ]),

  layout("core/layouts/navigation.layout.tsx", [
    route("/auth/confirm", "features/auth/screens/confirm.tsx"),
    index("features/home/screens/home.tsx"),
    route("/error", "core/screens/error.tsx"),

    // 공개 페이지 (로그인 불필요)
    route("/service", "features/service/screens/service.tsx"),
    route("/pricing", "features/pricing/screens/pricing.tsx"),
    route("/demo", "features/demo/screens/demo-work.tsx"),
    route("/share/:token", "features/work/share/screens/share-view.tsx"),

    layout("core/layouts/public.layout.tsx", [
      // Routes that should only be visible to unauthenticated users.
      route("/login", "features/auth/screens/login.tsx"),
      route("/join", "features/auth/screens/join.tsx"),
      ...prefix("/auth", [
        route("/api/resend", "features/auth/api/resend.tsx"),
        route(
          "/forgot-password/reset",
          "features/auth/screens/forgot-password.tsx",
        ),
        route("/magic-link", "features/auth/screens/magic-link.tsx"),
        ...prefix("/otp", [
          route("/start", "features/auth/screens/otp/start.tsx"),
          route("/complete", "features/auth/screens/otp/complete.tsx"),
        ]),
        ...prefix("/social", [
          route("/start/:provider", "features/auth/screens/social/start.tsx"),
          route(
            "/complete/:provider",
            "features/auth/screens/social/complete.tsx",
          ),
        ]),
      ]),
    ]),

    route(
      "/auth/forgot-password/create",
      "features/auth/screens/new-password.tsx",
    ),

    layout("core/layouts/private.layout.tsx", { id: "private-auth" }, [
      ...prefix("/auth", [
        route("/email-verified", "features/auth/screens/email-verified.tsx"),
      ]),
      // Routes that should only be visible to authenticated users.
      route("/logout", "features/auth/screens/logout.tsx"),
    ]),
    route("/contact", "features/contact/screens/contact-us.tsx"),
    ...prefix("/payments", [
      route("/checkout", "features/payments/screens/checkout.tsx"),
      layout("core/layouts/private.layout.tsx", { id: "private-payments" }, [
        index("features/payments/screens/payments.tsx"),
        route("/success", "features/payments/screens/success.tsx"),
        route("/failure", "features/payments/screens/failure.tsx"),
      ]),
    ]),
  ]),

  ...prefix("/legal", [route("/:slug", "features/legal/screens/policy.tsx")]),
] satisfies RouteConfig;
