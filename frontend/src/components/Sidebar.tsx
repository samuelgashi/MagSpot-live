import { LayoutDashboard, ListTodo, Settings, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NavLink, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({ isOpen = true, onClose, isCollapsed = false, onCollapsedChange }: SidebarProps) {
  const location = useLocation();
  const isMobile = useIsMobile();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { id: 'tasks', label: 'Tasks', icon: ListTodo, path: '/tasks' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  ];

  const toggleCollapse = () => {
    if (onCollapsedChange) {
      onCollapsedChange(!isCollapsed);
    }
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-5 md:hidden"
          onClick={onClose}
        />
      )}
      <aside className={cn(
        "fixed left-0 top-0 bg-sidebar flex flex-col border-r border-sidebar-border h-screen z-10 transition-[width] duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full",
        isCollapsed ? "w-16" : "w-52"
      )}>
      {/* Logo */}
      <div className={cn(
        "p-4 flex items-center gap-3 border-b border-sidebar-border",
        isCollapsed && "justify-center p-2"
      )}>
        {!isCollapsed ? (
          <>
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-foreground">MagSpot</h1>
              <p className="text-xs text-muted-foreground">Automation Hub</p>
            </div>
          </>
        ) : (
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
        )}
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.id}>
                <NavLink
                  to={item.path}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                    isActive
                      ? 'bg-sidebar-accent text-primary font-medium'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50',
                    isCollapsed && 'justify-center px-2'
                  )}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {!isCollapsed && item.label}
                  {isActive && !isCollapsed && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
      
      {/* Footer with collapse toggle */}
      <div className={cn(
        "border-t border-sidebar-border p-2",
        isCollapsed ? "flex flex-col items-center gap-2" : "flex items-center justify-start"
      )}>
        {!isMobile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleCollapse}
            className="h-8 w-8 p-0 hover:bg-sidebar-accent/50"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </Button>
        )}
        {!isCollapsed && (
          <p className="text-xs text-muted-foreground">Android Automation v1.0</p>
        )}
      </div>
      </aside>
    </>
  );
}
