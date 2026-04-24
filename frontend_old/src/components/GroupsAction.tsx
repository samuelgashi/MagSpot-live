import { useState, useMemo, useRef, useEffect } from 'react';
import { useGroups, useDeleteGroup, useSelectDevicesFromGroup } from '@/hooks/useDeviceApi';
import { useDeviceStore } from '@/stores/deviceStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface GroupsActionProps {
  searchQuery?: string;
  searchOpen?: boolean;
}

export function GroupsAction({ searchQuery = '', searchOpen = false }: GroupsActionProps) {
  const { data: groupsData, isLoading, error } = useGroups();
  const deleteGroup = useDeleteGroup();
  const selectDevicesFromGroup = useSelectDevicesFromGroup();
  const { devices, selectMany, clearSelection } = useDeviceStore();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
  const [localSearch, setLocalSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const groups = groupsData?.groups || [];

  // Filter groups based on search query (use local state if parent search not open)
  const effectiveSearch = searchOpen ? searchQuery : localSearch;
  
  const filteredGroups = useMemo(() => {
    if (!effectiveSearch) return groups;
    return groups.filter((group: any) => 
      group.name.toLowerCase().includes(effectiveSearch.toLowerCase())
    );
  }, [groups, effectiveSearch]);

  // Calculate dynamic height based on number of items (max 5 rows)
  const rowHeight = 32;
  const maxVisibleRows = 5;
  const visibleRows = Math.min(filteredGroups.length, maxVisibleRows);
  const dynamicHeight = visibleRows > 0 ? visibleRows * rowHeight : 40;

  // Focus input when search opens
  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  const handleGroupClick = (group: any) => {
    selectDevicesFromGroup.mutate(group, {
      onSuccess: (deviceIds) => {
        if (deviceIds.length > 0) {
          selectMany(deviceIds);
          toast.success(`Selected ${deviceIds.length} device(s) from group "${group.name}"`);
        } else {
          toast.warning('No matching devices found in current device list');
        }
      },
      onError: (error) => {
        toast.error('Failed to select devices from group');
      },
    });
  };

  const handleDeleteClick = (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation();
    setGroupToDelete(groupId);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (groupToDelete) {
      deleteGroup.mutate(groupToDelete);
    }
    setDeleteConfirmOpen(false);
    setGroupToDelete(null);
  };

  const getGroupDisplayName = (group: any) => {
    return group.name;
  };

  if (isLoading) {
    return (
      <div className="mb-3 space-y-2" style={{ marginTop: "0px" }}>
        {/* <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="w-3 h-3" />
          <span>Groups</span>
        </div> */}
        <div className="text-xs text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-3 space-y-2" style={{ marginTop: "0px" }}>
        {/* <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="w-3 h-3" />
          <span>Groups</span>
        </div> */}
        <div className="text-xs text-destructive">Failed to load groups</div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-3 space-y-2" style={{ marginTop: "0px" }}>
        {/* <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="w-3 h-3" />
          <span>Groups</span>
        </div> */}
        
        {filteredGroups.length === 0 ? (
          <div className="text-xs text-muted-foreground py-2">
            {effectiveSearch ? 'No matching groups' : 'No Groups'}
          </div>
        ) : (
          <ScrollArea className="transition-all duration-200" style={{ height: `${dynamicHeight}px`, maxHeight: `${maxVisibleRows * rowHeight}px` }}>
            <div className="space-y-1 pr-2">
              {filteredGroups.map((group: any) => (
                <div
                  key={group.group_id}
                  onClick={() => handleGroupClick(group)}
                  className="group flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-muted/50 hover:bg-muted cursor-pointer transition-colors text-xs"
                >
                  <span className="truncate font-medium">{getGroupDisplayName(group)}</span>
                  <span className="text-muted-foreground text-[10px]">
                    {group.devices?.length || 0} devices
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 opacity-0 group-hover:opacity-100 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                    onClick={(e) => handleDeleteClick(e, group.group_id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this group? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteGroup.isPending}
            >
              {deleteGroup.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
