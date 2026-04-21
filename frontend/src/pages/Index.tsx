import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { TopIPList } from '@/components/TopIPList';
import { DeviceGrid } from '@/components/DeviceGrid';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDevices } from '@/hooks/useDeviceApi';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useOptionalAuth } from '@/lib/auth';
import { getBackendUrl } from '@/services/api';

const Index = () => {
  const navigate = useNavigate();
  const [backendUrlSet, setBackendUrlSet] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });
  const isMobile = useIsMobile();
  const { getToken } = useOptionalAuth();

  useEffect(() => {
    const url = localStorage.getItem('apiBackendUrl');
    setBackendUrlSet(url !== null);
  }, []);

  // Authenticate with backend when user is signed in
  useEffect(() => {
    const authenticateWithBackend = async () => {
      try {
        const token = await getToken();
        if (token) {
          const response = await fetch(`${getBackendUrl()}/auth/clerk`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          if (response.ok) {
            console.log('Authenticated with backend');
          } else {
            console.error('Failed to authenticate with backend');
          }
        }
      } catch (error) {
        console.error('Error authenticating with backend:', error);
      }
    };

    authenticateWithBackend();
  }, [getToken]);

  // Attempt to connect to backend - will fail gracefully if not running
  useDevices();

  return (
    <div className="h-screen overflow-hidden bg-background">
      {/* Navigation Sidebar */}
      <Sidebar
        isOpen={isMobile ? sidebarOpen : true}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={!isMobile && sidebarCollapsed}
        onCollapsedChange={(collapsed) => {
          setSidebarCollapsed(collapsed);
          localStorage.setItem('sidebar-collapsed', String(collapsed));
        }}
      />

      {/* Main Content */}
      <main className={cn(
        "h-screen flex flex-col transition-all duration-300",
        !isMobile && (sidebarCollapsed ? "ml-16" : "ml-52")
      )}>
        {/* Header */}
        <Header
          title="Dashboard"
          subtitle="Overview of your Android automation system"
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* Content */}
        <div className="flex-1 p-6 overflow-hidden flex flex-col gap-4">
          {!backendUrlSet && (
            <Alert>
              <AlertDescription>
                Backend API URL is not set. Please configure it in Settings first.
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2"
                  onClick={() => navigate('/settings')}
                >
                  Go to Settings
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Top IP List */}
          {/* <TopIPList /> */}

          {/* Device Grid */}
          <div className="flex-1 overflow-hidden">
            <DeviceGrid hideGridOnMobile={true} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
