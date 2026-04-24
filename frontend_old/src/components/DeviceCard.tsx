import { Device } from '@/types/device';
import { useDeviceStore } from '@/stores/deviceStore';
import { cn } from '@/lib/utils';
import { Smartphone } from 'lucide-react';

interface DeviceCardProps {
  device: Device;
  scale?: number;
  showRealTimeDisplay?: boolean;
}

export function DeviceCard({ device, scale = 1, showRealTimeDisplay = false }: DeviceCardProps) {
  const { selectedIds, focusedId, toggleSelection, setFocused } = useDeviceStore();
  const isSelected = selectedIds.has(device.id);
  const isFocused = focusedId === device.id;
  
  const normalWidth = 160;
  const normalHeight = 200;
  const headerHeight = 30;
  const rtCardHeight = 280;
  
  const currentScale = showRealTimeDisplay ? scale : scale;
  const cardWidth = normalWidth * currentScale;
  const cardHeight = showRealTimeDisplay ? rtCardHeight * currentScale : normalHeight * currentScale;
  
  const handleClick = () => {
    toggleSelection(device.id);
  };
  
  const handleDoubleClick = () => {
    setFocused(isFocused ? null : device.id);
  };
  
  return (
    <div
      className={cn(
        'device-card border-border',
        isSelected && 'selected',
        isFocused && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
      )}
      style={{
        width: cardWidth,
        height: cardHeight,
        minHeight: cardHeight,
        transition: 'width 0.3s ease, height 0.3s ease, min-height 0.3s ease',
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      role="button"
      tabIndex={0}
      aria-label={`Device ${device.model} at ${device.ip}`}
      aria-pressed={isSelected}
    >
      <div className="device-card-header" style={{ height: headerHeight, minHeight: headerHeight }}>
        {device.name} [{device.octet}]
      </div>
      
      <div 
        className={cn(
          'flex flex-col h-full',
          !showRealTimeDisplay && 'p-3 gap-2'
        )}
        style={{ 
          padding: showRealTimeDisplay ? '2px' : undefined,
          fontSize: `${Math.max(0.7, scale * 0.85)}rem`,
          transition: 'padding 0.3s ease'
        }}
      >
        {showRealTimeDisplay && (
          <div className="flex-1 min-h-0 w-full rounded overflow-hidden bg-black relative flex items-center justify-center">
            <span className="text-white text-lg font-semibold">Coming Soon</span>
          </div>
        )}
        
        {!showRealTimeDisplay && (
          <>
            <div className="flex items-center gap-2">
              <span className={cn(
                'status-indicator',
                device.status === 'online' && 'status-online',
                device.status === 'offline' && 'status-offline',
                device.status === 'busy' && 'status-busy'
              )} />
              <span className="text-muted-foreground capitalize text-xs">{device.status}</span>
            </div>
            
            <div className="flex items-center gap-2 text-muted-foreground">
              <Smartphone className="w-3 h-3 flex-shrink-0" />
              <span className="font-mono text-xs truncate">{device.ip}:{device.port}</span>
            </div>
            
            {scale > 0.7 && (
              <div className="text-xs text-muted-foreground truncate">
                <span className="text-foreground/60">S/N:</span> {device.serial}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
