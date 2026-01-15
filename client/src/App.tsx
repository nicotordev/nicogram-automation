import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Play,
  ShieldCheck,
  Terminal,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import "./App.css";

// Types
interface LogEvent {
  event: string;
  data: any;
  timestamp: string;
}

interface Stats {
  followersCount: number | null;
  followingCount: number | null;
  username: string | null;
  userId: string | null;
}

// Connect to the backend
const socketUrl = import.meta.env.DEV ? "http://localhost:3000" : "/";
const socket: Socket = io(socketUrl);

function App() {
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
  const [searchTerm, setSearchTerm] = useState("");

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch initial favorites
    socket.emit("get-favorites");

    // Fetch latest scan data to get following list
    fetch("/api/scans")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.length > 0) {
          // Get unique following from latest scan
          setFollowingList(data[0].following || []);
        }
      })
      .catch((e) => console.error(e));

    function onConnect() {
      setIsConnected(true);
      setStatus("Connected to server");
      socket.emit("get-favorites");
    }

    function onDisconnect() {
      setIsConnected(false);
      setStatus("Disconnected from server");
    }

    function onStatus(data: { message: string }) {
      setStatus(data.message);
      addLog("status", data);
    }

    function onInfo(data: any) {
      addLog("info", data);
      setStats((prev) => ({ ...prev, ...data }));
    }

    function onData(data: any) {
      addLog("data", data);
      setStats((prev) => ({ ...prev, ...data }));
      // If we get new following count/data, we might want to refresh the list via API if it was saved?
    }

    function onError(data: any) {
      addLog("error", data);
    }

    function onHistory(history: LogEvent[]) {
      setLogs([...history]);

      const newStats: Stats = {
        followersCount: null,
        followingCount: null,
        username: null,
        userId: null,
      };

      history.forEach((item) => {
        if (item.event === "data" || item.event === "info") {
          Object.assign(newStats, item.data);
        }
      });
      setStats((prev) => ({ ...prev, ...newStats }));
    }

    function onFavorites(favs: string[]) {
      setFavorites(favs);
    }

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

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (event: string, data: any) => {
    setLogs((prev) => [
      ...prev,
      { event, data, timestamp: new Date().toISOString() },
    ]);
  };

  const startAutomation = () => {
    socket.emit("start-automation", { autoUnfollow });
  };

  const toggleFavorite = (username: string) => {
    socket.emit("toggle-favorite", username);
  };

  const filteredFollowing = followingList.filter((u) =>
    u.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen text-gray-100 font-sans selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto p-6 md:p-8">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4"
        >
          <div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent tracking-tight">
              Nicogram
            </h1>
            <p className="text-gray-400 flex items-center gap-2 mt-2 font-medium">
              <span className={`relative flex h-3 w-3`}>
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isConnected ? "bg-emerald-400" : "bg-rose-400"
                  }`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 ${
                    isConnected ? "bg-emerald-500" : "bg-rose-500"
                  }`}
                ></span>
              </span>
              {status}
            </p>
          </div>

          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-lg border border-white/10">
              <span className="text-sm font-medium">Auto Unfollow</span>
              <button
                onClick={() => setAutoUnfollow(!autoUnfollow)}
                className={`w-12 h-6 rounded-full p-1 transition-colors ${
                  autoUnfollow ? "bg-indigo-500" : "bg-gray-700"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    autoUnfollow ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={startAutomation}
              className="group relative px-8 py-3 bg-indigo-600 rounded-xl overflow-hidden shadow-2xl shadow-indigo-500/30 transition-all hover:bg-indigo-500 hover:shadow-indigo-500/50"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:animate-[shimmer_1.5s_infinite]" />
              <span className="relative flex items-center gap-2 font-semibold text-lg">
                <Play size={20} className="fill-current" />
                Start Automation
              </span>
            </motion.button>
          </div>
        </motion.header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Stats & Favorites */}
          <div className="lg:col-span-4 space-y-6">
            {/* Profile Card */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-panel rounded-2xl p-6 shadow-xl"
            >
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-indigo-300">
                <Users size={22} />
                <span>Target Profile</span>
              </h2>

              <div className="space-y-4">
                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                    Username
                  </p>
                  <p className="text-xl font-mono text-white tracking-wide">
                    {stats.username ? (
                      `@${stats.username}`
                    ) : (
                      <span className="text-gray-600">waiting...</span>
                    )}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                      Followers
                    </p>
                    <p className="text-2xl font-bold text-white">
                      {stats.followersCount?.toLocaleString() ?? (
                        <span className="text-gray-600">-</span>
                      )}
                    </p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                      Following
                    </p>
                    <p className="text-2xl font-bold text-white">
                      {stats.followingCount?.toLocaleString() ?? (
                        <span className="text-gray-600">-</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex items-center justify-between">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">
                    ID
                  </p>
                  <p className="text-xs font-mono text-gray-400">
                    {stats.userId || "---"}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Favorites Manager */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-panel rounded-2xl p-6 shadow-xl max-h-[500px] flex flex-col"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2 text-pink-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                  </svg>
                  <span>Favorites</span>
                </h2>
                <span className="text-xs bg-pink-500/20 text-pink-300 px-2 py-1 rounded-full">
                  {favorites.length}
                </span>
              </div>

              <input
                type="text"
                placeholder="Search recent following..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 mb-4"
              />

              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {filteredFollowing.length === 0 && (
                  <div className="text-center text-gray-500 py-4 text-sm">
                    No following data found. Run automation to fetch.
                  </div>
                )}
                {filteredFollowing.map((u) => (
                  <div
                    key={u}
                    className="flex items-center justify-between bg-white/5 p-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <span className="font-mono text-sm text-gray-300 truncate max-w-[150px]">
                      @{u}
                    </span>
                    <button
                      onClick={() => toggleFavorite(u)}
                      className={`p-1.5 rounded-full transition-all ${
                        favorites.includes(u)
                          ? "bg-pink-500 text-white shadow-lg shadow-pink-500/30"
                          : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                      }`}
                    >
                      <Heart
                        size={14}
                        className={favorites.includes(u) ? "fill-current" : ""}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* System Status */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-panel rounded-2xl p-6 shadow-xl"
            >
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-emerald-300">
                <Activity size={22} />
                System Status
              </h2>
              <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/5">
                <span className="text-gray-300 flex items-center gap-2">
                  {isConnected ? (
                    <Wifi size={18} className="text-emerald-400" />
                  ) : (
                    <WifiOff size={18} className="text-rose-400" />
                  )}
                  Connection
                </span>
                <span
                  className={`font-medium ${
                    isConnected ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {isConnected ? "Active" : "Offline"}
                </span>
              </div>

              <div className="mt-4 flex gap-2">
                <div className="flex-1 bg-white/5 p-3 rounded-lg border border-white/5 text-center">
                  <span className="block text-xs text-gray-500 mb-1">
                    Platform
                  </span>
                  <span className="text-sm text-gray-300">Linux</span>
                </div>
                <div className="flex-1 bg-white/5 p-3 rounded-lg border border-white/5 text-center">
                  <span className="block text-xs text-gray-500 mb-1">
                    Engine
                  </span>
                  <span className="text-sm text-gray-300">Playwright</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Logs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-8"
          >
            <div className="glass-panel rounded-2xl border border-white/10 shadow-2xl flex flex-col h-[650px] overflow-hidden">
              <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-200">
                  <Terminal size={18} className="text-gray-400" />
                  <span className="font-mono">console_output</span>
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-gray-500 uppercase">
                    Live Stream
                  </span>
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-3 font-mono text-sm bg-[#0a0a0a]/50">
                <AnimatePresence initial={false}>
                  {logs.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center h-full text-gray-600 gap-4"
                    >
                      <ShieldCheck size={48} className="opacity-20" />
                      <p>Ready to initialize automation sequence...</p>
                    </motion.div>
                  )}
                  {logs.map((log, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex gap-4 group"
                    >
                      <span className="text-gray-600 select-none whitespace-nowrap text-xs py-1 w-[80px] text-right group-hover:text-gray-500 transition-colors">
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour12: false,
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                      <div className="flex-1 border-l-2 border-transparent pl-3 transition-colors hover:bg-white/5 rounded-r">
                        <span
                          className={`
                             inline-block w-20 text-[10px] font-bold uppercase tracking-wider py-0.5 rounded-sm mr-2 text-center select-none
                             ${
                               log.event === "error"
                                 ? "text-rose-400 bg-rose-400/10"
                                 : ""
                             }
                             ${
                               log.event === "status"
                                 ? "text-indigo-400 bg-indigo-400/10"
                                 : ""
                             }
                             ${
                               log.event === "data"
                                 ? "text-emerald-400 bg-emerald-400/10"
                                 : ""
                             }
                             ${
                               log.event === "info"
                                 ? "text-sky-400 bg-sky-400/10"
                                 : ""
                             }
                           `}
                        >
                          {log.event}
                        </span>
                        <span
                          className={`
                              break-words leading-relaxed
                              ${
                                log.event === "error"
                                  ? "text-rose-200"
                                  : "text-gray-300"
                              }
                              ${
                                log.event === "status"
                                  ? "text-indigo-100 font-medium"
                                  : ""
                              }
                           `}
                        >
                          {log.data.message || JSON.stringify(log.data)}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={logsEndRef} />
              </div>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}

export default App;
