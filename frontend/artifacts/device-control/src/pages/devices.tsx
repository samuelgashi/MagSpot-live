import { Layout } from "@/components/layout";
import { useListDevices, useCreateDevice, useDeleteDevice, useUpdateDevice, getListDevicesQueryKey } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Edit, RefreshCw, Plus } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Devices() {
  const { data: devices, isLoading, refetch } = useListDevices({ query: { queryKey: getListDevicesQueryKey() } });
  const createDevice = useCreateDevice();
  const deleteDevice = useDeleteDevice();
  const updateDevice = useUpdateDevice();
  const queryClient = useQueryClient();
  
  const [isCreating, setIsCreating] = useState(false);
  const [newDevice, setNewDevice] = useState({ name: "", ip: "" });
  
  const [editingDevice, setEditingDevice] = useState<any>(null);
  const [editData, setEditData] = useState({ name: "", ip: "" });

  const handleCreate = async () => {
    if (newDevice.name && newDevice.ip) {
      await createDevice.mutateAsync({ data: newDevice });
      setIsCreating(false);
      setNewDevice({ name: "", ip: "" });
      queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete this device?")) {
      await deleteDevice.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
    }
  };

  const handleEdit = (device: any) => {
    setEditingDevice(device);
    setEditData({ name: device.name, ip: device.ip });
  };

  const handleSave = async () => {
    if (editingDevice) {
      await updateDevice.mutateAsync({ id: editingDevice.id, data: { name: editData.name, ip: editData.ip } });
      setEditingDevice(null);
      queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
    }
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6 h-full">
        <div className="flex justify-between items-end border-b border-primary/20 pb-4">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-wider text-foreground mb-1">Device_Roster</h1>
            <p className="text-muted-foreground text-sm">Comprehensive listing of all connected nodes.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-none border-primary/50 text-primary hover:bg-primary/10" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" /> REFRESH
            </Button>
            <Dialog open={isCreating} onOpenChange={setIsCreating}>
              <DialogTrigger asChild>
                <Button size="sm" className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" /> REGISTER_NODE
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-none border border-primary/50 bg-card">
                <DialogHeader>
                  <DialogTitle className="uppercase tracking-wider text-primary border-b border-primary/20 pb-2">Manual_Registration</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">Node Name</Label>
                    <Input 
                      value={newDevice.name} 
                      onChange={e => setNewDevice({...newDevice, name: e.target.value})}
                      className="rounded-none border-border bg-background font-mono text-sm"
                      placeholder="e.g. NODE-001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">IP Address</Label>
                    <Input 
                      value={newDevice.ip} 
                      onChange={e => setNewDevice({...newDevice, ip: e.target.value})}
                      className="rounded-none border-border bg-background font-mono text-sm"
                      placeholder="192.168.1.x"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" className="rounded-none border-border" onClick={() => setIsCreating(false)}>CANCEL</Button>
                  <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleCreate} disabled={!newDevice.name || !newDevice.ip || createDevice.isPending}>
                    {createDevice.isPending ? "REGISTERING..." : "REGISTER"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="border border-border bg-card/40 flex-1 overflow-auto rounded-none relative">
           <div className="absolute inset-0 pointer-events-none border-[1px] border-primary/10 m-1" />
           {isLoading ? (
              <div className="p-4 flex flex-col gap-2">
                {Array(10).fill(0).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-none bg-card/60" />
                ))}
              </div>
           ) : (
            <Table className="relative z-10">
              <TableHeader className="bg-muted/50 sticky top-0">
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="font-bold text-primary/80 uppercase text-xs tracking-wider">ID</TableHead>
                  <TableHead className="font-bold text-primary/80 uppercase text-xs tracking-wider">Name</TableHead>
                  <TableHead className="font-bold text-primary/80 uppercase text-xs tracking-wider">IP Address</TableHead>
                  <TableHead className="font-bold text-primary/80 uppercase text-xs tracking-wider">Status</TableHead>
                  <TableHead className="font-bold text-primary/80 uppercase text-xs tracking-wider">Model</TableHead>
                  <TableHead className="font-bold text-primary/80 uppercase text-xs tracking-wider">Battery</TableHead>
                  <TableHead className="text-right font-bold text-primary/80 uppercase text-xs tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices?.map((device) => (
                  <TableRow key={device.id} className="border-b border-border/50 hover:bg-primary/5 group">
                    <TableCell className="font-mono text-xs text-muted-foreground">{device.id.toString().padStart(4, '0')}</TableCell>
                    <TableCell className="font-medium">{device.name}</TableCell>
                    <TableCell className="font-mono text-xs">{device.ip}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] rounded-none px-2 py-0 border uppercase ${
                        device.status === 'online' ? 'border-primary text-primary bg-primary/10' :
                        device.status === 'busy' ? 'border-yellow-500 text-yellow-500 bg-yellow-500/10' :
                        device.status === 'offline' ? 'border-destructive text-destructive bg-destructive/10' : 'border-muted-foreground text-muted-foreground'
                      }`}>
                        {device.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{device.model || '--'}</TableCell>
                    <TableCell className="font-mono text-xs">{device.batteryLevel ?? '--'}%</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:text-primary" onClick={() => handleEdit(device)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:text-destructive" onClick={() => handleDelete(device.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {devices?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground font-mono">
                      [NO_NODES_REGISTERED]
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
           )}
        </div>

        <Dialog open={!!editingDevice} onOpenChange={(open) => !open && setEditingDevice(null)}>
          <DialogContent className="rounded-none border border-primary/50 bg-card">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-wider text-primary border-b border-primary/20 pb-2">Edit_Node</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">Node Name</Label>
                <Input 
                  value={editData.name} 
                  onChange={e => setEditData({...editData, name: e.target.value})}
                  className="rounded-none border-border bg-background font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">IP Address</Label>
                <Input 
                  value={editData.ip} 
                  onChange={e => setEditData({...editData, ip: e.target.value})}
                  className="rounded-none border-border bg-background font-mono text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="rounded-none border-border" onClick={() => setEditingDevice(null)}>CANCEL</Button>
              <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSave} disabled={updateDevice.isPending}>
                {updateDevice.isPending ? "SAVING..." : "SAVE_CHANGES"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
