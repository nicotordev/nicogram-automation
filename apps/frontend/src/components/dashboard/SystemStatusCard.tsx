import { motion } from "framer-motion";
import { Activity, Wifi, WifiOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SystemStatusCardProps {
  isConnected: boolean;
}

export function SystemStatusCard({ isConnected }: SystemStatusCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 }}
    >
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-muted-foreground" />
            System status
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              {isConnected ? (
                <Wifi className="h-4 w-4 text-emerald-400" />
              ) : (
                <WifiOff className="h-4 w-4 text-destructive" />
              )}
              Connection
            </span>
            <Badge
              variant={isConnected ? "secondary" : "destructive"}
              className={
                isConnected ? "bg-emerald-500/10 text-emerald-400" : ""
              }
            >
              {isConnected ? "Active" : "Offline"}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border bg-muted/30 p-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Platform
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Linux</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Engine
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Playwright</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
