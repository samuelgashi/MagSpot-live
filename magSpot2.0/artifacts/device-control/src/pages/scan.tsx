import { Layout } from "@/components/layout";
import { useScanDevices, useCreateDevice, getListDevicesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Radar, Smartphone, Check, X } from "lucide-react";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Scan() {
  const [ipRange, setIpRange] = useState("192.168.1");
  const scanDevices = useScanDevices();
  const createDevice = useCreateDevice();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleScan = async () => {
    if (ipRange) {
      await scanDevices.mutateAsync({ data: { ipRange } });
    }
  };

  const handleRegister = async (device: { ip: string, name: string }) => {
    try {
      await createDevice.mutateAsync({ data: { name: device.name, ip: device.ip } });
      toast({
        title: "Node Registered",
        description: `Successfully registered ${device.name} (${device.ip})`,
        className: "bg-card border-primary/50 text-foreground rounded-none font-mono"
      });
      queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
    } catch (error) {
      toast({
        title: "Registration Failed",
        description: `Failed to register ${device.ip}`,
        variant: "destructive",
        className: "rounded-none font-mono"
      });
    }
  };

  const handleRegisterAll = async () => {
    if (!scanDevices.data) return;
    
    let successCount = 0;
    for (const device of scanDevices.data) {
      try {
        await createDevice.mutateAsync({ data: { name: device.name, ip: device.ip } });
        successCount++;
      } catch (error) {
        console.error(`Failed to register ${device.ip}`, error);
      }
    }
    
    toast({
      title: "Batch Registration Complete",
      description: `Successfully registered ${successCount}/${scanDevices.data.length} nodes.`,
      className: "bg-card border-primary/50 text-foreground rounded-none font-mono"
    });
    queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6 h-full">
        <div className="border-b border-primary/20 pb-4">
          <h1 className="text-2xl font-bold uppercase tracking-wider text-foreground mb-1">Network_Scan</h1>
          <p className="text-muted-foreground text-sm">Discover and register unknown devices on the local subnet.</p>
        </div>

        <Card className="rounded-none border border-primary/50 bg-card/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
            <Radar className={`w-32 h-32 ${scanDevices.isPending ? 'animate-spin duration-3000 text-primary opacity-20' : ''}`} />
          </div>
          <CardHeader>
            <CardTitle className="uppercase tracking-widest text-sm font-mono text-primary">Scan Parameters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4 max-w-md">
              <div className="space-y-2 flex-1">
                <Label className="text-xs uppercase text-muted-foreground font-mono">Subnet Range</Label>
                <div className="flex items-center">
                  <Input 
                    value={ipRange} 
                    onChange={e => setIpRange(e.target.value)}
                    className="rounded-none border-border bg-background font-mono text-sm border-r-0 focus-visible:ring-0 focus-visible:border-primary"
                    placeholder="192.168.1"
                  />
                  <div className="bg-muted text-muted-foreground font-mono text-sm px-3 py-2 border border-border h-10 flex items-center">
                    .X
                  </div>
                </div>
              </div>
              <Button 
                onClick={handleScan} 
                disabled={!ipRange || scanDevices.isPending}
                className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-8 font-bold tracking-wider"
              >
                {scanDevices.isPending ? (
                  <span className="flex items-center"><Radar className="w-4 h-4 mr-2 animate-spin" /> SCANNING...</span>
                ) : "INITIATE_SCAN"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {scanDevices.isSuccess && (
          <div className="mt-4 border border-border bg-card/40 flex-1 overflow-auto rounded-none relative flex flex-col">
            <div className="bg-primary/10 border-b border-primary/20 p-3 font-mono text-xs text-primary flex justify-between items-center">
              <span>SCAN_RESULTS :: FOUND {scanDevices.data.length} UNREGISTERED_NODES</span>
              <Button size="sm" variant="outline" className="rounded-none border-primary/50 text-primary h-7 text-[10px]" onClick={handleRegisterAll} disabled={scanDevices.data.length === 0 || createDevice.isPending}>
                REGISTER_ALL
              </Button>
            </div>
            
            <Table className="relative z-10">
              <TableHeader className="bg-muted/50 sticky top-0">
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="font-bold text-primary/80 uppercase text-xs tracking-wider">Discovered IP</TableHead>
                  <TableHead className="font-bold text-primary/80 uppercase text-xs tracking-wider">Device Signature</TableHead>
                  <TableHead className="text-right font-bold text-primary/80 uppercase text-xs tracking-wider">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scanDevices.data?.map((device, i) => (
                  <TableRow key={i} className="border-b border-border/50 hover:bg-primary/5">
                    <TableCell className="font-mono text-xs">{device.ip}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-primary/50" />
                      {device.name}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-8 rounded-none text-xs text-primary hover:text-primary hover:bg-primary/10" onClick={() => handleRegister(device)} disabled={createDevice.isPending}>
                        <Check className="w-3 h-3 mr-1" /> ADD
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {scanDevices.data?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="h-32 text-center text-muted-foreground font-mono">
                      [NO_DEVICES_FOUND_ON_SUBNET]
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Layout>
  );
}
