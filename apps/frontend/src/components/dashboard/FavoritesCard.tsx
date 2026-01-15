import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FavoritesCardProps {
  favorites: string[];
  followingList: string[];
  toggleFavorite: (username: string) => void;
}

export function FavoritesCard({
  favorites,
  followingList,
  toggleFavorite,
}: FavoritesCardProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredFollowing = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (q.length === 0) return followingList;
    return followingList.filter((u) => u.toLowerCase().includes(q));
  }, [followingList, searchTerm]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 }}
    >
      <Card className="overflow-hidden">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Heart className="h-4 w-4 text-muted-foreground" />
              Favorites
            </CardTitle>
            <Badge variant="secondary">{favorites.length}</Badge>
          </div>

          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search recent following…"
            aria-label="Search in following list"
          />
        </CardHeader>

        <CardContent className="pt-0">
          <ScrollArea className="h-[360px] pr-3">
            <div className="space-y-2">
              {filteredFollowing.length === 0 ? (
                <div className="rounded-lg border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                  No following data found. Run automation to fetch.
                </div>
              ) : (
                filteredFollowing.map((u) => {
                  const isFav = favorites.includes(u);
                  return (
                    <div
                      key={u}
                      className="flex items-center justify-between rounded-lg border bg-card px-3 py-2"
                    >
                      <span className="max-w-[70%] truncate font-mono text-sm text-muted-foreground">
                        @{u}
                      </span>

                      <Button
                        variant={isFav ? "default" : "secondary"}
                        size="icon"
                        onClick={() => toggleFavorite(u)}
                        aria-label={
                          isFav
                            ? `Remove @${u} from favorites`
                            : `Add @${u} to favorites`
                        }
                      >
                        <Heart
                          className={isFav ? "h-4 w-4 fill-current" : "h-4 w-4"}
                        />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </motion.div>
  );
}
