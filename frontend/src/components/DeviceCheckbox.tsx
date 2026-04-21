import { Device } from '@/types/device';
import { useDeviceStore } from '@/stores/deviceStore';
import { cn } from '@/lib/utils';

interface DeviceCheckboxProps {
  device: Device;
}

export function DeviceCheckbox({ device }: DeviceCheckboxProps) {
  const { selectedIds, toggleSelection, setFocused } = useDeviceStore();
  const isSelected = selectedIds.has(device.id);
  
  const handleClick = () => {
    toggleSelection(device.id);
    setFocused(device.id);
  };
  
  return (
    <button
      className={cn(
        'device-checkbox',
        isSelected && 'selected',
        device.status === 'online' && 'online',
        device.status === 'offline' && 'offline',
        device.status === 'busy' && 'busy'
      )}
      onClick={handleClick}
      aria-label={`Select device ${device.octet}`}
      aria-pressed={isSelected}
      title={`${device.ip} - ${device.model} (${device.status})`}
    />
  );
}
