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

export default async function syncProfile(signal?: AbortSignal) {
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
  if (signal?.aborted) throw new Error("Cancelled before start");

  const { context, page } = await openPersistent(runOptions);

  // Handle cancellation by force-closing the browser context, which will cause
  // ongoing Playwright actions to reject.
  const abortHandler = async () => {
    broadcast("status", { message: "Cancelling..." });
    try {
      await context.close();
    } catch (e) {
      // ignore
    }
  };

  if (signal) {
    signal.addEventListener("abort", abortHandler);
  }

  try {
    if (signal?.aborted) throw new Error("Cancelled");

    broadcast("status", { message: "Waiting for login..." });
    await waitForLogin(page);
    await clearPopups(page);

    if (signal?.aborted) throw new Error("Cancelled");

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

    broadcast("status", { message: "Done! Saved data." });

  } catch (err: any) {
    // If it was our manual abort, we might see "Target closed" or "Cancelled"
    if (signal?.aborted || err.message.includes("Target closed")) {
      broadcast("status", { message: "Operation cancelled." });
      consola.info("Workflow cancelled by user.");
    } else {
      consola.error("Error running workflow:", err);
      try {
        await page.screenshot({ path: "error-screenshot.png" });
      } catch {} // Context might be closed
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
