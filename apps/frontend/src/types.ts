export type LogKind = "status" | "info" | "data" | "error";

export type LogPayload = {
  message?: string;
} & Record<string, unknown>;

export interface LogEvent {
  event: LogKind;
  data: LogPayload;
  timestamp: string;
}

export interface Stats {
  followersCount: number | null;
  followingCount: number | null;
  username: string | null;
  userId: string | null;
}
