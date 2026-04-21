import { Layout } from "@/components/layout";
import { useListGroups, useCreateGroup, useDeleteGroup, useUpdateGroup, getListGroupsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Users, Edit } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Groups() {
  const { data: groups, isLoading } = useListGroups({ query: { queryKey: getListGroupsQueryKey() } });
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();
  const queryClient = useQueryClient();
  
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");

  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [editData, setEditData] = useState({ name: "", description: "" });

  const handleCreate = async () => {
    if (newGroupName) {
      await createGroup.mutateAsync({ data: { name: newGroupName, description: newGroupDesc } });
      setIsCreating(false);
      setNewGroupName("");
      setNewGroupDesc("");
      queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() });
    }
  };

  const handleEdit = (group: any) => {
    setEditingGroup(group);
    setEditData({ name: group.name, description: group.description || "" });
  };

  const handleSave = async () => {
    if (editingGroup) {
      await updateGroup.mutateAsync({ id: editingGroup.id, data: editData });
      setEditingGroup(null);
      queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete this group?")) {
      await deleteGroup.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() });
    }
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6 h-full">
        <div className="flex justify-between items-end border-b border-primary/20 pb-4">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-wider text-foreground mb-1">Deployment_Groups</h1>
            <p className="text-muted-foreground text-sm">Organize devices into logical clusters.</p>
          </div>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" /> NEW_GROUP
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-none border border-primary/50 bg-card">
              <DialogHeader>
                <DialogTitle className="uppercase tracking-wider text-primary border-b border-primary/20 pb-2">Initialize_Group</DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Identifier</Label>
                  <Input 
                    value={newGroupName} 
                    onChange={e => setNewGroupName(e.target.value)}
                    className="rounded-none border-border bg-background font-mono text-sm"
                    placeholder="e.g. ALPHA_SQUAD"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Description</Label>
                  <Input 
                    value={newGroupDesc} 
                    onChange={e => setNewGroupDesc(e.target.value)}
                    className="rounded-none border-border bg-background font-mono text-sm"
                    placeholder="Optional context..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" className="rounded-none border-border" onClick={() => setIsCreating(false)}>CANCEL</Button>
                <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleCreate} disabled={!newGroupName || createGroup.isPending}>
                  {createGroup.isPending ? "INITIALIZING..." : "CREATE"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
             {Array(6).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full border border-border bg-card/50 rounded-none" />
             ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {groups?.map((group) => (
              <Card key={group.id} className="rounded-none border border-border bg-card relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-3 opacity-10">
                   <Users className="w-16 h-16" />
                 </div>
                 <div className="absolute top-0 left-0 w-1 h-full bg-primary/50" />
                 <CardHeader className="pb-2">
                   <CardTitle className="text-lg font-bold uppercase tracking-wider">{group.name}</CardTitle>
                   <CardDescription className="text-xs text-muted-foreground h-8 line-clamp-2">{group.description || 'No description provided.'}</CardDescription>
                 </CardHeader>
                 <CardContent>
                    <div className="flex items-center gap-2 mt-2">
                       <span className="text-3xl font-bold font-mono text-primary">{group.deviceCount.toString().padStart(2, '0')}</span>
                       <span className="text-xs uppercase text-muted-foreground tracking-widest">Nodes<br/>Assigned</span>
                    </div>
                 </CardContent>
                 <CardFooter className="pt-0 justify-end gap-1 border-t border-border/50 bg-muted/20 p-2 opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-0 w-full">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:text-primary hover:bg-primary/10" onClick={() => handleEdit(group)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(group.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                 </CardFooter>
              </Card>
            ))}
            {groups?.length === 0 && (
              <div className="col-span-full py-12 text-center border border-dashed border-border bg-card/20 flex flex-col items-center justify-center">
                <Users className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
                <p className="text-muted-foreground uppercase tracking-widest text-sm">No groups deployed</p>
              </div>
            )}
          </div>
        )}

        <Dialog open={!!editingGroup} onOpenChange={(open) => !open && setEditingGroup(null)}>
          <DialogContent className="rounded-none border border-primary/50 bg-card">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-wider text-primary border-b border-primary/20 pb-2">Edit_Group</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">Identifier</Label>
                <Input 
                  value={editData.name} 
                  onChange={e => setEditData({...editData, name: e.target.value})}
                  className="rounded-none border-border bg-background font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">Description</Label>
                <Input 
                  value={editData.description} 
                  onChange={e => setEditData({...editData, description: e.target.value})}
                  className="rounded-none border-border bg-background font-mono text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="rounded-none border-border" onClick={() => setEditingGroup(null)}>CANCEL</Button>
              <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSave} disabled={updateGroup.isPending}>
                {updateGroup.isPending ? "SAVING..." : "SAVE_CHANGES"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
