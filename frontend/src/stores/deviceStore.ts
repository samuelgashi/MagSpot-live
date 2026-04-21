import { create } from 'zustand';
import { Device } from '@/types/device';
import { generateMockDevices } from '@/lib/mockDevices';

interface DeviceStore {
  devices: Device[];
  selectedIds: Set<string>;
  focusedId: string | null;
  cardScale: number;
  cardScaleRealTime: number;
  taskPanelOpen: boolean;
  searchQuery: string;
  
  // Actions
  setDevices: (devices: Device[]) => void;
  toggleSelection: (id: string) => void;
  selectMany: (ids: string[]) => void;
  clearSelection: () => void;
  selectAll: () => void;
  setFocused: (id: string | null) => void;
  setCardScale: (scale: number) => void;
  setCardScaleRealTime: (scale: number) => void;
  setTaskPanelOpen: (open: boolean) => void;
  selectByOctets: (octets: number[]) => void;
  setSearchQuery: (query: string) => void;
}

export const useDeviceStore = create<DeviceStore>((set, get) => ({
  devices: generateMockDevices('192.168.1', 30),
  selectedIds: new Set<string>(),
  focusedId: null,
  cardScale: 1,
  cardScaleRealTime: 1,
  taskPanelOpen: false,
  searchQuery: '',
  
  setDevices: (devices) => set({
    devices: devices.sort((a, b) => {
      if (a.model !== b.model) {
        return a.model.localeCompare(b.model);
      }
      return a.octet - b.octet;
    })
  }),
  
  toggleSelection: (id) => set((state) => {
    const newSelected = new Set(state.selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    return { selectedIds: newSelected };
  }),
  
  selectMany: (ids) => set((state) => {
    const newSelected = new Set(state.selectedIds);
    ids.forEach(id => newSelected.add(id));
    return { selectedIds: newSelected };
  }),
  
  clearSelection: () => set({ selectedIds: new Set() }),
  
  selectAll: () => set((state) => ({
    selectedIds: new Set(state.devices.map(d => d.id))
  })),
  
  setFocused: (id) => set({ focusedId: id }),
  
  setCardScale: (scale) => set({ cardScale: Math.max(0.5, Math.min(4, scale)) }),
  
  setCardScaleRealTime: (scale) => set({ cardScaleRealTime: Math.max(0.5, Math.min(4, scale)) }),
  
  setTaskPanelOpen: (open) => set({ taskPanelOpen: open }),
  
  selectByOctets: (octets) => set((state) => {
    const ids = state.devices
      .filter(d => octets.includes(d.octet))
      .map(d => d.id);
    return { selectedIds: new Set(ids) };
  }),
  
  setSearchQuery: (query) => set({ searchQuery: query }),
}));
