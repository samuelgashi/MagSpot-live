import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { MonitorSmartphone, LayoutGrid, Folders, CheckSquare, ScanSearch, Activity, Server, Hexagon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider } from "@/components/ui/sidebar";
import { useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  
  const { data: health } = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey() } });

  return (
    <SidebarProvider defaultOpen>
      <div className="flex h-screen w-full overflow-hidden bg-background text-foreground font-mono">
        <Sidebar className="border-r border-border bg-sidebar h-full flex flex-col">
          <SidebarHeader className="p-4 border-b border-border mb-4">
            <div className="flex items-center gap-2 text-primary font-bold text-xl uppercase tracking-wider">
              <Hexagon className="w-6 h-6 fill-primary/20 text-primary" />
              <span>DeviceMatrix</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu className="px-2 gap-2">
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/"} className="rounded-none border border-transparent data-[active=true]:border-primary/50 data-[active=true]:bg-primary/10">
                  <Link href="/">
                    <Activity className="w-4 h-4 mr-2 text-primary" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/devices"} className="rounded-none border border-transparent data-[active=true]:border-primary/50 data-[active=true]:bg-primary/10">
                  <Link href="/devices">
                    <MonitorSmartphone className="w-4 h-4 mr-2 text-primary" />
                    <span>Devices</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/groups"} className="rounded-none border border-transparent data-[active=true]:border-primary/50 data-[active=true]:bg-primary/10">
                  <Link href="/groups">
                    <Folders className="w-4 h-4 mr-2 text-primary" />
                    <span>Groups</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/tasks"} className="rounded-none border border-transparent data-[active=true]:border-primary/50 data-[active=true]:bg-primary/10">
                  <Link href="/tasks">
                    <CheckSquare className="w-4 h-4 mr-2 text-primary" />
                    <span>Tasks</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/scan"} className="rounded-none border border-transparent data-[active=true]:border-primary/50 data-[active=true]:bg-primary/10">
                  <Link href="/scan">
                    <ScanSearch className="w-4 h-4 mr-2 text-primary" />
                    <span>IP Scan</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
          <div className="mt-auto p-4 border-t border-border">
             <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Server className="w-3 h-3" />
                <span>System Status:</span>
                {health?.status === 'ok' ? (
                  <span className="text-primary font-bold">ONLINE</span>
                ) : (
                  <span className="text-destructive font-bold">OFFLINE</span>
                )}
             </div>
          </div>
        </Sidebar>
        
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-0">
          <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(0,0,0,0)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0)_1px,transparent_1px)] bg-[length:20px_20px] shadow-[inset_0_0_100px_rgba(0,0,0,0.5)] z-[-1]" />
          <div className="flex-1 overflow-y-auto p-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
