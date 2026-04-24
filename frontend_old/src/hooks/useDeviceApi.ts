import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDeviceStore } from '@/stores/deviceStore';
import * as api from '@/services/api';
import { toast } from 'sonner';
import { useOptionalAuth } from '@/lib/auth';

export function useDevices() {
  const setDevices = useDeviceStore((s) => s.setDevices);
  const { getToken } = useOptionalAuth();

  return useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const token = await getToken();
      const devices = await api.fetchDevices(token);
      setDevices(devices);
      return devices;
    },
    refetchInterval: 5000, // Poll every 5 seconds
    retry: false,
  });
}

export function useConnectDevice() {
  const queryClient = useQueryClient();
  const { getToken } = useOptionalAuth();

  return useMutation({
    mutationFn: async (request: Parameters<typeof api.connectDevice>[0]) => {
      const token = await getToken();
      return api.connectDevice(request, token);
    },
    onSuccess: (device) => {
      toast.success(`Connected to ${device.ip}`);
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useConnectDeviceRange() {
  const queryClient = useQueryClient();
  const { getToken } = useOptionalAuth();

  return useMutation({
    mutationFn: async (request: Parameters<typeof api.connectDeviceRange>[0]) => {
      const token = await getToken();
      return api.connectDeviceRange(request, token);
    },
    onSuccess: (devices) => {
      toast.success(`Connected to ${devices.length} devices`);
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDisconnectDevice() {
  const queryClient = useQueryClient();
  const { getToken } = useOptionalAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      return api.disconnectDevice(id, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useExecuteCommand() {
  const { getToken } = useOptionalAuth();

  return useMutation({
    mutationFn: async (request: Parameters<typeof api.executeCommand>[0]) => {
      const token = await getToken();
      return api.executeCommand(request, token);
    },
    onSuccess: (results) => {
      results.forEach((result) => {
        const message = result.output || result.error || 'No output';
        if (result.success) {
          toast.success(`${result.deviceId}: ${message}`);
        } else {
          toast.error(`${result.deviceId}: ${message}`);
        }
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useScanSubnet() {
  const queryClient = useQueryClient();
  const { getToken } = useOptionalAuth();

  return useMutation({
    mutationFn: async (request: Parameters<typeof api.scanSubnet>[0]) => {
      const token = await getToken();
      return api.scanSubnet(request, token);
    },
    onSuccess: (result) => {
      toast.success(`Found ${result.found} devices`);
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useRestartAdb() {
  const queryClient = useQueryClient();
  const { getToken } = useOptionalAuth();

  return useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return api.restartAdb(token);
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success('ADB server restarted successfully');
      } else {
        toast.warning('ADB restart completed with some errors');
      }
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useActivities() {
  const { getToken } = useOptionalAuth();

  return useQuery({
    queryKey: ['activities'],
    queryFn: async () => {
      const token = await getToken();
      return api.fetchActivities(token);
    },
    retry: false,
  });
}

// -----------------------
// GROUPS HOOKS
// -----------------------

export function useGroups() {
  const { getToken } = useOptionalAuth();

  return useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const token = await getToken();
      return api.fetchGroups(token);
    },
    retry: false,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  const { getToken } = useOptionalAuth();

  return useMutation({
    mutationFn: async (name: string) => {
      const token = await getToken();
      return api.createGroup(name, token);
    },
    onSuccess: (data) => {
      toast.success(`Group created successfully`);
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();
  const { getToken } = useOptionalAuth();

  return useMutation({
    mutationFn: async ({ groupId, name }: { groupId: string; name: string }) => {
      const token = await getToken();
      return api.updateGroup(groupId, name, token);
    },
    onSuccess: () => {
      toast.success(`Group updated successfully`);
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  const { getToken } = useOptionalAuth();

  return useMutation({
    mutationFn: async (groupId: string) => {
      const token = await getToken();
      return api.deleteGroup(groupId, token);
    },
    onSuccess: () => {
      toast.success(`Group deleted successfully`);
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useAddDevicesToGroup() {
  const queryClient = useQueryClient();
  const { getToken } = useOptionalAuth();

  return useMutation({
    mutationFn: async ({ groupId, devices }: { groupId: string; devices: api.CreateGroupDevice[] }) => {
      const token = await getToken();
      return api.addDevicesToGroup(groupId, devices, token);
    },
    onSuccess: (data) => {
      toast.success(`${data.added_count} device(s) added to group`);
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useRemoveDeviceFromGroup() {
  const queryClient = useQueryClient();
  const { getToken } = useOptionalAuth();

  return useMutation({
    mutationFn: async ({ groupId, deviceId }: { groupId: string; deviceId: string }) => {
      const token = await getToken();
      return api.removeDeviceFromGroup(groupId, deviceId, token);
    },
    onSuccess: () => {
      toast.success(`Device removed from group`);
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useClearGroupDevices() {
  const queryClient = useQueryClient();
  const { getToken } = useOptionalAuth();

  return useMutation({
    mutationFn: async (groupId: string) => {
      const token = await getToken();
      return api.clearGroupDevices(groupId, token);
    },
    onSuccess: () => {
      toast.success(`All devices removed from group`);
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Custom hook to select devices from a group based on serial number matching
export function useSelectDevicesFromGroup() {
  const { devices, selectMany } = useDeviceStore();

  return useMutation({
    mutationFn: async (group: api.DeviceGroup) => {
      const deviceIds: string[] = [];
      
      // Match devices by serial number
      group.devices.forEach((groupDevice) => {
        const matchingDevice = devices.find((device) => 
          device.serial === groupDevice.serial_number
        );
        if (matchingDevice) {
          deviceIds.push(matchingDevice.id);
        }
      });
      
      return deviceIds;
    },
    onSuccess: (deviceIds) => {
      if (deviceIds.length > 0) {
        selectMany(deviceIds);
      }
    },
  });
}
