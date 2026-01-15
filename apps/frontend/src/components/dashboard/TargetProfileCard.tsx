import { motion } from "framer-motion";
import { Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Stats } from "@/types";

interface TargetProfileCardProps {
  stats: Stats;
}

export function TargetProfileCard({ stats }: TargetProfileCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-muted-foreground" />
            Target profile
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Username
            </p>
            <p className="mt-1 font-mono text-lg">
              {stats.username ? (
                `@${stats.username}`
              ) : (
                <span className="text-muted-foreground">waiting…</span>
              )}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border bg-muted/30 p-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Followers
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {typeof stats.followersCount === "number" ? (
                  stats.followersCount.toLocaleString()
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </p>
            </div>

            <div className="rounded-xl border bg-muted/30 p-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Following
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {typeof stats.followingCount === "number" ? (
                  stats.followingCount.toLocaleString()
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              ID
            </span>
            <span className="max-w-[60%] truncate font-mono text-xs text-muted-foreground">
              {stats.userId ?? "—"}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
