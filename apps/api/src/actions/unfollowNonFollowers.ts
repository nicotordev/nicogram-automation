import { consola } from "consola";
import * as path from "node:path";
import process from "node:process";
import { ensureDir, openPersistent, type RunOptions } from "../core/browser.js";
import { Database } from "../core/db.js";
import { broadcast } from "../core/eventBus.js";
import { waitForLogin } from "../instagram/auth.js";
import { clearPopups, unfollowUser } from "../instagram/interactions.js";

export default async function unfollowNonFollowers(signal?: AbortSignal) {
  broadcast("status", { message: "Analyzing non-followers..." });
  const db = new Database();
  
  // 1. Get Data
  const latestScan = await db.getLatestScan();
  if (!latestScan) {
    throw new Error("No scan data found. Please run a sync first.");
  }
  
  const favorites = new Set(await db.getFavorites());
  const followers = new Set(latestScan.followers);
  const following = latestScan.following;
  
  // 2. Filter: Users I follow, who don't follow me, and are NOT favorites
  const toUnfollow = following.filter(u => !followers.has(u) && !favorites.has(u));
  
  broadcast("info", { message: `Found ${toUnfollow.length} non-followers to unfollow (excluding favorites).` });
  broadcast("non-followers-count", { count: toUnfollow.length, total: toUnfollow.length });

  if (toUnfollow.length === 0) {
    broadcast("status", { message: "No one to unfollow." });
    return;
  }

  // 3. Launch Browser
  broadcast("status", { message: "Launching browser..." });
  const root = process.cwd();
  ensureDir(path.join(root, "screenshots"));
  
  const winUserAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  const runOptions: RunOptions = {
    startUrl: "https://www.instagram.com/",
    userDataDir: path.join(root, ".user-data"),
    slowMoMs: 500,
    userAgent: winUserAgent,
  };

  if (signal?.aborted) throw new Error("Cancelled before browser launch");

  const { context, page } = await openPersistent(runOptions);

  const abortHandler = async () => {
    broadcast("status", { message: "Cancelling unfollow process..." });
    try {
      await context.close();
    } catch {}
  };

  if (signal) {
    signal.addEventListener("abort", abortHandler);
  }

  try {
    if (signal?.aborted) throw new Error("Cancelled");

    broadcast("status", { message: "Waiting for login..." });
    await waitForLogin(page);
    await clearPopups(page);

    broadcast("status", { message: `Starting to unfollow ${toUnfollow.length} users...` });

    let count = 0;
    for (const username of toUnfollow) {
      if (signal?.aborted) throw new Error("Cancelled");

      // Double-check if user was added to favorites during the process
      if (await db.isFavorite(username)) {
        broadcast("info", { message: `Skipping @${username} (marked as favorite).` });
        continue;
      }

      broadcast("status", { message: `Unfollowing @${username} (${count + 1}/${toUnfollow.length})...` });
      
      try {
        await unfollowUser(page, username);
        broadcast("unfollowed-user", { username });
        count++;
        // Small random delay between users to be safe, on top of what unfollowUser does
        await page.waitForTimeout(Math.random() * 2000 + 1000);
      } catch (e: any) {
        consola.error(`Failed to unfollow @${username}:`, e);
        broadcast("error", { message: `Failed to unfollow @${username}: ${e.message}` });
      }
    }

    broadcast("status", { message: `Done! Unfollowed ${count} users.` });

  } catch (err: any) {
    if (signal?.aborted || err.message.includes("Target closed")) {
        broadcast("status", { message: "Unfollow process cancelled." });
    } else {
        consola.error("Error in unfollow workflow:", err);
        broadcast("error", { message: err.message });
    }
  } finally {
    if (signal) {
      signal.removeEventListener("abort", abortHandler);
    }
    broadcast("status", { message: "Closing browser..." });
    try {
      await context.close();
    } catch {}
  }
}
