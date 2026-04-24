import { Layout } from "@/components/layout";
import { useListTasks, useCreateTask, useDeleteTask, useUpdateTask, getListTasksQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Play, FileCode2, Edit } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function Tasks() {
  const { data: tasks, isLoading } = useListTasks({ query: { queryKey: getListTasksQueryKey() } });
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const queryClient = useQueryClient();
  
  const [isCreating, setIsCreating] = useState(false);
  const [newTask, setNewTask] = useState({ name: "", type: "custom" as const, durationMin: 1, durationMax: 5 });

  const [editingTask, setEditingTask] = useState<any>(null);
  const [editData, setEditData] = useState({ name: "", type: "custom" as const, durationMin: 1, durationMax: 5 });

  const handleCreate = async () => {
    if (newTask.name) {
      await createTask.mutateAsync({ data: newTask });
      setIsCreating(false);
      setNewTask({ name: "", type: "custom", durationMin: 1, durationMax: 5 });
      queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    }
  };

  const handleEdit = (task: any) => {
    setEditingTask(task);
    setEditData({ name: task.name, type: task.type, durationMin: task.durationMin, durationMax: task.durationMax });
  };

  const handleSave = async () => {
    if (editingTask) {
      await updateTask.mutateAsync({ id: editingTask.id, data: editData });
      setEditingTask(null);
      queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete this task definition?")) {
      await deleteTask.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    }
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6 h-full">
        <div className="flex justify-between items-end border-b border-primary/20 pb-4">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-wider text-foreground mb-1">Task_Library</h1>
            <p className="text-muted-foreground text-sm">Execution protocols and automated sequences.</p>
          </div>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" /> COMPILE_PROTOCOL
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-none border border-primary/50 bg-card">
              <DialogHeader>
                <DialogTitle className="uppercase tracking-wider text-primary border-b border-primary/20 pb-2">New_Protocol</DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Protocol Name</Label>
                  <Input 
                    value={newTask.name} 
                    onChange={e => setNewTask({...newTask, name: e.target.value})}
                    className="rounded-none border-border bg-background font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Type</Label>
                  <Select value={newTask.type} onValueChange={(val: any) => setNewTask({...newTask, type: val})}>
                    <SelectTrigger className="rounded-none border-border bg-background font-mono text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border-border bg-card">
                      <SelectItem value="youtube">YouTube Watch</SelectItem>
                      <SelectItem value="music">Music Stream</SelectItem>
                      <SelectItem value="browse">Web Browse</SelectItem>
                      <SelectItem value="search">Search Sequence</SelectItem>
                      <SelectItem value="custom">Custom Script</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">Min Duration (m)</Label>
                    <Input 
                      type="number"
                      value={newTask.durationMin} 
                      onChange={e => setNewTask({...newTask, durationMin: parseInt(e.target.value) || 1})}
                      className="rounded-none border-border bg-background font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">Max Duration (m)</Label>
                    <Input 
                      type="number"
                      value={newTask.durationMax} 
                      onChange={e => setNewTask({...newTask, durationMax: parseInt(e.target.value) || 5})}
                      className="rounded-none border-border bg-background font-mono text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" className="rounded-none border-border" onClick={() => setIsCreating(false)}>ABORT</Button>
                <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleCreate} disabled={!newTask.name || createTask.isPending}>
                  {createTask.isPending ? "COMPILING..." : "COMPILE"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {Array(6).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-48 w-full border border-border bg-card/50 rounded-none" />
             ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tasks?.map((task) => (
              <Card key={task.id} className="rounded-none border border-border bg-card relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
                   <FileCode2 className="w-20 h-20" />
                 </div>
                 <div className="absolute left-0 top-0 w-full h-1 bg-primary/20 group-hover:bg-primary/60 transition-colors" />
                 <CardHeader className="pb-2">
                   <div className="flex justify-between items-start">
                     <CardTitle className="text-lg font-bold uppercase tracking-wider font-mono pr-2">{task.name}</CardTitle>
                     <Badge variant="outline" className="rounded-none border-primary/50 text-primary uppercase text-[10px]">
                       {task.type}
                     </Badge>
                   </div>
                   <CardDescription className="text-xs text-muted-foreground h-8 line-clamp-2 mt-2">{task.description || 'Standard execution protocol.'}</CardDescription>
                 </CardHeader>
                 <CardContent>
                    <div className="flex flex-col gap-1 mt-2 font-mono text-xs">
                       <div className="flex justify-between border-b border-border/50 pb-1">
                         <span className="text-muted-foreground">DURATION_RANGE:</span>
                         <span>{task.durationMin}m - {task.durationMax}m</span>
                       </div>
                       <div className="flex justify-between pt-1">
                         <span className="text-muted-foreground">ID_HASH:</span>
                         <span>{task.id.toString().padStart(8, '0')}</span>
                       </div>
                    </div>
                 </CardContent>
                 <CardFooter className="flex justify-between border-t border-border/50 bg-muted/10 p-2 mt-4">
                    <Button variant="ghost" size="sm" className="h-8 rounded-none text-xs text-primary hover:text-primary hover:bg-primary/10">
                      <Play className="w-3 h-3 mr-2" /> EXECUTE
                    </Button>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:text-primary hover:bg-primary/10" onClick={() => handleEdit(task)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(task.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                 </CardFooter>
              </Card>
            ))}
            {tasks?.length === 0 && (
              <div className="col-span-full py-12 text-center border border-dashed border-border bg-card/20 flex flex-col items-center justify-center">
                <FileCode2 className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
                <p className="text-muted-foreground uppercase tracking-widest text-sm">No protocols defined</p>
              </div>
            )}
          </div>
        )}

        <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
          <DialogContent className="rounded-none border border-primary/50 bg-card">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-wider text-primary border-b border-primary/20 pb-2">Edit_Protocol</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">Protocol Name</Label>
                <Input 
                  value={editData.name} 
                  onChange={e => setEditData({...editData, name: e.target.value})}
                  className="rounded-none border-border bg-background font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">Type</Label>
                <Select value={editData.type} onValueChange={(val: any) => setEditData({...editData, type: val})}>
                  <SelectTrigger className="rounded-none border-border bg-background font-mono text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-border bg-card">
                    <SelectItem value="youtube">YouTube Watch</SelectItem>
                    <SelectItem value="music">Music Stream</SelectItem>
                    <SelectItem value="browse">Web Browse</SelectItem>
                    <SelectItem value="search">Search Sequence</SelectItem>
                    <SelectItem value="custom">Custom Script</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Min Duration (m)</Label>
                  <Input 
                    type="number"
                    value={editData.durationMin} 
                    onChange={e => setEditData({...editData, durationMin: parseInt(e.target.value) || 1})}
                    className="rounded-none border-border bg-background font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Max Duration (m)</Label>
                  <Input 
                    type="number"
                    value={editData.durationMax} 
                    onChange={e => setEditData({...editData, durationMax: parseInt(e.target.value) || 5})}
                    className="rounded-none border-border bg-background font-mono text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="rounded-none border-border" onClick={() => setEditingTask(null)}>CANCEL</Button>
              <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSave} disabled={updateTask.isPending}>
                {updateTask.isPending ? "SAVING..." : "SAVE_CHANGES"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
