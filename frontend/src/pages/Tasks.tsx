import { useState, useRef } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useOptionalAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ListTodo,
  Search,
  Loader2,
  StopCircle,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  List,
  Loader,
} from 'lucide-react';
import { taskApi, Task, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

type StatusFilter = 'ALL' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'QUEUED' | 'BUSY';

export default function Tasks() {
  const { toast } = useToast();
  const taskStatusRef = useRef<HTMLDivElement>(null);
  const [taskId, setTaskId] = useState('');
  const [loading, setLoading] = useState(false);
  const [task, setTask] = useState<Task | null>(null);
  const [stopAllDialogOpen, setStopAllDialogOpen] = useState(false);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [stoppingAll, setStoppingAll] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });
  const isMobile = useIsMobile();
  const { getToken } = useOptionalAuth();

  // All tasks state
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loadingAllTasks, setLoadingAllTasks] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const handleGetStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskId.trim()) return;

    setLoading(true);
    const token = await getToken();
    const result = await taskApi.getStatus(taskId.trim(), token);
    if ('error' in result) {
      toast({
        title: `${result.status} ${result.statusText}`,
        description: result.error,
        variant: 'destructive',
      });
      setTask(null);
    } else {
      setTask(result.data);
      toast({
        title: `${result.status} ${result.statusText}`,
        description: `Task status: ${result.data.status}`,
      });
    }
    setLoading(false);
  };

  const handleGetAllTasks = async () => {
    setLoadingAllTasks(true);
    const token = await getToken();
    const result = await taskApi.getAll(token);
    if ('error' in result) {
      toast({
        title: `${result.status} ${result.statusText}`,
        description: result.error,
        variant: 'destructive',
      });
    } else {
      setAllTasks(result.data.tasks || []);
      toast({
        title: `${result.status} ${result.statusText}`,
        description: `Found ${result.data.tasks?.length || 0} task(s)`,
      });
    }
    setLoadingAllTasks(false);
  };

  const handleSelectTask = async (selectedTaskId: string) => {
    setTaskId(selectedTaskId);
    setLoading(true);
    const token = await getToken();
    const result = await taskApi.getStatus(selectedTaskId, token);
    if ('error' in result) {
      toast({
        title: `${result.status} ${result.statusText}`,
        description: result.error,
        variant: 'destructive',
      });
      setTask(null);
    } else {
      setTask(result.data);
      toast({
        title: `${result.status} ${result.statusText}`,
        description: `Task status: ${result.data.status}`,
      });
      // Scroll to task status section
      setTimeout(() => {
        taskStatusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
    setLoading(false);
  };

  const handleStopTask = async () => {
    if (!task) return;

    const token = await getToken();
    const result = await taskApi.stop(task.task_id, token);
    if ('error' in result) {
      toast({
        title: `${result.status} ${result.statusText}`,
        description: result.error,
        variant: 'destructive',
      });
    } else {
      toast({
        title: `${result.status} ${result.statusText}`,
        description: result.data.message,
      });
      // Refresh task status
      const updatedResult = await taskApi.getStatus(task.task_id, token);
      if ('data' in updatedResult) {
        setTask(updatedResult.data);
      }
    }
  };

  const handleStopAll = async () => {
    setStoppingAll(true);
    const token = await getToken();
    const result = await taskApi.stopAll(token);
    if ('error' in result) {
      toast({
        title: `${result.status} ${result.statusText}`,
        description: result.error,
        variant: 'destructive',
      });
    } else {
      toast({
        title: `${result.status} ${result.statusText}`,
        description: result.data.message,
      });
      setStopAllDialogOpen(false);
      setTask(null);
      // Refresh all tasks if they were loaded
      if (allTasks.length > 0) {
        handleGetAllTasks();
      }
    }
    setStoppingAll(false);
  };

  const handleClearAll = async () => {
    setClearingAll(true);
    const token = await getToken();
    const result = await taskApi.clearAll(token);
    if ('error' in result) {
      toast({
        title: `${result.status} ${result.statusText}`,
        description: result.error,
        variant: 'destructive',
      });
    } else {
      toast({
        title: `${result.status} ${result.statusText}`,
        description: result.data.message,
      });
      setClearAllDialogOpen(false);
      setTask(null);
      setAllTasks([]);
    }
    setClearingAll(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status.toUpperCase()) {
      case 'RUNNING':
      case 'IN_PROGRESS':
      case 'PENDING':
        return <Activity className="w-5 h-5 text-primary animate-pulse" />;
      case 'COMPLETED':
      case 'SUCCESS':
        return <CheckCircle2 className="w-5 h-5 text-success" />;
      case 'FAILED':
      case 'ERROR':
        return <XCircle className="w-5 h-5 text-destructive" />;
      case 'STOPPED':
      case 'CANCELLED':
        return <StopCircle className="w-5 h-5 text-warning" />;
      case 'QUEUED':
        return <Clock className="w-5 h-5 text-accent" />;
      case 'BUSY': 
        return <Loader className="w-5 h-5 text-purple-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'RUNNING':
      case 'IN_PROGRESS':
      case 'PENDING':
        return 'text-primary';
      case 'COMPLETED':
      case 'SUCCESS':
        return 'text-success';
      case 'FAILED':
      case 'ERROR':
        return 'text-destructive';
      case 'STOPPED':
      case 'CANCELLED':
        return 'text-warning';
      case 'QUEUED':
        return 'text-accent';
      case 'BUSY': 
        return 'text-purple-500';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status.toUpperCase()) {
      case 'RUNNING':
      case 'IN_PROGRESS':
      case 'PENDING':
        return 'default';
      case 'COMPLETED':
      case 'SUCCESS':
        return 'secondary';
      case 'FAILED':
      case 'ERROR':
        return 'destructive';
      case 'BUSY': 
        return 'default';
      default:
        return 'outline';
    }
  };

  const filteredTasks = allTasks.filter((t) => {
    const matchesStatus = statusFilter === 'ALL' || t.status.toUpperCase() === statusFilter;
    const matchesSearch = searchQuery === '' ||
      t.task_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.task_type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="h-screen overflow-hidden bg-background">
      {/* Navigation Sidebar */}
      <Sidebar
        isOpen={isMobile ? sidebarOpen : true}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={!isMobile && sidebarCollapsed}
        onCollapsedChange={(collapsed) => {
          setSidebarCollapsed(collapsed);
          localStorage.setItem('sidebar-collapsed', String(collapsed));
        }}
      />

      {/* Main Content */}
      <main className={cn(
        "h-screen flex flex-col transition-all duration-300",
        !isMobile && (sidebarCollapsed ? "ml-16" : "ml-52")
      )}>
        {/* Header */}
        <Header
          title="Task Manager"
          subtitle="Monitor and control running tasks"
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="space-y-8">
            <div className="flex flex-wrap gap-3 justify-end">
              <Button
                variant="outline"
                onClick={handleGetAllTasks}
                disabled={loadingAllTasks}
              >
                {loadingAllTasks ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <List className="w-4 h-4 mr-2" />
                )}
                Get All Tasks
              </Button>
              <Button
                variant="destructive"
                onClick={() => setStopAllDialogOpen(true)}
              >
                <StopCircle className="w-4 h-4 mr-2" />
                Stop All Tasks
              </Button>
              <Button
                variant="outline"
                className="border-destructive/50 text-destructive hover:bg-destructive/10"
                onClick={() => setClearAllDialogOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All Tasks
              </Button>
            </div>

            {/* All Tasks Section */}
            {allTasks.length > 0 && (
              <div className="glass-card p-6 animate-fade-in bg-secondary/30 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <List className="w-5 h-5 text-primary" />
                    All Tasks ({filteredTasks.length})
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground">Filter:</Label>
                      <Select
                        value={statusFilter}
                        onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Status</SelectItem>
                          <SelectItem value="RUNNING">Running</SelectItem>
                          <SelectItem value="COMPLETED">Completed</SelectItem>
                          <SelectItem value="FAILED">Failed</SelectItem>
                          <SelectItem value="QUEUED">Queued</SelectItem>
                          <SelectItem value="BUSY">Busy</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground">Search:</Label>
                      <Input
                        placeholder="Search by ID or Type..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-48"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 max-h-96 overflow-auto scrollbar-thin scrollbar-thumb-cyan-300 scrollbar-track-transparent">
                  {filteredTasks.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No tasks match the selected filter.
                    </p>
                  ) : (
                    filteredTasks.map((t) => (
                      <div
                        key={t.task_id}
                        className="p-4 rounded-lg bg-secondary/30 border border-border/50 flex flex-col sm:flex-row sm:items-center gap-4 cursor-pointer hover:bg-secondary/50"
                        onClick={() => handleSelectTask(t.task_id)}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {getStatusIcon(t.status)}
                          <div className="min-w-0 flex-1">
                            <code className="text-sm font-mono truncate block">
                              {t.task_id} 
                            </code>
                            <p className="text-xs text-muted-foreground">
                              Task Name: {t.task_type}...
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Device: {t.device_id.slice(0, 8)}...
                              {t.created_at && ` • ${new Date(t.created_at).toLocaleString()}`}
                            </p>
                            
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={getStatusBadgeVariant(t.status)}>
                            {t.status}
                          </Badge>
                          {t.progress !== undefined && t.progress > 0 && (
                            <span className="text-sm text-muted-foreground">
                              {t.progress}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Search Task */}
            <div ref={taskStatusRef} className="glass-card p-6 animate-fade-in bg-secondary/30 rounded-lg">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <Search className="w-5 h-5 text-primary" />
                Get Task Status
              </h3>
              <form onSubmit={handleGetStatus} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="taskId">Task ID</Label>
                  <div className="flex gap-4">
                    <Input
                      id="taskId"
                      value={taskId}
                      onChange={(e) => setTaskId(e.target.value)}
                      placeholder="Enter task ID..."
                      className="flex-1"
                    />
                    <Button type="submit" disabled={loading || !taskId.trim()}>
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </form>

              {/* Task Result */}
              {task && (
                <div className="mt-6 pt-6 border-t border-border animate-fade-in">
                  <div className="glass-card p-6 bg-secondary/30">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(task.status)}
                        <div>
                          <h4 className="font-semibold">Task {task.task_id.slice(0, 8)}...</h4>
                          <p className={`text-sm font-medium ${getStatusColor(task.status)}`}>
                            {task.status}
                          </p>
                        </div>
                      </div>
                      {['RUNNING', 'IN_PROGRESS', 'PENDING'].includes(task.status.toUpperCase()) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleStopTask}
                          className="text-destructive border-destructive/50 hover:bg-destructive/10"
                        >
                          <StopCircle className="w-4 h-4 mr-2" />
                          Stop
                        </Button>
                      )}
                    </div>

                    {task.progress !== undefined && (
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Progress</span>
                          <span>{task.progress}%</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {task.logs && (
                      <div className="p-3 rounded-lg bg-secondary/50 border border-border/50 h-[48vh] overflow-auto">
                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                          {task.logs}
                        </pre>
                      </div>
                    )}

                    <div className="mt-4 space-y-1 text-xs font-mono text-muted-foreground">
                      <div>Task ID: {task.task_id}</div>
                      <div>Device ID: {task.device_id}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Info Card */}
            <div className="glass-card p-6 animate-fade-in bg-secondary/20 rounded-lg">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-accent/10 border border-accent/20">
                  <AlertCircle className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Task Information</h3>
                  <p className="text-sm text-muted-foreground">
                    Tasks are created when you perform actions. Use the task ID provided when the action is initiated
                    to check its status here.
                  </p>
                </div>
              </div>
            </div>

            {/* Stop All Dialog */}
            <AlertDialog open={stopAllDialogOpen} onOpenChange={setStopAllDialogOpen}>
              <AlertDialogContent className="glass-card border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle>Stop All Tasks</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to stop all running tasks? This action cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleStopAll}
                    className="bg-destructive hover:bg-destructive/90"
                    disabled={stoppingAll}
                  >
                    {stoppingAll && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Stop All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Clear All Dialog */}
            <AlertDialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
              <AlertDialogContent className="glass-card border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear All Tasks</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to clear all tasks from the database? This will permanently
                    delete all task records and cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearAll}
                    className="bg-destructive hover:bg-destructive/90"
                    disabled={clearingAll}
                  >
                    {clearingAll && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Clear All Tasks
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </main>
    </div>
  );
}