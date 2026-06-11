import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, CheckSquare, LogOut, Briefcase } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const items = [
  { title: "לוח בקרה", url: "/", icon: LayoutDashboard, exact: true },
  { title: "לקוחות", url: "/clients", icon: Users, exact: false },
  { title: "משימות", url: "/tasks", icon: CheckSquare, exact: false },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const { user } = useAuth();

  const isActive = (url: string, exact: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(url + "/");

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <Sidebar collapsible="icon" side="right">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Briefcase className="h-5 w-5" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold leading-tight">אטלס</span>
            <span className="text-xs text-sidebar-foreground/70">ניהול עסקי</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>סביבת עבודה</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url, item.exact)}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center justify-between gap-2 px-2 py-2 group-data-[collapsible=icon]:flex-col">
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate text-xs font-medium">{user?.email}</span>
            <span className="text-[10px] text-sidebar-foreground/60">מחובר</span>
          </div>
          <button
            onClick={signOut}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/80 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            title="התנתקות"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}