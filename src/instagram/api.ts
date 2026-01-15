import { consola } from "consola";
import { type Page } from "playwright";
import { broadcast } from "../server/server.js";

// Helper para esperar tiempos aleatorios
const wait = (min: number, max: number) =>
  new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min)));

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

  // Intenta extraer de window._sharedData o scripts modernos de IG
  const userIdFromPage = await page.evaluate(() => {
    try {
      // Método moderno: buscar en variables globales comunes de IG
      // @ts-ignore
      if (window.__additionalData && window.__additionalData[location.pathname]) {
        // @ts-ignore
        return window.__additionalData[location.pathname].data?.user?.id;
      }

      const scripts = document.querySelectorAll('script[type="application/json"]');
      for (const script of scripts) {
        if (script.textContent?.includes('"user_id"')) {
          const match = script.textContent.match(/"user_id"\s*:\s*"(\d+)"/);
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
  const batchSize = 12; // Bajamos el batch size para ser menos agresivos

  // Asegurar que estamos en el contexto correcto para el Referer
  if (!page.url().includes('instagram.com')) {
    await page.goto(`https://www.instagram.com/${mode === 'followers' ? 'followers' : 'following'}`);
    await wait(2000, 4000);
  }

  while (hasMore && collected.length < MAX_COUNT) {
    let url = `https://www.instagram.com/api/v1/friendships/${userId}/${mode}/?count=${batchSize}&search_surface=follow_list_page`;
    if (maxId) {
      url += `&max_id=${encodeURIComponent(maxId)}`;
    }

    try {
      // 1. Simular comportamiento humano antes de la petición
      // Mueve el mouse un poco aleatoriamente para disparar eventos de tracking internos de IG
      await page.mouse.move(Math.random() * 500, Math.random() * 500);
      await wait(500, 1500);

      // 2. Ejecutar fetch dentro del contexto con Headers Full
      const result = await page.evaluate(async (targetUrl) => {
        try {
          // Extraer CSRF Token dinámicamente de las cookies del documento actual
          const getCookie = (name: string) => {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop()?.split(';').shift();
            return null;
          };

          const csrftoken = getCookie('csrftoken');

          if (!csrftoken) return { ok: false, error: 'No CSRF Token found' };

          const res = await fetch(targetUrl, {
            method: 'GET',
            headers: {
              'x-ig-app-id': '936619743392459',
              'x-asbd-id': '129477',
              'x-csrftoken': csrftoken, // CRUCIAL
              'x-requested-with': 'XMLHttpRequest',
              'Referer': window.location.href, // CRUCIAL: Debe coincidir con el origen
            }
          });

          if (!res.ok) {
            return { status: res.status, ok: false };
          }

          const data = await res.json();
          return { ok: true, data };
        } catch (e) {
          return { ok: false, error: 'Fetch failed inside page' };
        }
      }, url);

      // Manejo de errores
      if (!result.ok) {
        if (result.status === 429) {
          consola.warn("Rate limited (429). Waiting 2-3 minutes...");
          broadcast("info", { message: "Rate limited. Pausing for 150s..." });
          await wait(150000, 180000); // 429 requiere pausas largas reales
          continue;
        }
        if (result.status === 401 || result.status === 403) {
          consola.error("Soft Ban or Auth Error (401/403). Stopping.");
          break;
        }
        consola.error("API response not OK", result);
        break; // Romper en otros errores para no quemar la cuenta
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

      // Delay aleatorio más largo entre peticiones (3s a 6s)
      // Instagram banea si haces requests rítmicos perfectos
      await wait(3000, 6000);

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
