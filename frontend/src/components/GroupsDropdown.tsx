import { useState } from 'react';
import { useGroups, useCreateGroup, useAddDevicesToGroup, useRemoveDeviceFromGroup } from '@/hooks/useDeviceApi';
import { useDeviceStore } from '@/stores/deviceStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Plus, Minus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/services/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';

export function GroupsDropdown() {
  const { data: groupsData, isLoading } = useGroups();
  const createGroup = useCreateGroup();
  const addDevicesToGroup = useAddDevicesToGroup();
  const removeDeviceFromGroup = useRemoveDeviceFromGroup();
  const { devices, selectedIds } = useDeviceStore();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const selectedDevices = devices.filter(d => selectedIds.has(d.id));

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }
    
    createGroup.mutate(newGroupName.trim(), {
      onSuccess: async (data) => {
        // If devices are selected, add them to the new group
        if (selectedDevices.length > 0) {
          const devicesToAdd: api.CreateGroupDevice[] = selectedDevices.map(d => ({
            serial_number: d.serial,
            device_name: d.name,
            model_name: d.model
          }));
          
          await addDevicesToGroup.mutateAsync({
            groupId: data.group_id,
            devices: devicesToAdd
          });
        }
        setNewGroupName('');
        setCreateDialogOpen(false);
      },
      onError: (error) => {
        toast.error(error.message);
      }
    });
  };

  const handleAssignToGroup = (groupId: string) => {
    if (selectedDevices.length === 0) {
      toast.error('Please select at least one device');
      return;
    }
    
    const devicesToAdd: api.CreateGroupDevice[] = selectedDevices.map(d => ({
      serial_number: d.serial,
      device_name: d.name,
      model_name: d.model
    }));
    
    addDevicesToGroup.mutate({ groupId, devices: devicesToAdd }, {
      onSuccess: (data) => {
        toast.success(`${data.added_count} device(s) added to group`);
        setAssignDialogOpen(false);
      },
      onError: (error) => {
        toast.error(error.message);
      }
    });
  };

  const handleRemoveFromGroup = (groupId: string) => {
    if (selectedDevices.length === 0) {
      toast.error('Please select at least one device');
      return;
    }
    
    // Find matching devices in the group and remove them
    const group = groupsData?.groups?.find(g => g.group_id === groupId);
    if (!group) return;
    
    let removedCount = 0;
    selectedDevices.forEach(device => {
      const groupDevice = group.devices?.find(
        gd => gd.serial_number === device.serial
      );
      if (groupDevice) {
        removeDeviceFromGroup.mutate(
          { groupId, deviceId: groupDevice.id },
          {
            onSuccess: () => {
              removedCount++;
            }
          }
        );
      }
    });
    
    if (removedCount > 0) {
      toast.success(`${removedCount} device(s) removed from group`);
    } else {
      toast.warning('Selected devices are not in this group');
    }
    setRemoveDialogOpen(false);
  };

  const groups = groupsData?.groups || [];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1 border-red-500/20 hover:bg-red-500/10">
            <Users className="w-4 h-4 text-red-500" />
            <span className="hidden sm:inline text-red-500">Groups</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Device Groups</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* Create Group */}
          <DropdownMenuItem 
            onClick={() => setCreateDialogOpen(true)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-green-500" />
            <span>Create Group</span>
          </DropdownMenuItem>
          
          {/* Assign To Group - only enable if devices selected */}
          <DropdownMenuItem 
            onClick={() => setAssignDialogOpen(true)}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-blue-500" />
            <span>Assign To Group</span>
          </DropdownMenuItem>
          
          {/* Remove From Group - only enable if devices selected */}
          <DropdownMenuItem 
            onClick={() => setRemoveDialogOpen(true)}
            disabled={selectedIds.size === 0 || groups.length === 0}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Minus className="w-4 h-4 text-red-500" />
            <span>Remove From Group</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {/* Existing Groups */}
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Existing Groups ({groups.length})
          </DropdownMenuLabel>
          
          {groups.length > 0 ? (
            groups.map((group) => (
              <DropdownMenuItem 
                key={group.group_id}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span>{group.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({group.devices?.length || 0})
                  </span>
                </div>
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem disabled className="text-muted-foreground text-xs">
              No groups created
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Group Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
            <DialogDescription>
              Create a new device group. You can add devices to it after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Input
                placeholder="Group name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
              />
              {selectedDevices.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedDevices.length} selected device(s) will be added to this group
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateGroup}
              disabled={createGroup.isPending}
            >
              {createGroup.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign To Group Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign To Group</DialogTitle>
            <DialogDescription>
              Select a group to add {selectedDevices.length} device(s) to.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2 py-4">
              {groups.length > 0 ? (
                groups.map((group) => (
                  <div
                    key={group.group_id}
                    onClick={() => handleAssignToGroup(group.group_id)}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{group.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {group.devices?.length || 0} devices
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No groups available. Create a group first.
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAssignDialogOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove From Group Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove From Group</DialogTitle>
            <DialogDescription>
              Select a group to remove {selectedDevices.length} device(s) from.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2 py-4">
              {groups.length > 0 ? (
                groups.map((group) => {
                  const matchingDevices = selectedDevices.filter(
                    d => group.devices?.some(gd => gd.serial_number === d.serial)
                  );
                  
                  return (
                    <div
                      key={group.group_id}
                      onClick={() => handleRemoveFromGroup(group.group_id)}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        matchingDevices.length > 0 
                          ? 'hover:bg-accent border-red-200' 
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Trash2 className={`w-4 h-4 ${matchingDevices.length > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                        <span className="font-medium">{group.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{group.devices?.length || 0} devices</span>
                        {matchingDevices.length > 0 && (
                          <span className="text-red-500">
                            (-{matchingDevices.length})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No groups available.
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRemoveDialogOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
