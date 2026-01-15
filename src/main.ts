import { consola } from "consola";
import * as path from "node:path";
import { ensureDir, openPersistent, type RunOptions } from "./core/browser.js";
import { Database, type ScanResult } from "./core/db.js";
import { getUserId, scrapeListViaApi } from "./instagram/api.js";
import { waitForLogin } from "./instagram/auth.js";
import { clearPopups } from "./instagram/interactions.js";
import { navigateToProfile } from "./instagram/navigation.js";
import { broadcast, registerAutomationHandler, startServer } from "./server/server.js";

async function runAutomation() {
  broadcast("status", { message: "Starting automation..." });
  const root = process.cwd();
  const db = new Database(root);
  ensureDir(path.join(root, "screenshots"));

  const winUserAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  const options: RunOptions = {
    startUrl: "https://www.instagram.com/",
    userDataDir: path.join(root, ".user-data"),
    slowMoMs: 500,
    userAgent: winUserAgent,
  };

  broadcast("status", { message: "Launching browser..." });
  const { context, page } = await openPersistent(options);

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

// Register the handler
registerAutomationHandler(runAutomation);

// Start the server
startServer(3000);

consola.box("Server started. Open http://localhost:3000 to control.");
