import { Device } from '@/types/device';
import { useDeviceStore } from '@/stores/deviceStore';
import { cn } from '@/lib/utils';

interface MiniDeviceCardProps {
  device: Device;
}

export function MiniDeviceCard({ device }: MiniDeviceCardProps) {
  const { selectedIds, toggleSelection, setFocused } = useDeviceStore();
  const isSelected = selectedIds.has(device.id);
  
  const handleClick = () => {
    toggleSelection(device.id);
    setFocused(device.id);
  };
  
  return (
    <button
      className={cn(
        'mini-device border-border',
        isSelected && 'selected'
      )}
      onClick={handleClick}
      aria-label={`Select device ${device.octet}`}
      aria-pressed={isSelected}
      title={`${device.ip} - ${device.model}`}
    >
      {device.octet}
    </button>
  );
}
