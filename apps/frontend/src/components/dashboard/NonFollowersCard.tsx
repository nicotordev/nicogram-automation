import { motion } from "framer-motion";
import { Heart, Play, Pause, UserMinus } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NonFollowersCardProps {
  nonFollowers: string[];
  favorites: string[];
  toggleFavorite: (username: string) => void;
  toggleUnfollow: () => void;
  isUnfollowing: boolean;
}

export function NonFollowersCard({
  nonFollowers,
  favorites,
  toggleFavorite,
  toggleUnfollow,
  isUnfollowing,
}: NonFollowersCardProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredList = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = q.length === 0 
      ? nonFollowers 
      : nonFollowers.filter((u) => u.toLowerCase().includes(q));
    
    // Sort: Favorites last (safe), others first. Or just alphabetical.
    // Let's just list them.
    return list;
  }, [nonFollowers, searchTerm]);

  // Calculate stats
  const pendingCount = nonFollowers.filter(u => !favorites.includes(u)).length;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 }}
    >
      <Card className="overflow-hidden">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserMinus className="h-4 w-4 text-muted-foreground" />
              Non-Followers
            </CardTitle>
            <div className="flex items-center gap-2">
                <Badge variant="outline">{nonFollowers.length}</Badge>
                {filteredList.length > 0 && (
                    <Button 
                        size="sm" 
                        variant={isUnfollowing ? "destructive" : "default"}
                        onClick={toggleUnfollow}
                        className="h-7 text-xs"
                    >
                        {isUnfollowing ? (
                            <>
                                <Pause className="mr-1 h-3 w-3" /> Stop
                            </>
                        ) : (
                            <>
                                <Play className="mr-1 h-3 w-3" /> Unfollow All
                            </>
                        )}
                    </Button>
                )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
             {pendingCount} users at risk of being unfollowed.
          </p>

          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search non-followers…"
            aria-label="Search in non-followers list"
          />
        </CardHeader>

        <CardContent className="pt-0">
          <ScrollArea className="h-[360px] pr-3">
            <div className="space-y-2">
              {filteredList.length === 0 ? (
                <div className="rounded-lg border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                  No non-followers found (or data not loaded).
                </div>
              ) : (
                filteredList.map((u) => {
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
                        title={isFav ? "Protected (Favorite)" : "Add to favorites to protect"}
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
