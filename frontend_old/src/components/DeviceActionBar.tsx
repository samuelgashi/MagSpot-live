import { useState, useEffect } from 'react';
import { useDeviceStore } from '@/stores/deviceStore';
import { parseOctetRange } from '@/lib/mockDevices';
import { DeviceCheckbox } from './DeviceCheckbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useConnectDevice, useConnectDeviceRange, useExecuteCommand, useRestartAdb } from '@/hooks/useDeviceApi';
import { Play, PlugZap, Terminal, CheckSquare, Square, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DeviceActionBar() {
  const { 
    devices, 
    selectedIds, 
    selectAll,
    clearSelection,
    selectByOctets
  } = useDeviceStore();
  
  const [rangeInput, setRangeInput] = useState('1-16');
  const [connectInput, setConnectInput] = useState('');
  const [commandInput, setCommandInput] = useState('');
  const [subnetBase, setSubnetBase] = useState(() => {
    return import.meta.env.VITE_NETWORK_BASE_IP || '192.168.1';
  });
  
  const connectDevice = useConnectDevice();
  const connectRange = useConnectDeviceRange();
  const executeCommand = useExecuteCommand();
  const restartAdb = useRestartAdb();
  
  const handleRangeChange = (value: string) => {
    setRangeInput(value);
    const octets = parseOctetRange(value);
    if (octets.length > 0) {
      selectByOctets(octets);
    }
  };
  
  const handleConnect = () => {
    const trimmed = connectInput.trim();
    if (!trimmed) return;
    
    // Check if it's a range (e.g., "1-254" or "5,10-20")
    if (/^[\d,\-\s]+$/.test(trimmed) && !trimmed.includes('.')) {
      const octets = parseOctetRange(trimmed);
      if (octets.length > 0) {
        const minOctet = Math.min(...octets);
        const maxOctet = Math.max(...octets);
        connectRange.mutate({
          baseSubnet: subnetBase,
          startOctet: minOctet,
          endOctet: maxOctet,
          port: 5555,
        });
      }
    } else {
      // It's a full IP address
      const ip = trimmed.includes(':') ? trimmed.split(':')[0] : trimmed;
      const port = trimmed.includes(':') ? parseInt(trimmed.split(':')[1]) : 5555;
      connectDevice.mutate({ host: ip, port });
    }
  };
  
  const handleExecuteCommand = () => {
    if (!commandInput.trim() || selectedIds.size === 0) return;
    
    // Parse the command (first word is command, rest are args)
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
  
  return (
    <div className="h-full flex flex-col border-r border-border bg-sidebar-background w-72 overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <span>Devices</span>
          <span className="text-primary">[{devices.length}]</span>
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {selectedIds.size} selected
        </p>
      </div>
      
      {/* Range Input */}
      <div className="p-3 border-b border-sidebar-border">
        <Input
          value={rangeInput}
          onChange={(e) => handleRangeChange(e.target.value)}
          placeholder="1-16"
          className="bg-muted border-muted-foreground/20 font-mono text-sm h-9"
        />
      </div>
      
      {/* Select All Button */}
      <div className="p-3 border-b border-sidebar-border">
        <Button
          onClick={handleSelectAll}
          variant={allSelected ? 'default' : 'outline'}
          className="w-full gap-2 h-9"
          size="sm"
        >
          {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          {allSelected ? 'Deselect All' : 'Select All'}
        </Button>
      </div>
      
      {/* Device Checkbox Grid */}
      <div className="flex-1 overflow-auto p-3 scrollbar-thin">
        <div className="grid grid-cols-8 gap-1">
          {devices.map((device) => (
            <DeviceCheckbox key={device.id} device={device} />
          ))}
        </div>
      </div>
      
      {/* Connect Section */}
      <div className="p-3 border-t border-sidebar-border space-y-3">
        <div className="flex items-center gap-2">
          <Input
            value={subnetBase}
            onChange={(e) => setSubnetBase(e.target.value)}
            placeholder="192.168.1"
            className="bg-muted border-muted-foreground/20 font-mono text-xs h-8 w-24"
          />
          <span className="text-muted-foreground text-xs">.</span>
          <Input
            value={connectInput}
            onChange={(e) => setConnectInput(e.target.value)}
            placeholder="1-254 or IP"
            className="bg-muted border-muted-foreground/20 font-mono text-xs h-8 flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
          />
        </div>
        <Button
          onClick={handleConnect}
          disabled={!connectInput.trim() || connectDevice.isPending || connectRange.isPending}
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
              className="w-full gap-2 h-8"
              size="sm"
              variant="outline"
            >
              <RotateCcw className="w-3 h-3" />
              {restartAdb.isPending ? 'Restarting...' : 'Restart ADB'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Restart ADB Server</AlertDialogTitle>
              <AlertDialogDescription className="text-base">
                Please stop all running tasks first, as this action will interrupt all running tasks.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:flex-col">
              <AlertDialogCancel className="w-full sm:w-auto mt-2 sm:mt-0">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => restartAdb.mutate()}
                className="w-full sm:w-auto"
                disabled={restartAdb.isPending}
              >
                {restartAdb.isPending ? 'Restarting...' : 'Restart Anyway'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      
      {/* ADB Command Section */}
      <div className="p-3 border-t border-sidebar-border space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Terminal className="w-3 h-3" />
          <span>ADB Command</span>
        </div>
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
    </div>
  );
}
