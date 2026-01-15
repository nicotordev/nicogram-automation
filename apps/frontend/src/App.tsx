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
import { NonFollowersCard } from "@/components/dashboard/NonFollowersCard";
import { FansCard } from "@/components/dashboard/FansCard";
import { UsernameModal } from "@/components/dashboard/UsernameModal";
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
  "sync-state": (isSyncing: boolean) => void;
  "non-followers-list": (list: { username: string; isFavorite: boolean }[]) => void;
  "unfollowed-user": (data: { username: string }) => void;
  "unfollow-state": (isUnfollowing: boolean) => void;
  "detailed-stats": (data: {
    followers: { username: string; isFavorite: boolean }[];
    following: { username: string; isFavorite: boolean }[];
    nonFollowers: { username: string; isFavorite: boolean }[];
    fans: { username: string; isFavorite: boolean }[];
  }) => void;
  "profile-not-found": (data: { username?: string }) => void;
};

type ClientToServerEvents = {
  "get-favorites": () => void;
  "toggle-favorite": (username: string) => void;
  "start-automation": (payload: { autoUnfollow: boolean }) => void;
  "start-sync": () => void;
  "cancel-sync": () => void;
  "get-non-followers": (username?: string) => void;
  "start-unfollow": () => void;
  "cancel-unfollow": () => void;
  "get-latest-stats": (username?: string) => void;
  "get-detailed-stats": (username: string) => void;
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
  const [isAutoUnfollowing, setIsAutoUnfollowing] = useState(false);
  const [followingList, setFollowingList] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUnfollowing, setIsUnfollowing] = useState(false);
  const [nonFollowers, setNonFollowers] = useState<string[]>([]);
  const [fans, setFans] = useState<string[]>([]);
  const [isProfileMissing, setIsProfileMissing] = useState(false);
  
  const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(false);

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

  const startSync = () => {
    if (isSyncing) {
      socket.emit("cancel-sync");
    } else {
      socket.emit("start-sync");
    }
  };

  const toggleUnfollow = () => {
    if (isUnfollowing) {
      socket.emit("cancel-unfollow");
    } else {
      socket.emit("start-unfollow");
    }
  };

  const toggleAutoUnfollow = () => {
    setIsAutoUnfollowing((prev) => !prev);
  };

  const toggleFavorite = (username: string) => {
    socket.emit("toggle-favorite", username);
  };

  const handleSaveUsername = (username: string) => {
    localStorage.setItem("nicogram_username", username);
    setIsUsernameModalOpen(false);
    socket.emit("get-latest-stats", username);
    socket.emit("get-non-followers", username);
    socket.emit("get-detailed-stats", username);
  };

  useEffect(() => {
    // Initial data
    socket.emit("get-favorites");
    
    const stored = localStorage.getItem("nicogram_username");
    if (stored) {
        socket.emit("get-latest-stats", stored);
        socket.emit("get-non-followers", stored);
        socket.emit("get-detailed-stats", stored);
    } else {
        setIsUsernameModalOpen(true);
    }

    // Latest scan (Global API fallback, maybe redundant if get-latest-stats works)
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
      const stored = localStorage.getItem("nicogram_username");
      if (stored) {
        socket.emit("get-latest-stats", stored);
        socket.emit("get-non-followers", stored);
        socket.emit("get-detailed-stats", stored);
      } else {
        socket.emit("get-non-followers");
      }
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
      setIsProfileMissing(false);
    };

    const onProfileNotFound = () => {
       setIsProfileMissing(true);
       setStatus("Profile not found in database. Start a scan.");
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
    
    const onNonFollowers = (list: { username: string }[]) => {
        setNonFollowers(list.map(u => u.username));
    };

    const onDetailedStats = (data: {
        followers: { username: string; isFavorite: boolean }[];
        following: { username: string; isFavorite: boolean }[];
        nonFollowers: { username: string; isFavorite: boolean }[];
        fans: { username: string; isFavorite: boolean }[];
    }) => {
        setNonFollowers(data.nonFollowers.map(u => u.username));
        setFollowingList(data.following.map(u => u.username));
        setFans(data.fans.map(u => u.username));
    };

    const onUnfollowedUser = ({ username }: { username: string }) => {
        setNonFollowers(prev => prev.filter(u => u !== username));
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("status", onStatus);
    socket.on("info", onInfo);
    socket.on("data", onData);
    socket.on("error", onError);
    socket.on("history", onHistory);
    socket.on("favorites", onFavorites);
    socket.on("sync-state", setIsSyncing);
    socket.on("non-followers-list", onNonFollowers);
    socket.on("unfollowed-user", onUnfollowedUser);
    socket.on("unfollow-state", setIsUnfollowing);
    socket.on("detailed-stats", onDetailedStats);
    socket.on("profile-not-found", onProfileNotFound);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("status", onStatus);
      socket.off("info", onInfo);
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("history", onHistory);
      socket.off("favorites", onFavorites);
      socket.off("sync-state", setIsSyncing);
      socket.off("non-followers-list", onNonFollowers);
      socket.off("unfollowed-user", onUnfollowedUser);
      socket.off("unfollow-state", setIsUnfollowing);
      socket.off("detailed-stats", onDetailedStats);
      socket.off("profile-not-found", onProfileNotFound);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <UsernameModal isOpen={isUsernameModalOpen} onSave={handleSaveUsername} />
      
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <Header
          isConnected={isConnected}
          status={status}
          toggleSync={startSync}
          isSyncing={isSyncing}
          toggleAutoUnfollow={toggleAutoUnfollow}
          isAutoUnfollowing={isAutoUnfollowing}
          isProfileMissing={isProfileMissing}
        />

        <Separator className="my-6" />

        <main className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left column */}
          <div className="space-y-6 lg:col-span-4">
            <TargetProfileCard stats={stats} />

            <NonFollowersCard 
               nonFollowers={nonFollowers}
               favorites={favorites}
               toggleFavorite={toggleFavorite}
               toggleUnfollow={toggleUnfollow}
               isUnfollowing={isUnfollowing}
            />

            <FansCard fans={fans} />

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
