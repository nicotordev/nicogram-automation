import { consola } from "consola";
import { type Page } from "playwright";
import { broadcast } from "../server/server.js";

export async function getUserId(page: Page): Promise<string> {
  const context = page.context();
  const cookies = await context.cookies();
  const dsUserIdCookie = cookies.find(c => c.name === "ds_user_id");

  if (dsUserIdCookie) {
    consola.success(`Found User ID in cookies: ${dsUserIdCookie.value}`);
    broadcast("info", { message: `Found User ID in cookies: ${dsUserIdCookie.value}` });
    return dsUserIdCookie.value;
  }

  consola.warn("Cookie not found, trying HTML scraping...");
  const userIdFromPage = await page.evaluate(() => {
    try {
      const scripts = document.querySelectorAll('script[type="application/json"]');
      for (const script of scripts) {
        if (script.textContent?.includes('"appScopedIdentity"')) {
          const match = script.textContent.match(/"appScopedIdentity"\s*:\s*"(\d+)"/);
          if (match) return match[1];
        }
      }
    } catch (e) { return null; }
    return null;
  });

  if (userIdFromPage) {
    consola.success(`Found User ID via HTML: ${userIdFromPage}`);
    broadcast("info", { message: `Found User ID via HTML: ${userIdFromPage}` });
    return userIdFromPage;
  }

  throw new Error("❌ Could not find User ID in cookies or page source.");
}

export async function scrapeListViaApi(page: Page, mode: 'followers' | 'following', userId: string): Promise<string[]> {
  const msg = `Starting API scrape for ${mode} (User ID: ${userId})...`;
  consola.start(msg);
  broadcast("status", { message: msg });

  const collected: string[] = [];
  let maxId = "";
  let hasMore = true;
  const MAX_COUNT = 5000;
  const batchSize = 50;

  while (hasMore && collected.length < MAX_COUNT) {
    let url = `https://www.instagram.com/api/v1/friendships/${userId}/${mode}/?count=${batchSize}&search_surface=follow_list_page`;
    if (maxId) {
      url += `&max_id=${encodeURIComponent(maxId)}`;
    }

    try {
      // Execute fetch in the browser context to use cookies/session
      const result = await page.evaluate(async (targetUrl) => {
        try {
          const res = await fetch(targetUrl, {
            headers: {
              'x-ig-app-id': '936619743392459',
              'x-asbd-id': '129477',
              'x-requested-with': 'XMLHttpRequest',
            }
          });

          if (!res.ok) {
            return { status: res.status, ok: false };
          }

          const data = await res.json();
          return { ok: true, data };
        } catch (e) {
          return { ok: false, error: 'Fetch failed' };
        }
      }, url);

      if (!result.ok) {
        if (result.status === 429) {
          consola.warn("Rate limited (429). Waiting 60s...");
          broadcast("info", { message: "Rate limited. Pausing for 60s..." });
          await new Promise(r => setTimeout(r, 60000));
          continue;
        }
        consola.error("API response not OK", result);
        break;
      }

      const data = result.data;
      let batchCount = 0;

      if (data.users && Array.isArray(data.users)) {
        data.users.forEach((u: any) => {
          if (u.username) {
            collected.push(u.username);
            batchCount++;
          }
        });
      }

      // Update progress
      consola.info(`Fetched ${batchCount} items. Total: ${collected.length}`);
      broadcast("data", {
        message: `Scraping ${mode}: ${collected.length} collected`,
        count: collected.length,
        mode
      });

      if (data.next_max_id) {
        maxId = data.next_max_id;
        hasMore = true;
      } else {
        hasMore = false;
        consola.info("No more pages (next_max_id missing).");
      }

      // Random delay to be safe
      const delay = Math.random() * 2000 + 1000;
      await new Promise(r => setTimeout(r, delay));

    } catch (e) {
      consola.error("Error during loop", e);
      break;
    }
  }

  const doneMsg = `API Scrape complete. Found ${collected.length} ${mode}.`;
  consola.success(doneMsg);
  broadcast("status", { message: doneMsg });

  return collected;
}
