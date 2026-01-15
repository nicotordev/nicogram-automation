import { motion } from "framer-motion";
import { UserCheck } from "lucide-react";
import { useState, useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FansCardProps {
  fans: string[];
}

export function FansCard({ fans }: FansCardProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredList = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (q.length === 0) return fans;
    return fans.filter((u) => u.toLowerCase().includes(q));
  }, [fans, searchTerm]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.15 }}
    >
      <Card className="overflow-hidden">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="h-4 w-4 text-emerald-500" />
              Fans
            </CardTitle>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">
              {fans.length}
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground">
             Users who follow you but you don't follow back.
          </p>

          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search fans…"
          />
        </CardHeader>

        <CardContent className="pt-0">
          <ScrollArea className="h-[360px] pr-3">
            <div className="space-y-2">
              {filteredList.length === 0 ? (
                <div className="rounded-lg border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                  No fans found.
                </div>
              ) : (
                filteredList.map((u) => (
                    <div
                      key={u}
                      className="flex items-center justify-between rounded-lg border bg-card px-3 py-2"
                    >
                      <span className="truncate font-mono text-sm text-muted-foreground">
                        @{u}
                      </span>
                    </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </motion.div>
  );
}
