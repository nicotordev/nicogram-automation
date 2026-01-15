import { motion } from "framer-motion";
import { Pause, Play, Wifi, WifiOff, PlaySquare, Square, ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderSyncProps {
  toggleSync: () => void;
  isSyncing: boolean;
}

interface HeaderAutoUnfollowProps {
  isAutoUnfollowing: boolean;
  toggleAutoUnfollow: () => void;
}

interface HeaderProps extends HeaderSyncProps, HeaderAutoUnfollowProps {
  isConnected: boolean;
  status: string;
  isProfileMissing?: boolean;
}

export function Header({
  isConnected,
  status,
  toggleSync,
  isSyncing,
  toggleAutoUnfollow,
  isAutoUnfollowing,
  isProfileMissing,
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

      <div className="flex items-center gap-3">
        {isProfileMissing && !isSyncing && (
          <Button onClick={toggleSync} className="animate-pulse gap-2" variant="default">
            <Play className="h-4 w-4" />
            Start First Scan
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              Actions
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={toggleSync} className="cursor-pointer">
              {isSyncing ? (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Stop Sync
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Sync
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleAutoUnfollow} className="cursor-pointer">
              {isAutoUnfollowing ? (
                <>
                  <Square className="mr-2 h-4 w-4" />
                  Stop Auto-Unfollowing
                </>
              ) : (
                <>
                  <PlaySquare className="mr-2 h-4 w-4" />
                  Start Auto-Unfollowing
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}
