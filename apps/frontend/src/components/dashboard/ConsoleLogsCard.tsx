import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck, Terminal } from "lucide-react";
import { useEffect, useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { LogEvent, LogKind, LogPayload } from "@/types";

interface ConsoleLogsCardProps {
  logs: LogEvent[];
}

function formatLogMessage(data: LogPayload): string {
  if (typeof data.message === "string" && data.message.trim().length > 0) {
    return data.message;
  }
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

function logBadgeVariant(
  kind: LogKind
): "default" | "secondary" | "destructive" | "outline" {
  switch (kind) {
    case "error":
      return "destructive";
    case "status":
      return "outline";
    case "data":
      return "default";
    case "info":
      return "secondary";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function logBadgeClassName(kind: LogKind): string {
  switch (kind) {
    case "status":
      return "border-primary/40 text-primary";
    case "data":
      return "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/10";
    case "info":
      return "bg-sky-500/10 text-sky-400 hover:bg-sky-500/10";
    case "error":
      return "bg-destructive/10 text-destructive hover:bg-destructive/10";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function ConsoleLogsCard({ logs }: ConsoleLogsCardProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="lg:col-span-8"
    >
      <Card className="h-[680px] overflow-hidden">
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono">console_output</span>
            </span>

            <span className="text-xs font-mono text-muted-foreground">
              Live stream
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="h-[610px] pt-0">
          <ScrollArea className="h-full pr-3">
            <div className="space-y-3 py-2 font-mono text-sm">
              <AnimatePresence initial={false}>
                {logs.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex h-[520px] flex-col items-center justify-center gap-3 rounded-xl border bg-muted/30 text-muted-foreground"
                  >
                    <ShieldCheck className="h-10 w-10 opacity-40" />
                    <p>Ready to initialize automation sequence…</p>
                  </motion.div>
                ) : (
                  logs.map((log, i) => (
                    <motion.div
                      key={`${log.timestamp}-${i}`}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex gap-3"
                    >
                      <span className="w-[86px] flex-shrink-0 select-none text-right text-xs text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour12: false,
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={logBadgeVariant(log.event)}
                            className={`h-5 px-2 text-[10px] uppercase tracking-wider ${logBadgeClassName(
                              log.event
                            )}`}
                          >
                            {log.event}
                          </Badge>

                          <span
                            className={
                              log.event === "error"
                                ? "break-words text-destructive"
                                : "break-words text-muted-foreground"
                            }
                          >
                            {formatLogMessage(log.data)}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>

              <div ref={logsEndRef} />
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </motion.div>
  );
}
