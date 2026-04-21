import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { healthCheck, createApiKey, listApiKeys, deleteApiKey, ApiKey, getTunnelStatus, disconnectAllDevices, startScrcpyTunnel, stopScrcpyTunnel } from '@/services/api';
import { Trash2, Play, Square, Unplug } from 'lucide-react';
import { useOptionalAuth } from '@/lib/auth';

const Settings = () => {
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [lifeTime, setLifeTime] = useState('24');
  const [tunnelUrl, setTunnelUrl] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });
  const isMobile = useIsMobile();
  const { getToken } = useOptionalAuth();
  const userId = 'admin'; // Assuming default user
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: apiKeys = [], isLoading: keysLoading } = useQuery({
    queryKey: ['apiKeys', userId],
    queryFn: async () => {
      const token = await getToken();
      return listApiKeys(userId, token);
    },
    enabled: !!apiUrl, // Only fetch if backend URL is set
  });

  const { data: tunnelStatus } = useQuery({
    queryKey: ['tunnelStatus'],
    queryFn: async () => {
      const token = await getToken();
      return getTunnelStatus(token);
    },
    enabled: !!apiUrl,
  });

  const createKeyMutation = useMutation({
    mutationFn: async (data: { life_time: number }) => {
      const token = await getToken();
      return createApiKey({
        user_id: userId,
        life_time: data.life_time,
        authorized_endpoints: '*'
      }, token);
    },
    onSuccess: (result) => {
      toast({
        title: 'API Key Created',
        description: `Key: ${result.api_key}`,
      });
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const token = await getToken();
      return deleteApiKey(keyId, userId, token);
    },
    onMutate: async (keyId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['apiKeys', userId] });

      // Snapshot the previous value
      const previousKeys = queryClient.getQueryData(['apiKeys', userId]);

      // Optimistically update to remove the key
      queryClient.setQueryData(['apiKeys', userId], (old: any) =>
        old ? old.filter((key: any) => key.key_id !== keyId) : []
      );

      return { previousKeys };
    },
    onSuccess: () => {
      toast({
        title: 'API Key Deleted',
        description: 'The key has been removed.',
      });
    },
    onError: (error: Error, keyId, context) => {
      // Revert on error
      if (context?.previousKeys) {
        queryClient.setQueryData(['apiKeys', userId], context.previousKeys);
      }
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['apiKeys', userId] });
    },
  });

  const disconnectAllMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return disconnectAllDevices(token);
    },
    onSuccess: (result) => {
      toast({
        title: 'Devices Disconnected',
        description: result.details,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const startTunnelMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return startScrcpyTunnel(token);
    },
    onSuccess: (result) => {
      if (result.public_url) {
        setTunnelUrl(result.public_url);
        toast({
          title: 'Tunnel Started',
          description: `Public URL: ${result.public_url}`,
        });
      } else {
        toast({
          title: 'Tunnel Starting',
          description: result.output,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['tunnelStatus'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const stopTunnelMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return stopScrcpyTunnel(token);
    },
    onSuccess: (result) => {
      setTunnelUrl('');
      toast({
        title: 'Tunnel Stopped',
        description: result.output,
      });
      queryClient.invalidateQueries({ queryKey: ['tunnelStatus'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    const savedUrl = localStorage.getItem('apiBackendUrl') || '';
    const savedKey = localStorage.getItem('apiKey') || '';
    setApiUrl(savedUrl);
    setApiKey(savedKey);
  }, []);

  useEffect(() => {
    if (tunnelStatus?.tunnel?.tunnel_url) {
      setTunnelUrl(tunnelStatus.tunnel.tunnel_url);
    }
  }, [tunnelStatus]);

  const handleSave = () => {
    localStorage.setItem('apiBackendUrl', apiUrl);
    localStorage.setItem('apiKey', apiKey);
    toast({
      title: 'Settings saved',
      description: 'Your API configuration has been updated.',
    });
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const token = await getToken();
      const result = await healthCheck(token);
      toast({
        title: 'Connection successful',
        description: result.message,
      });
    } catch (error) {
      toast({
        title: 'Connection failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleGenerateKey = () => {
    const hours = parseInt(lifeTime);
    if (isNaN(hours) || hours <= 0) {
      toast({
        title: 'Invalid lifetime',
        description: 'Please enter a valid number of hours.',
        variant: 'destructive',
      });
      return;
    }
    createKeyMutation.mutate({ life_time: hours });
  };

  const handleDeleteKey = (keyId: string) => {
    deleteKeyMutation.mutate(keyId);
  };

  const handleDisconnectAllDevices = () => {
    if (window.confirm('Are you sure you want to disconnect all devices?')) {
      disconnectAllMutation.mutate();
    }
  };

  const handleStartTunnel = () => {
    startTunnelMutation.mutate();
  };

  const handleStopTunnel = () => {
    stopTunnelMutation.mutate();
  };

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
          title="Settings"
          subtitle="Configure your API backend settings"
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto">
          {/* Disconnect All Devices Button */}
          <div className="flex justify-end mb-4">
            <Button
              onClick={handleDisconnectAllDevices}
              variant="destructive"
              disabled={disconnectAllMutation.isPending}
            >
              <Unplug className="w-4 h-4 mr-2" />
              {disconnectAllMutation.isPending ? 'Disconnecting...' : 'Disconnect All Devices'}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-6xl">
            <Card>
              <CardHeader>
                <CardTitle>API Configuration</CardTitle>
                <CardDescription>
                  Set the backend API URL and key for connecting to your services.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="api-url">API Backend URL</Label>
                  <Input
                    id="api-url"
                    type="url"
                    placeholder="http://localhost:9786"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api-key">Backend API Key</Label>
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="Enter your API key (optional)"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} className="flex-1">
                    Save Settings
                  </Button>
                  <Button
                    onClick={handleTestConnection}
                    variant="outline"
                    disabled={isTesting || !apiUrl}
                    className="flex-1"
                  >
                    {isTesting ? 'Testing...' : 'Test Connection'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card style={{marginTop: "10px"}}>
              <CardHeader>
                <CardTitle>Tunnels</CardTitle>
                <CardDescription>
                  Manage Cloudflare tunnel for scrcpy access.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tunnel-url">Cloudflared Public URL</Label>
                  <Input
                    id="tunnel-url"
                    type="text"
                    value={tunnelUrl}
                    readOnly
                    placeholder="No tunnel active"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleStartTunnel}
                    disabled={startTunnelMutation.isPending}
                    className="flex-1"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {startTunnelMutation.isPending ? 'Starting...' : 'Start Ws-Scrcpy'}
                  </Button>
                  <Button
                    onClick={handleStopTunnel}
                    variant="outline"
                    disabled={stopTunnelMutation.isPending}
                    className="flex-1"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    {stopTunnelMutation.isPending ? 'Stopping...' : 'Stop Scrcpy'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card style={{marginTop: "10px"}}>
              <CardHeader>
                <CardTitle>API Key Configuration</CardTitle>
                <CardDescription>
                  Generate and manage API keys for backend access.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="space-y-2 flex-1">
                    <Label htmlFor="lifetime">Lifetime (Days)</Label>
                    <Input
                      id="lifetime"
                      type="number"
                      value={lifeTime}
                      onChange={(e) => setLifeTime(e.target.value)}
                      placeholder="24"
                      min="1"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={handleGenerateKey}
                      disabled={createKeyMutation.isPending}
                    >
                      {createKeyMutation.isPending ? 'Generating...' : 'Generate API Key'}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Generated API Keys</Label>
                  {keysLoading ? (
                    <p>Loading...</p>
                  ) : apiKeys.length === 0 ? (
                    <p className="text-muted-foreground">No API keys generated yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {apiKeys.map((key: ApiKey) => (
                        <div key={key.key_id} className="flex items-center justify-between p-3 border rounded">
                          <div>
                            <p className="font-mono text-sm">{key.key_id}</p>
                            <p className="text-xs text-muted-foreground">
                              Expires: {new Date(key.life_time).toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Endpoints: {key.authorized_endpoints}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteKey(key.key_id)}
                            disabled={deleteKeyMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
         </div>
       </div>
      </main>
    </div>
  );
};

export default Settings;