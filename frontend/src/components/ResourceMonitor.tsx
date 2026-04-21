import { useEffect, useState } from 'react';
import { getBackendUrl } from '@/services/api';
import { cn } from '@/lib/utils';

interface ResourceData {
  percent: string;
  values: {
    total?: string;
    free?: string;
    running?: string;
  };
}

interface MonitoringData {
  cpu: ResourceData;
  ram: ResourceData;
  containers: ResourceData;
}

function getColorFromPercent(percent: number): string {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 70) return 'bg-blue-500';
  if (percent >= 50) return 'bg-yellow-500';
  return 'bg-green-500';
}

function getTextColorFromPercent(percent: number): string {
  if (percent >= 90) return 'text-red-500';
  if (percent >= 70) return 'text-blue-500';
  if (percent >= 50) return 'text-yellow-500';
  return 'text-green-500';
}

function getStrokeColorFromPercent(percent: number): string {
  if (percent >= 90) return '#ef4444';
  if (percent >= 70) return '#3b82f6';
  if (percent >= 50) return '#eab308';
  return '#22c55e';
}

interface CircularProgressProps {
  percent: number;
  label: string;
  subLabel?: string;
  size?: number;
  strokeWidth?: number;
}

function CircularProgress({ percent, label, subLabel, size = 48, strokeWidth = 4 }: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;
  const color = getStrokeColorFromPercent(percent);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            className="text-muted/30"
            strokeWidth={strokeWidth}
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          <circle
            className="transition-all duration-300"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            stroke={color}
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("text-xs font-bold", getTextColorFromPercent(percent))}>
            {Math.round(percent)}%
          </span>
        </div>
      </div>
      {subLabel && (
        <span className="text-xs text-muted-foreground">{subLabel}</span>
      )}
    </div>
  );
}

interface HorizontalProgressProps {
  percent: number;
  label: string;
}

function HorizontalProgress({ percent, label }: HorizontalProgressProps) {
  const colorClass = getColorFromPercent(percent);
  const textColor = getTextColorFromPercent(percent);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground font-medium w-10">{label}</span>
      <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-300", colorClass)}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className={cn("text-xs font-bold min-w-[36px] text-right", textColor)}>
        {Math.round(percent)}%
      </span>
    </div>
  );
}

function useResourceMonitor() {
  const [monitoringData, setMonitoringData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResources = async () => {
      try {
        const backendUrl = getBackendUrl();
        const response = await fetch(`${backendUrl}/system/resources`);
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'ok') {
            setMonitoringData(data.data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch resources:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchResources();
    const interval = setInterval(fetchResources, 2000);

    return () => clearInterval(interval);
  }, []);

  const parsePercent = (percentStr: string): number => {
    const num = parseFloat(percentStr.replace('%', ''));
    return isNaN(num) ? 0 : num;
  };

  return { monitoringData, loading, parsePercent };
}

export function CpuMonitor() {
  const { monitoringData, loading, parsePercent } = useResourceMonitor();

  if (loading || !monitoringData) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium w-10">CPU</span>
        <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
          <div className="h-full w-0" />
        </div>
        <span className="text-xs text-muted-foreground">...</span>
      </div>
    );
  }

  const cpuPercent = parsePercent(monitoringData.cpu.percent);

  return <HorizontalProgress percent={cpuPercent} label="CPU" />;
}

export function RamMonitor() {
  const { monitoringData, loading, parsePercent } = useResourceMonitor();

  if (loading || !monitoringData) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium w-10">RAM</span>
        <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
          <div className="h-full w-0" />
        </div>
        <span className="text-xs text-muted-foreground">...</span>
      </div>
    );
  }

  const ramPercent = parsePercent(monitoringData.ram.percent);

  return <HorizontalProgress percent={ramPercent} label="RAM" />;
}

export function ContainerMonitor() {
  const { monitoringData, loading, parsePercent } = useResourceMonitor();

  if (loading || !monitoringData) {
    return (
      <div className="bg-muted/20 rounded">
        <div className="flex items-center gap-2 h-6">
          <span className="text-xs text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  const containerPercent = parsePercent(monitoringData.containers.percent);
  const runningContainers = monitoringData.containers.values.running || '0';
  const totalContainers = monitoringData.containers.values.total || '0';
  const freeContainers = Math.max(0, parseInt(totalContainers) - parseInt(runningContainers)).toString();

  return (
    <div className="bg-muted/20 rounded">
      <HorizontalProgress percent={containerPercent} label="Objects" />
      <div className="flex flex-wrap justify-end items-center gap-2 sm:gap-4 text-[10px] sm:text-xs md:text-sm leading-none text-muted-foreground pr-0 mt-1">
        <span className='text-[10px]'>
          Running: <span className="text-foreground  font-medium">{runningContainers}</span>
        </span>
        <span className='text-[10px]'>
          Free: <span className="text-foreground font-medium">{freeContainers}</span>
        </span>
        <span className='text-[10px]'>
          Total: <span className="text-foreground font-medium">{totalContainers}</span>
        </span>
      </div>
    </div>
  );
}

// Keep original export for backward compatibility
export function ResourceMonitor() {
  return (
    <div className="flex gap-4">
      <CpuMonitor />
      <RamMonitor />
      <ContainerMonitor />
    </div>
  );
}
