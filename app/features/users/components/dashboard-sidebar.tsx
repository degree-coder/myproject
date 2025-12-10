import {
  AudioWaveformIcon,
  BookOpenIcon,
  BotIcon,
  BriefcaseIcon,
  BuildingIcon,
  CommandIcon,
  FrameIcon,
  GalleryVerticalEndIcon,
  HeartHandshakeIcon,
  LayoutDashboardIcon,
  LineChartIcon,
  MapIcon,
  MegaphoneIcon,
  PieChartIcon,
  RocketIcon,
  Settings2Icon,
  ShieldCheckIcon,
  SquareTerminalIcon,
  Target,
  UsersIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "~/core/components/ui/sidebar";

import SidebarMain from "./sidebar-main";
import SidebarProjects from "./sidebar-projects";
import TeamSwitcher from "./sidebar-team-switcher";
import SidebarUser from "./sidebar-user";

const data = {
  teams: [
    {
      name: "SalesForge",
      logo: BuildingIcon,
      plan: "Enterprise",
    },
    {
      name: "TechCo Solutions",
      logo: BriefcaseIcon,
      plan: "Startup",
    },
    {
      name: "GrowthMate",
      logo: RocketIcon,
      plan: "Free",
    },
  ],
  navMain: [
    {
      title: "Dashboard",
      url: "#",
      icon: LayoutDashboardIcon,
      isActive: true,
      items: [
        {
          title: "Overview",
          url: "/dashboard",
        },
        {
          title: "Analytics",
          url: "#",
        },
        {
          title: "Reports",
          url: "#",
        },
      ],
    },
    {
      title: "Customers",
      url: "#",
      icon: UsersIcon,
      items: [
        {
          title: "Contacts",
          url: "#",
        },
        {
          title: "Companies",
          url: "#",
        },
        {
          title: "Deals",
          url: "#",
        },
      ],
    },
    {
      title: "Sales",
      url: "#",
      icon: LineChartIcon,
      items: [
        {
          title: "Pipeline",
          url: "#",
        },
        {
          title: "Opportunities",
          url: "#",
        },
        {
          title: "Quotes",
          url: "#",
        },
        {
          title: "Invoices",
          url: "#",
        },
      ],
    },
    {
      title: "Settings",
      url: "#",
      icon: Settings2Icon,
      items: [
        {
          title: "Workspace",
          url: "#",
        },
        {
          title: "Team",
          url: "#",
        },
        {
          title: "Integrations",
          url: "#",
        },
      ],
    },
  ],
  projects: [
    {
      name: "Sales Team",
      url: "#",
      icon: Target,
      items: [], // Add items if needed by type, or make optional in SidebarProjects
    },
    {
      name: "Customer Success",
      url: "#",
      icon: HeartHandshakeIcon,
      items: [],
    },
    {
      name: "Marketing",
      url: "#",
      icon: MegaphoneIcon,
      items: [],
    },
  ],
};

export default function DashboardSidebar({
  user,
  isSuperAdmin,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: {
    name: string;
    email: string;
    avatarUrl: string;
  };
  isSuperAdmin?: boolean;
}) {
  const navMain = [...data.navMain];

  if (isSuperAdmin) {
    navMain.push({
      title: "Admin",
      url: "/admin",
      icon: ShieldCheckIcon,
      isActive: false,
      items: [
        {
          title: "Super Dashboard",
          url: "/admin/super-dashboard",
        },
      ],
    });
  }
  return (
    <Sidebar
      collapsible="icon"
      variant="inset"
      className="border-r border-white/20 bg-white/60 shadow-xl backdrop-blur-2xl dark:border-slate-800/40 dark:bg-slate-900/60"
      {...props}
    >
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMain items={navMain} />
        {/* Fix for type mismatch if necessary: map projects to match expected type or ensure data is correct */}
        <SidebarProjects projects={data.projects as any} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarUser
          user={{
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
