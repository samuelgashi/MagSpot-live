import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { Activity } from '@/services/api';
import { toast } from 'sonner';
import { useOptionalAuth } from '@/lib/auth';

interface ActivityPopupProps {
  activityKey: string;
  activity: Activity;
  deviceIds: string[];
  isOpen: boolean;
  onClose: () => void;
}
export function ActivityPopup({ activityKey, activity, deviceIds, isOpen, onClose }: ActivityPopupProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { getToken } = useOptionalAuth();

  useEffect(() => {
    if (isOpen) {
      // Initialize form data with defaults
      const initialData: Record<string, any> = {};

      activity.args
        ?.sort((a, b) => a.index - b.index)
        .forEach((field) => {
          if (field.key === "device_id") {
            initialData[field.key] = deviceIds.join(";");
          } else if (field.type === "select" && Array.isArray(field.default)) {
            initialData[field.key] = field.default[0];
          } else {
            initialData[field.key] = field.default;
          }
        });

      activity.kwaygs
        ?.sort((a, b) => a.index - b.index)
        .forEach((field) => {
          if (field.type === "select" && Array.isArray(field.default)) {
            initialData[field.key] = field.default[0];
          } else {
            initialData[field.key] = field.default;
          }
        });

      setFormData(initialData);
    }
  }, [isOpen, activity, deviceIds]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const token = await getToken();
      const response = await fetch(
        `${localStorage.getItem("apiBackendUrl") || "/api"}${activity.endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": localStorage.getItem("apiKey") || "",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        }
      );
      if (response.ok) {
        toast.success("Activity started successfully");
        onClose();
      } else {
        const error = await response.json().catch(() => ({ message: "Unknown error" }));
        toast.error(error.message || error.error || "Failed to start activity");
      }
    } catch (error) {
      toast.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: any) => {
    const value = formData[field.key];
    const handleChange = (newValue: any) => {
      setFormData((prev) => ({ ...prev, [field.key]: newValue }));
    };

    switch (field.type) {
      case "input":
        if (field.key === "device_id") {
          const deviceIds = value ? value.split(";") : [];
          return (
            <div key={field.key} className="space-y-2">
              <Label className="flex items-center gap-1">
                {field.key.replace(/_/g, " ").toUpperCase()}
                {field.is_required && <span className="text-red-500">*</span>}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{field.description}</p>
                  </TooltipContent>
                </Tooltip>
              </Label>
              <div className="flex flex-wrap gap-1 max-h-[120px] overflow-y-auto scrollbar-hide">
                {deviceIds.map((id: string, index: number) => (
                  <Badge key={index} variant="secondary">
                    {id}
                  </Badge>
                ))}
              </div>
            </div>
          );
        }
        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={field.key} className="flex items-center gap-1">
              {field.key.replace(/_/g, " ").toUpperCase()}
              {field.is_required && <span className="text-red-500">*</span>}
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{field.description}</p>
                </TooltipContent>
              </Tooltip>
            </Label>
            <Input
              id={field.key}
              value={value || ""}
              onChange={(e) => handleChange(e.target.value)}
            />
          </div>
        );
      case "checkbox":
        return (
          <div key={field.key} className="flex items-center space-x-2">
            <Checkbox
              id={field.key}
              checked={value || false}
              onCheckedChange={handleChange}
            />
            <Label htmlFor={field.key} className="flex items-center gap-1">
              {field.key.replace(/_/g, " ").toUpperCase()}
              {field.is_required && <span className="text-red-500">*</span>}
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{field.description}</p>
                </TooltipContent>
              </Tooltip>
            </Label>
          </div>
        );
      case "select":
        const options = Array.isArray(field.default) ? field.default : [];
        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={field.key} className="flex items-center gap-1">
              {field.key.replace(/_/g, " ").toUpperCase()}
              {field.is_required && <span className="text-red-500">*</span>}
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{field.description}</p>
                </TooltipContent>
              </Tooltip>
            </Label>
            <Select value={value || ""} onValueChange={handleChange}>
              <SelectTrigger id={field.key}>
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                {options.map((option: string) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{activity.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto flex-1 scrollbar-hide">
          {/* Args */}
          {activity.args
            ?.sort((a, b) => a.index - b.index)
            .map((field) => renderField(field))}

          {/* Advanced Settings */}
          {activity.kwaygs?.length > 0 && (
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-2" style={{ marginBottom: "5px"}}>
                  Advanced Settings
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4">
                {activity.kwaygs
                  ?.sort((a, b) => a.index - b.index)
                  .map((field) => renderField(field))}
              </CollapsibleContent>
            </Collapsible>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Starting..." : "Start Activity"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
