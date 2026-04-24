import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateGroup, Group } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getListGroupsQueryKey } from "@workspace/api-client-react";

const PALETTE = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#84cc16", // lime
  "#22c55e", // green
  "#14b8a6", // teal
  "#00d4e8", // cyan (brand accent)
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#d946ef", // fuchsia
  "#ec4899", // pink
  "#f43f5e", // rose
  "#fb923c", // amber
  "#a3e635", // yellow-green
  "#34d399", // emerald
  "#60a5fa", // sky
  "#c084fc", // purple
  "#f87171", // light red
];

function hexToHue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return h * 360;
}

function hueDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function pickBestColor(existingColors: string[]): string {
  if (existingColors.length === 0) return PALETTE[0];
  const existingHues = existingColors
    .filter((c) => c && /^#[0-9a-fA-F]{6}$/.test(c))
    .map(hexToHue);
  let bestColor = PALETTE[0];
  let bestDist = -1;
  for (const p of PALETTE) {
    const ph = hexToHue(p);
    const minDist = Math.min(...existingHues.map((h) => hueDist(ph, h)));
    if (minDist > bestDist) {
      bestDist = minDist;
      bestColor = p;
    }
  }
  return bestColor;
}

const formSchema = z.object({
  name: z.string().min(1, "Group name is required"),
  color: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingGroups?: Group[];
}

export function CreateGroupModal({ open, onOpenChange, existingGroups = [] }: CreateGroupModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const existingColors = existingGroups.map((g) => g.color ?? "").filter(Boolean);
  const autoColor = pickBestColor(existingColors);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      color: autoColor,
    },
  });

  // Each time dialog opens, re-pick best color
  useEffect(() => {
    if (open) {
      form.reset({ name: "", color: pickBestColor(existingColors) });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const createGroup = useCreateGroup({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() });
        toast({ title: "Group created successfully" });
        form.reset();
        onOpenChange(false);
      },
      onError: () => {
        toast({ title: "Error creating group", variant: "destructive" });
      },
    },
  });

  const onSubmit = (data: FormValues) => {
    createGroup.mutate({ data });
  };

  const currentColor = form.watch("color") ?? autoColor;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] border-border" style={{ background: "rgba(10,14,24,0.98)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <DialogHeader>
          <DialogTitle>Create New Group</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Production Devices" {...field} className="bg-input border-border" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      {/* Palette swatches */}
                      <div className="flex flex-wrap gap-1.5">
                        {PALETTE.map((p) => {
                          const selected = field.value === p;
                          const isExisting = existingColors.includes(p);
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => field.onChange(p)}
                              title={p}
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: 6,
                                background: p,
                                border: selected
                                  ? "2.5px solid white"
                                  : "2px solid rgba(255,255,255,0.12)",
                                opacity: isExisting ? 0.38 : 1,
                                position: "relative",
                                cursor: "pointer",
                                flexShrink: 0,
                                boxShadow: selected ? `0 0 0 2px ${p}` : "none",
                              }}
                            >
                              {isExisting && (
                                <span
                                  style={{
                                    position: "absolute",
                                    inset: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 10,
                                    color: "rgba(255,255,255,0.7)",
                                    fontWeight: 700,
                                  }}
                                >
                                  ✓
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom color picker + hex input */}
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={field.value ?? "#000000"}
                          onChange={(e) => field.onChange(e.target.value)}
                          style={{
                            width: 36,
                            height: 36,
                            padding: 2,
                            borderRadius: 6,
                            border: "1px solid rgba(255,255,255,0.15)",
                            background: "rgba(255,255,255,0.06)",
                            cursor: "pointer",
                          }}
                        />
                        <Input
                          type="text"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="flex-1 bg-input border-border font-mono text-sm"
                          placeholder="#000000"
                        />
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 6,
                            background: currentColor,
                            border: "1px solid rgba(255,255,255,0.15)",
                            flexShrink: 0,
                          }}
                        />
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-border hover:bg-accent">
                Cancel
              </Button>
              <Button type="submit" disabled={createGroup.isPending}>
                {createGroup.isPending ? "Creating..." : "Create Group"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
