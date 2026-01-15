import { motion } from "framer-motion";
import { Play, ShieldCheck, Wifi, WifiOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface HeaderProps {
  isConnected: boolean;
  status: string;
  autoUnfollow: boolean;
  setAutoUnfollow: (v: boolean) => void;
  startAutomation: () => void;
}

export function Header({
  isConnected,
  status,
  autoUnfollow,
  setAutoUnfollow,
  startAutomation,
}: HeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Nicogram</h1>
          <Badge variant="outline" className="gap-2">
            {isConnected ? (
              <span className="inline-flex items-center gap-2">
                <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Live</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <WifiOff className="h-3.5 w-3.5 text-destructive" />
                <span className="text-destructive">Offline</span>
              </span>
            )}
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground">{status}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Auto Unfollow</span>
          </div>
          <Switch
            checked={autoUnfollow}
            onCheckedChange={setAutoUnfollow}
            aria-label="Toggle auto unfollow"
          />
        </div>

        <Button
          onClick={startAutomation}
          size="lg"
          className="group relative overflow-hidden"
        >
          <span className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100 shimmer-mask" />
          <Play className="mr-2 h-4 w-4" />
          Start automation
        </Button>
      </div>
    </motion.div>
  );
}
