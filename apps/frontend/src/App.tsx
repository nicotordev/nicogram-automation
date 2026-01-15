import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";

// shadcn/ui
import { Separator } from "@/components/ui/separator";

// Custom components
import { ConsoleLogsCard } from "@/components/dashboard/ConsoleLogsCard";
import { FavoritesCard } from "@/components/dashboard/FavoritesCard";
import { Header } from "@/components/dashboard/Header";
import { SystemStatusCard } from "@/components/dashboard/SystemStatusCard";
import { TargetProfileCard } from "@/components/dashboard/TargetProfileCard";
import type { LogEvent, LogKind, LogPayload, Stats } from "@/types";

// -----------------------------
// Types (STRICT, no any)
// -----------------------------

type ServerToClientEvents = {
  connect: () => void;
  disconnect: () => void;
  status: (data: { message: string }) => void;
  info: (data: Partial<Stats> & LogPayload) => void;
  data: (data: Partial<Stats> & LogPayload) => void;
  error: (data: LogPayload) => void;
  history: (history: LogEvent[]) => void;
  favorites: (favs: string[]) => void;
};

type ClientToServerEvents = {
  "get-favorites": () => void;
  "toggle-favorite": (username: string) => void;
  "start-automation": (payload: { autoUnfollow: boolean }) => void;
};

// Connect to the backend
const socketUrl = import.meta.env.DEV ? "http://localhost:3000" : "/";
const socket: Socket<ServerToClientEvents, ClientToServerEvents> =
  io(socketUrl);

async function safeFetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    return json as T;
  } catch {
    return null;
  }
}

type ScanApiRow = {
  following?: string[];
};

export default function App() {
  const [status, setStatus] = useState<string>("Disconnected");
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [stats, setStats] = useState<Stats>({
    followersCount: null,
    followingCount: null,
    username: null,
    userId: null,
  });

  const [isConnected, setIsConnected] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [autoUnfollow, setAutoUnfollow] = useState(false);
  const [followingList, setFollowingList] = useState<string[]>([]);

  const addLog = (event: LogKind, data: LogPayload) => {
    setLogs((prev) => [
      ...prev,
      {
        event,
        data,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const startAutomation = () => {
    socket.emit("start-automation", { autoUnfollow });
  };

  const toggleFavorite = (username: string) => {
    socket.emit("toggle-favorite", username);
  };

  useEffect(() => {
    // Initial favorites
    socket.emit("get-favorites");

    // Latest scan
    void (async () => {
      const scan = await safeFetchJson<ScanApiRow[]>("/api/scans");
      const latest = scan?.[0];
      const following = latest?.following;
      if (Array.isArray(following)) {
        const unique = Array.from(new Set(following)).filter(
          (x) => typeof x === "string"
        );
        setFollowingList(unique);
      }
    })();

    const onConnect = () => {
      setIsConnected(true);
      setStatus("Connected to server");
      socket.emit("get-favorites");
    };

    const onDisconnect = () => {
      setIsConnected(false);
      setStatus("Disconnected from server");
    };

    const onStatus = (data: { message: string }) => {
      setStatus(data.message);
      addLog("status", data);
    };

    const onInfo = (data: Partial<Stats> & LogPayload) => {
      addLog("info", data);
      setStats((prev) => ({ ...prev, ...data }));
    };

    const onData = (data: Partial<Stats> & LogPayload) => {
      addLog("data", data);
      setStats((prev) => ({ ...prev, ...data }));
    };

    const onError = (data: LogPayload) => {
      addLog("error", data);
    };

    const onHistory = (history: LogEvent[]) => {
      setLogs([...history]);

      const newStats: Stats = {
        followersCount: null,
        followingCount: null,
        username: null,
        userId: null,
      };

      for (const item of history) {
        if (item.event === "data" || item.event === "info") {
          newStats.followersCount =
            typeof item.data.followersCount === "number"
              ? item.data.followersCount
              : newStats.followersCount;
          newStats.followingCount =
            typeof item.data.followingCount === "number"
              ? item.data.followingCount
              : newStats.followingCount;
          newStats.username =
            typeof item.data.username === "string"
              ? item.data.username
              : newStats.username;
          newStats.userId =
            typeof item.data.userId === "string"
              ? item.data.userId
              : newStats.userId;
        }
      }

      setStats((prev) => ({ ...prev, ...newStats }));
    };

    const onFavorites = (favs: string[]) => {
      setFavorites(Array.isArray(favs) ? favs : []);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("status", onStatus);
    socket.on("info", onInfo);
    socket.on("data", onData);
    socket.on("error", onError);
    socket.on("history", onHistory);
    socket.on("favorites", onFavorites);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("status", onStatus);
      socket.off("info", onInfo);
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("history", onHistory);
      socket.off("favorites", onFavorites);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <Header
          isConnected={isConnected}
          status={status}
          autoUnfollow={autoUnfollow}
          setAutoUnfollow={setAutoUnfollow}
          startAutomation={startAutomation}
        />

        <Separator className="my-6" />

        <main className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left column */}
          <div className="space-y-6 lg:col-span-4">
            <TargetProfileCard stats={stats} />

            <FavoritesCard
              favorites={favorites}
              followingList={followingList}
              toggleFavorite={toggleFavorite}
            />

            <SystemStatusCard isConnected={isConnected} />
          </div>

          {/* Right column: logs */}
          <ConsoleLogsCard logs={logs} />
        </main>
      </div>
    </div>
  );
}