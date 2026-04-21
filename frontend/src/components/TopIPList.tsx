import { useDeviceStore } from '@/stores/deviceStore';
import { cn } from '@/lib/utils';

export function TopIPList() {
  const { devices, selectedIds, toggleSelection, setFocused } = useDeviceStore();
  
  const handleClick = (id: string) => {
    toggleSelection(id);
    setFocused(id);
  };
  
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
      {devices.slice(0, 20).map((device) => (
        <button
          key={device.id}
          onClick={() => handleClick(device.id)}
          className={cn(
            'flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-mono transition-all',
            'border',
            selectedIds.has(device.id)
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-muted border-border hover:border-primary/50'
          )}
        >
          {device.ip}:{device.port}
        </button>
      ))}
      {devices.length > 20 && (
        <span className="flex-shrink-0 px-3 py-1.5 text-xs text-muted-foreground">
          +{devices.length - 20} more
        </span>
      )}
    </div>
  );
}
