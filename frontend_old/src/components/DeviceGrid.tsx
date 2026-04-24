import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useDeviceStore } from '@/stores/deviceStore';
import { DeviceCard } from './DeviceCard';
import { DeviceCheckbox } from './DeviceCheckbox';
import { ActivityPopup } from './ActivityPopup';
import { GroupsAction } from './GroupsAction';
import { GroupsDropdown } from './GroupsDropdown';
import { CpuMonitor, RamMonitor, ContainerMonitor } from './ResourceMonitor';
import { Slider } from '@/components/ui/slider';
import { Monitor, Filter, ArrowUp, ArrowDown, Radio, Grid3X3, ChevronDown, Users, Server, Search, X } from 'lucide-react';
import { parseOctetRange } from '@/lib/mockDevices';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useConnectDevice, useConnectDeviceRange, useExecuteCommand, useActivities, useRestartAdb } from '@/hooks/useDeviceApi';
import { Play, PlugZap, Terminal, CheckSquare, Square, Activity, RotateCcw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';

type SortField = 'name' | 'model' | 'ip';
type SortOrder = 'asc' | 'desc';

// Collapsible header component - moved outside to prevent recreation on every render
const CollapsibleHeader = ({ 
  icon, 
  title, 
  isOpen, 
  onToggle,
  showSearch = false,
  searchOpen = false,
  onSearchToggle = () => {},
  searchValue = '',
  onSearchChange = () => {},
  onSearchClear = () => {}
}: { 
  icon: React.ReactNode; 
  title: string; 
  isOpen: boolean; 
  onToggle: () => void;
  showSearch?: boolean;
  searchOpen?: boolean;
  onSearchToggle?: () => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchClear?: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localValue, setLocalValue] = useState(searchValue);
  const wasOpen = useRef(searchOpen);

  // Sync local value when searchValue prop changes (only when closed)
  useEffect(() => {
    if (!searchOpen) {
      setLocalValue(searchValue || '');
    }
  }, [searchValue, searchOpen]);

  // Handle focus restoration when search opens
  useEffect(() => {
    if (searchOpen && !wasOpen.current && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
    wasOpen.current = searchOpen;
  }, [searchOpen]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalValue(value);
    onSearchChange?.(value);
  }, [onSearchChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <div 
        className="flex items-center gap-2 flex-1 cursor-pointer hover:text-foreground transition-colors"
        onClick={onToggle}
      >
        {icon}
        <span>{title}</span>
      </div>
      <div className="flex items-center gap-1">
        {showSearch && (
          <div className={`relative overflow-hidden transition-all duration-200 ease-out ${searchOpen ? 'w-28' : 'w-0'}`}>
            <Input
              ref={inputRef}
              value={localValue}
              onChange={handleChange}
              placeholder="Filter..."
              className="h-6 text-xs py-1 px-2 bg-transparent border-muted-foreground/30"
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
              onKeyDown={handleKeyDown}
            />
          </div>
        )}
        {showSearch && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-muted/50"
            onClick={(e) => {
              e.stopPropagation();
              onSearchToggle?.();
              if (searchOpen) {
                setLocalValue('');
                onSearchClear?.();
              }
            }}
          >
            {searchOpen ? <X className="w-3 h-3 text-foreground" /> : <Search className="w-3 h-3 text-foreground" />}
          </Button>
        )}
      </div>
    </div>
  );
};

interface DeviceGridProps {
  hideGridOnMobile?: boolean;
}

export function DeviceGrid({ hideGridOnMobile = false }: DeviceGridProps) {
  const {
    devices,
    focusedId,
    cardScale,
    cardScaleRealTime,
    setCardScale,
    setCardScaleRealTime,
    selectedIds,
    selectAll,
    clearSelection,
    selectByOctets,
    selectMany,
    searchQuery,
    setSearchQuery
  } = useDeviceStore();
  const gridRef = useRef<HTMLDivElement>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const [selectionEnd, setSelectionEnd] = useState({ x: 0, y: 0 });
  const deviceRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const [rangeInput, setRangeInput] = useState('1-16');
  const [connectStartInput, setConnectStartInput] = useState('');
  const [connectEndInput, setConnectEndInput] = useState('');
  const [commandInput, setCommandInput] = useState('');
  const [subnetBase, setSubnetBase] = useState(() => {
    return import.meta.env.VITE_NETWORK_BASE_IP || '192.168.1';
  });
  const [selectedActivity, setSelectedActivity] = useState<{key: string, activity: any} | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [realTimeDisplay, setRealTimeDisplay] = useState(false);
  const [devicesSearchOpen, setDevicesSearchOpen] = useState(false);
  const devicesSearchInputRef = useRef<HTMLInputElement>(null);
  const [devicesSearchLocal, setDevicesSearchLocal] = useState('');
  const wasDevicesSearchOpen = useRef(devicesSearchOpen);

  // Sync local value when searchQuery prop changes (only when closed)
  useEffect(() => {
    if (!devicesSearchOpen) {
      setDevicesSearchLocal(searchQuery || '');
    }
  }, [searchQuery, devicesSearchOpen]);

  // Handle focus restoration when search opens
  useEffect(() => {
    if (devicesSearchOpen && !wasDevicesSearchOpen.current && devicesSearchInputRef.current) {
      setTimeout(() => devicesSearchInputRef.current?.focus(), 150);
    }
    wasDevicesSearchOpen.current = devicesSearchOpen;
  }, [devicesSearchOpen]);

  // Collapsible sections state
  const [showMonitoring, setShowMonitoring] = useState(true);
  const [showSelectDevices, setShowSelectDevices] = useState(true);
  const [showConnect, setShowConnect] = useState(true);
  const [showAdbCommand, setShowAdbCommand] = useState(true);
  const [showActivities, setShowActivities] = useState(true);
  const [showGroups, setShowGroups] = useState(true);

  // Search states
  const [activitiesSearchOpen, setActivitiesSearchOpen] = useState(false);
  const [activitiesSearch, setActivitiesSearch] = useState('');
  const [groupsSearchOpen, setGroupsSearchOpen] = useState(false);
  const [groupsSearch, setGroupsSearch] = useState('');

  const connectDevice = useConnectDevice();
  const connectRange = useConnectDeviceRange();
  const executeCommand = useExecuteCommand();
  const activities = useActivities();
  const restartAdb = useRestartAdb();
  
  const isMobile = useIsMobile();
  const shouldHideGrid = hideGridOnMobile && isMobile;
  
  const currentScale = realTimeDisplay ? cardScaleRealTime : cardScale;
  
  useEffect(() => {
    if (focusedId && gridRef.current) {
      const element = gridRef.current.querySelector(`[data-device-id="${focusedId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [focusedId]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (e.target instanceof Element && e.target.closest('[data-device-id]')) return;
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    setIsSelecting(true);
    setSelectionStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setSelectionEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting) return;
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSelectionEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseUp = () => {
    if (!isSelecting) return;
    setIsSelecting(false);

    const selectedDeviceIds: string[] = [];
    devices.forEach(device => {
      const element = deviceRefs.current.get(device.id);
      if (element) {
        const rect = element.getBoundingClientRect();
        const gridRect = gridRef.current?.getBoundingClientRect();
        if (gridRect) {
          const deviceRect = {
            left: rect.left - gridRect.left,
            top: rect.top - gridRect.top,
            right: rect.right - gridRect.left,
            bottom: rect.bottom - gridRect.top
          };
          const selRect = {
            left: Math.min(selectionStart.x, selectionEnd.x),
            top: Math.min(selectionStart.y, selectionEnd.y),
            right: Math.max(selectionStart.x, selectionEnd.x),
            bottom: Math.max(selectionStart.y, selectionEnd.y)
          };
          if (deviceRect.left < selRect.right && deviceRect.right > selRect.left &&
              deviceRect.top < selRect.bottom && deviceRect.bottom > selRect.top) {
            selectedDeviceIds.push(device.id);
          }
        }
      }
    });

    selectMany(selectedDeviceIds);
  };

  const handleRangeChange = (value: string) => {
    setRangeInput(value);
    const octets = parseOctetRange(value);
    if (octets.length > 0) {
      selectByOctets(octets);
    }
  };

  const handleConnect = () => {
    const startTrimmed = connectStartInput.trim();
    const endTrimmed = connectEndInput.trim();
    if (!startTrimmed) return;

    if (endTrimmed) {
      let startOctet, endOctet, startHost, endHost;

      if (startTrimmed.includes('.')) {
        startHost = startTrimmed.includes(':') ? startTrimmed.split(':')[0] : startTrimmed;
        startOctet = getOctet(startHost);
      } else {
        startOctet = parseInt(startTrimmed);
        startHost = `${subnetBase}.${startOctet}`;
      }

      if (endTrimmed.includes('.')) {
        endHost = endTrimmed.includes(':') ? endTrimmed.split(':')[0] : endTrimmed;
        endOctet = getOctet(endHost);
      } else {
        endOctet = parseInt(endTrimmed);
        endHost = `${subnetBase}.${endOctet}`;
      }

      connectRange.mutate({
        baseSubnet: subnetBase,
        startOctet,
        endOctet,
        port: 5555,
      });
    } else {
      const ip = startTrimmed.includes(':') ? startTrimmed.split(':')[0] : startTrimmed;
      const port = startTrimmed.includes(':') ? parseInt(startTrimmed.split(':')[1]) : 5555;
      connectDevice.mutate({ host: ip, port });
    }
  };

  const handleExecuteCommand = () => {
    if (!commandInput.trim() || selectedIds.size === 0) return;

    const parts = commandInput.trim().split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    executeCommand.mutate({
      deviceIds: Array.from(selectedIds),
      command,
      args,
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === devices.length) {
      clearSelection();
    } else {
      selectAll();
    }
  };

  const allSelected = devices.length > 0 && selectedIds.size === devices.length;

  const getOctet = (ip: string) => {
    const parts = ip.split('.');
    return parseInt(parts[3]) || 0;
  };

  const deviceIds = useMemo(() => Array.from(selectedIds), [selectedIds]);

  const sortedDevices = useMemo(() => {
    let filtered = [...devices];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(device => 
        device.name.toLowerCase().includes(query) ||
        device.model.toLowerCase().includes(query) ||
        device.ip.includes(query)
      );
    }
    
    return filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
          break;
        case 'model':
          comparison = a.model.toLowerCase().localeCompare(b.model.toLowerCase());
          break;
        case 'ip':
          comparison = a.octet - b.octet;
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [devices, sortField, sortOrder, searchQuery]);

  // Collapsible header component with search support - moved outside to prevent recreation
  const CollapsibleHeader = ({ 
    icon, 
    title, 
    isOpen, 
    onToggle,
    showSearch = false,
    searchOpen = false,
    onSearchToggle = () => {},
    searchValue = '',
    onSearchChange = () => {},
    onSearchClear = () => {}
  }: { 
    icon: React.ReactNode; 
    title: string; 
    isOpen: boolean; 
    onToggle: () => void;
    showSearch?: boolean;
    searchOpen?: boolean;
    onSearchToggle?: () => void;
    searchValue?: string;
    onSearchChange?: (value: string) => void;
    onSearchClear?: () => void;
  }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [localValue, setLocalValue] = useState(searchValue);
    const wasOpen = useRef(searchOpen);

    // Sync local value when searchValue prop changes (only when closed)
    useEffect(() => {
      if (!searchOpen) {
        setLocalValue(searchValue || '');
      }
    }, [searchValue, searchOpen]);

    // Handle focus restoration when search opens
    useEffect(() => {
      if (searchOpen && !wasOpen.current && inputRef.current) {
        // Delay focus to allow animation to complete
        setTimeout(() => inputRef.current?.focus(), 150);
      }
      wasOpen.current = searchOpen;
    }, [searchOpen]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalValue(value);
      onSearchChange?.(value);
    }, [onSearchChange]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
      e.stopPropagation();
    }, []);

    return (
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div 
          className="flex items-center gap-2 flex-1 cursor-pointer hover:text-foreground transition-colors"
          onClick={onToggle}
        >
          {icon}
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-1">
          {showSearch && (
            <div className={`relative overflow-hidden transition-all duration-200 ease-out ${searchOpen ? 'w-28' : 'w-0'}`}>
              <Input
                ref={inputRef}
                value={localValue}
                onChange={handleChange}
                placeholder="Filter..."
                className="h-6 text-xs py-1 px-2 bg-transparent border-muted-foreground/30"
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                onKeyDown={handleKeyDown}
              />
            </div>
          )}
          {showSearch && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-muted/50"
              onClick={(e) => {
                e.stopPropagation();
                onSearchToggle?.();
                if (searchOpen) {
                  setLocalValue('');
                  onSearchClear?.();
                }
              }}
            >
              {searchOpen ? <X className="w-3 h-3 text-foreground" /> : <Search className="w-3 h-3 text-foreground" />}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={cn(
      "flex h-full gap-4",
      shouldHideGrid ? "flex-col" : "flex-col lg:flex-row"
    )}>
      {/* Device Actions Sidebar */}
      <div className={cn(
        "bg-card rounded-lg shadow-sm flex flex-col",
        shouldHideGrid ? "w-full h-full" : "w-full lg:w-80 lg:flex-shrink-0 h-full"
      )}>
        <div className="p-4 border-b border-border flex-shrink-0">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <span>Device Actions</span>
            <span className="text-primary">[{selectedIds.size} selected]</span>
          </h3>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Resources Monitoring */}
            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              <CollapsibleHeader
                icon={<Server className="w-3 h-3" />}
                title="Resources"
                isOpen={showMonitoring}
                onToggle={() => setShowMonitoring(!showMonitoring)}
              />
              {showMonitoring && (
                <div className="space-y-2 pt-2">
                  <CpuMonitor />
                  <RamMonitor />
                  <ContainerMonitor />
                </div>
              )}
            </div>

            {/* Select Devices */}
            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              <CollapsibleHeader
                icon={<Grid3X3 className="w-3 h-3" />}
                title="Select Devices"
                isOpen={showSelectDevices}
                onToggle={() => setShowSelectDevices(!showSelectDevices)}
              />
              {showSelectDevices && (
                <div className="space-y-2 pt-2">
                  <Input
                    value={rangeInput}
                    onChange={(e) => handleRangeChange(e.target.value)}
                    placeholder="1-16"
                    className="bg-muted border-muted-foreground/20 font-mono text-sm h-9"
                  />
                  <Button
                    onClick={handleSelectAll}
                    variant={allSelected ? 'default' : 'outline'}
                    className="w-full gap-2 h-9"
                    size="sm"
                  >
                    {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </Button>
                  <div className="grid grid-cols-8 gap-1">
                    {sortedDevices.map((device) => (
                      <DeviceCheckbox key={device.id} device={device} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Connect Devices */}
            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              <CollapsibleHeader
                icon={<PlugZap className="w-3 h-3" />}
                title="Connect Devices"
                isOpen={showConnect}
                onToggle={() => setShowConnect(!showConnect)}
              />
              {showConnect && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={subnetBase}
                      onChange={(e) => setSubnetBase(e.target.value)}
                      placeholder="192.168.1"
                      className="bg-muted border-muted-foreground/20 font-mono text-xs h-8 w-24"
                    />
                    <span className="text-muted-foreground text-xs">.</span>
                    <Input
                      value={connectStartInput}
                      onChange={(e) => setConnectStartInput(e.target.value)}
                      placeholder="51 or 192.168.1.51:5555"
                      className="bg-muted border-muted-foreground/20 font-mono text-xs h-8 flex-1"
                      onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                    />
                    <span className="text-muted-foreground text-xs">-</span>
                    <Input
                      value={connectEndInput}
                      onChange={(e) => setConnectEndInput(e.target.value)}
                      placeholder="55 or 192.168.1.55:5555"
                      className="bg-muted border-muted-foreground/20 font-mono text-xs h-8 flex-1"
                      onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                    />
                  </div>
                  <Button
                    onClick={handleConnect}
                    disabled={!connectStartInput.trim() || connectDevice.isPending || connectRange.isPending}
                    className="w-full gap-2 h-8"
                    size="sm"
                  >
                    <PlugZap className="w-3 h-3" />
                    {connectDevice.isPending || connectRange.isPending ? 'Connecting...' : 'Connect'}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        disabled={restartAdb.isPending}
                        className="w-full gap-2 h-8 bg-red-900 text-gray-200 hover:bg-red-700"
                        size="sm"
                      >
                        <RotateCcw className="w-3 h-3" />
                        {restartAdb.isPending ? 'Restarting...' : 'Restart ADB'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="glass-card border-border max-w-md">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Restart ADB Server</AlertDialogTitle>
                        <AlertDialogDescription>
                          Please stop all running tasks first, as this action will interrupt all running tasks.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => restartAdb.mutate()}
                          className="bg-destructive hover:bg-destructive/90"
                          disabled={restartAdb.isPending}
                        >
                          {restartAdb.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Restart Anyway
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>

            {/* ADB Command */}
            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              <CollapsibleHeader
                icon={<Terminal className="w-3 h-3" />}
                title="ADB Command"
                isOpen={showAdbCommand}
                onToggle={() => setShowAdbCommand(!showAdbCommand)}
              />
              {showAdbCommand && (
                <div className="space-y-2 pt-2">
                  <Textarea
                    value={commandInput}
                    onChange={(e) => setCommandInput(e.target.value)}
                    placeholder="shell input tap 500 500"
                    className="bg-muted border-muted-foreground/20 font-mono text-xs min-h-[60px] resize-none"
                  />
                  <Button
                    onClick={handleExecuteCommand}
                    disabled={selectedIds.size === 0 || !commandInput.trim() || executeCommand.isPending}
                    className="w-full gap-2 h-8"
                    size="sm"
                  >
                    <Play className="w-3 h-3" />
                    {executeCommand.isPending ? 'Executing...' : `Run on ${selectedIds.size} device${selectedIds.size !== 1 ? 's' : ''}`}
                  </Button>
                </div>
              )}
            </div>

            {/* Activities */}
            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              <CollapsibleHeader
                icon={<Activity className="w-3 h-3" />}
                title="Activities"
                isOpen={showActivities}
                onToggle={() => setShowActivities(!showActivities)}
                showSearch={true}
                searchOpen={activitiesSearchOpen}
                onSearchToggle={() => setActivitiesSearchOpen(!activitiesSearchOpen)}
                searchValue={activitiesSearch}
                onSearchChange={setActivitiesSearch}
                onSearchClear={() => setActivitiesSearch('')}
              />
              {showActivities && (
                <div className="space-y-1 pt-2">
                  {activities.data?.data && Object.entries(activities.data.data)
                    .filter(([key, activity]) => 
                      activitiesSearch === '' || 
                      activity.name.toLowerCase().includes(activitiesSearch.toLowerCase())
                    )
                    .map(([key, activity]) => (
                    <Button
                      key={key}
                      onClick={() => {
                        if (selectedIds.size > 0) {
                          setSelectedActivity({key, activity});
                        } else {
                          toast.error('Please select at least one device');
                        }
                      }}
                      disabled={selectedIds.size === 0}
                      className="w-full gap-2 h-8"
                      size="sm"
                      variant="outline"
                    >
                      {activity.name}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Groups */}
            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              <CollapsibleHeader
                icon={<Users className="w-3 h-3" />}
                title="Groups"
                isOpen={showGroups}
                onToggle={() => setShowGroups(!showGroups)}
                showSearch={true}
                searchOpen={groupsSearchOpen}
                onSearchToggle={() => setGroupsSearchOpen(!groupsSearchOpen)}
                searchValue={groupsSearch}
                onSearchChange={setGroupsSearch}
                onSearchClear={() => setGroupsSearch('')}
              />
              {showGroups && (
                <div className="pt-2">
                  <GroupsAction searchQuery={groupsSearch} searchOpen={groupsSearchOpen} />
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Devices Section */}
      {!shouldHideGrid && (
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-4" style={{marginTop: "4px"}}>
            <div className="flex items-center gap-3">
              <Monitor className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">
                Devices <span className="text-primary">[{sortedDevices.length}]</span>
                {searchQuery && <span className="text-xs text-muted-foreground ml-2">(filtered)</span>}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <div className={`relative overflow-hidden transition-all duration-200 ease-out ${devicesSearchOpen ? 'w-48' : 'w-0'}`}>
                <Input
                  ref={devicesSearchInputRef}
                  value={devicesSearchLocal}
                  onChange={(e) => {
                    setDevicesSearchLocal(e.target.value);
                    setSearchQuery(e.target.value);
                  }}
                  placeholder="Search devices..."
                  className="h-9 text-xs bg-muted border-muted-foreground/30 pr-8"
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                />
                {devicesSearchLocal && (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDevicesSearchLocal('');
                      setSearchQuery('');
                    }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-9 w-9 p-0", devicesSearchOpen && "bg-muted")}
                onClick={(e) => {
                  e.stopPropagation();
                  setDevicesSearchOpen(!devicesSearchOpen);
                  if (devicesSearchOpen) {
                    setDevicesSearchLocal('');
                    setSearchQuery('');
                  }
                }}
              >
                {devicesSearchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
              </Button>

              <Button
                variant={realTimeDisplay ? 'default' : 'outline'}
                size="sm"
                className="h-9 gap-1"
                onClick={() => setRealTimeDisplay(!realTimeDisplay)}
              >
                <Radio className={cn("w-4 h-4", realTimeDisplay && "fill-current")} />
                <span className="hidden sm:inline">Real-Time Display</span>
              </Button>
              
              <GroupsDropdown />
              
              <DropdownMenu open={filterOpen} onOpenChange={setFilterOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1" >
                    <Filter className="w-4 h-4" />
                    <span className="hidden sm:inline">Filter</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Sort By</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => { setSortField('name'); setSortOrder('asc'); }}
                    className={cn(sortField === 'name' && 'bg-accent')}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <span>Device Name</span>
                      {sortField === 'name' && (
                        sortOrder === 'asc' ? <ArrowUp className="w-4 h-4 ml-auto" /> : <ArrowDown className="w-4 h-4 ml-auto" />
                      )}
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => { setSortField('model'); setSortOrder('asc'); }}
                    className={cn(sortField === 'model' && 'bg-accent')}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <span>Device Model</span>
                      {sortField === 'model' && (
                        sortOrder === 'asc' ? <ArrowUp className="w-4 h-4 ml-auto" /> : <ArrowDown className="w-4 h-4 ml-auto" />
                      )}
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => { setSortField('ip'); setSortOrder('asc'); }}
                    className={cn(sortField === 'ip' && 'bg-accent')}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <span>IP Host Part</span>
                      {sortField === 'ip' && (
                        sortOrder === 'asc' ? <ArrowUp className="w-4 h-4 ml-auto" /> : <ArrowDown className="w-4 h-4 ml-auto" />
                      )}
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                    <div className="flex items-center gap-2">
                      {sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                      <span>{sortOrder === 'asc' ? 'Ascending' : 'Descending'}</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:inline">Scale</span>
                <Slider
                  value={[currentScale]}
                  onValueChange={([value]) => {
                    if (realTimeDisplay) {
                      setCardScaleRealTime(value);
                    } else {
                      setCardScale(value);
                    }
                  }}
                  min={1}
                  max={4}
                  step={0.1}
                  className="w-24 sm:w-48"
                />
              </div>
            </div>
          </div>

          <div className="h-1 bg-muted rounded-full mb-4 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary-glow transition-all duration-500"
              style={{ width: '100%' }}
            />
          </div>

          <div
            ref={gridRef}
            className="h-full overflow-auto relative"
            style={{ scrollbarWidth: 'none', userSelect: 'none' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => setIsSelecting(false)}
            onDragStart={(e) => e.preventDefault()}
          >
            <div
              className="grid gap-4 p-1"
              style={{
                gridTemplateColumns: `repeat(auto-fill, minmax(${150 * currentScale}px, 1fr))`,
                gridAutoRows: realTimeDisplay ? 'auto' : `${200 * currentScale}px`,
              }}
            >
              {sortedDevices.map((device) => (
                <div
                  key={device.id}
                  data-device-id={device.id}
                  ref={(el) => {
                    if (el) deviceRefs.current.set(device.id, el);
                    else deviceRefs.current.delete(device.id);
                  }}
                >
                  <DeviceCard device={device} scale={currentScale} showRealTimeDisplay={realTimeDisplay} />
                </div>
              ))}
            </div>

            {isSelecting && (
              <div
                className="absolute border-2 border-primary bg-primary/10 pointer-events-none"
                style={{
                  left: Math.min(selectionStart.x, selectionEnd.x),
                  top: Math.min(selectionStart.y, selectionEnd.y),
                  width: Math.abs(selectionEnd.x - selectionStart.x),
                  height: Math.abs(selectionEnd.y - selectionStart.y),
                }}
              />
            )}
          </div>
        </div>
      )}

      {selectedActivity && (
        <ActivityPopup
          activityKey={selectedActivity.key}
          activity={selectedActivity.activity}
          deviceIds={deviceIds}
          isOpen={!!selectedActivity}
          onClose={() => setSelectedActivity(null)}
        />
      )}
    </div>
  );
}
