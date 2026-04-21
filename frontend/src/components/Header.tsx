import { LayoutDashboard, User, Menu } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { UserMenu, useOptionalUser } from '@/lib/auth';

interface HeaderProps {
  title: string;
  subtitle: string;
  onMenuClick?: () => void;
}

export function Header({ title, subtitle, onMenuClick }: HeaderProps) {
  const isMobile = useIsMobile();
  const { user } = useOptionalUser();

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="flex items-center gap-2 md:gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden p-2"
          onClick={onMenuClick}
        >
          <Menu className="w-5 h-5" />
        </Button>
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-muted flex items-center justify-center">
          <LayoutDashboard className="w-4 h-4 md:w-5 md:h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg md:text-xl font-semibold">{title}</h1>
          {!isMobile && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>

      {!isMobile && user && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Welcome, <span className="text-foreground">{user.firstName || user.username}</span></span>
          <UserMenu />
        </div>
      )}
    </header>
  );
}
