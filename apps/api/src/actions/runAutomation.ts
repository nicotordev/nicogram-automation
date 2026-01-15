import { consola } from "consola";
import * as path from "node:path";
import process from "node:process";
import { ensureDir, openPersistent, type RunOptions } from "../core/browser.js";
import { Database, type ScanResult } from "../core/db.js";
import { broadcast } from "../core/eventBus.js";
import { getUserId, scrapeListViaApi } from "../instagram/api.js";
import { waitForLogin } from "../instagram/auth.js";
import { clearPopups, unfollowUser } from "../instagram/interactions.js";
import { navigateToProfile } from "../instagram/navigation.js";

export async function runAutomation(options?: { autoUnfollow?: boolean; }) {
  broadcast("status", { message: "Starting automation..." });
  const root = process.cwd();
  const db = new Database();
  ensureDir(path.join(root, "screenshots"));

  const winUserAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  const runOptions: RunOptions = {
    startUrl: "https://www.instagram.com/",
    userDataDir: path.join(root, ".user-data"),
    slowMoMs: 500,
    userAgent: winUserAgent,
  };

  broadcast("status", { message: "Launching browser..." });
  const { context, page } = await openPersistent(runOptions);

  try {
    broadcast("status", { message: "Waiting for login..." });
    await waitForLogin(page);
    await clearPopups(page);

    broadcast("status", { message: "Saving session..." });
    const storageStatePath = path.join(root, ".user-data", "storage-state.json");
    await context.storageState({ path: storageStatePath });

    broadcast("status", { message: "Navigating to profile..." });
    const username = await navigateToProfile(page);
    broadcast("info", { username });

    const userId = await getUserId(page);
    if (!userId) throw new Error("Could not determine User ID");
    broadcast("info", { userId });

    broadcast("status", { message: "Scraping followers..." });
    const followers = await scrapeListViaApi(page, 'followers', userId);
    broadcast("data", { followersCount: followers.length });

    broadcast("status", { message: "Scraping following..." });
    const following = await scrapeListViaApi(page, 'following', userId);
    broadcast("data", { followingCount: following.length });

    const result: ScanResult = { timestamp: new Date().toISOString(), followers, following };
    await db.addScan(username, result);

    // Auto-unfollow logic
    if (options?.autoUnfollow) {
      broadcast("status", { message: "Analyzing relationships for auto-unfollow..." });
      const notFollowingBack = following.filter(u => !followers.includes(u));

      const favorites = await db.getFavorites();
      const toUnfollow = notFollowingBack.filter(u => !favorites.includes(u));

      broadcast("info", { message: `Found ${notFollowingBack.length} not following back. ` });
      broadcast("info", { message: `Protected by favorites: ${notFollowingBack.length - toUnfollow.length}` });
      broadcast("info", { message: `To unfollow: ${toUnfollow.length}` });

      for (const user of toUnfollow) {
        broadcast("status", { message: `Unfollowing @${user}...` });
        try {
          await unfollowUser(page, user);
        } catch (e: any) {
          broadcast("error", { message: `Failed to unfollow @${user}: ${e.message}` });
        }
      }
    }

    broadcast("status", { message: "Done! Saved data." });

  } catch (err: any) {
    consola.error("Error running workflow:", err);
    await page.screenshot({ path: "error-screenshot.png" });
    broadcast("error", { message: err.message });
  } finally {
    broadcast("status", { message: "Closing browser..." });
    await context.close();
  }
}
