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

  // Fallback a HTML scraping optimizado
  const userIdFromPage = await page.evaluate(() => {
    try {
      // @ts-ignore
      if (window.__additionalData && window.__additionalData[location.pathname]) {
        // @ts-ignore
        return window.__additionalData[location.pathname].data?.user?.id;
      }
      // Intento de Regex rápido sobre todo el HTML si falla lo anterior
      const match = document.body.innerHTML.match(/"user_id"\s*:\s*"(\d+)"/);
      if (match) return match[1];
    } catch (e) { return null; }
    return null;
  });

  if (userIdFromPage) {
    return userIdFromPage;
  }

  throw new Error("❌ Could not find User ID. Make sure you are logged in.");
}

export async function scrapeListViaApi(page: Page, mode: 'followers' | 'following', userId: string): Promise<string[]> {
  const msg = `Starting API scrape for ${mode} (User ID: ${userId})...`;
  consola.start(msg);
  broadcast("status", { message: msg });

  const collected: string[] = [];
  let maxId = "";
  let hasMore = true;
  const MAX_COUNT = 5000;

  // AUMENTADO A 50: Esto hace el script 4 veces más rápido sin aumentar el riesgo.
  const batchSize = 50;

  // Navegar a la página real para establecer headers de contexto (Referer correcto)
  if (!page.url().includes('instagram.com')) {
    await page.goto(`https://www.instagram.com/${userId}/`);
    await wait(2000, 3000);
  }

  let requestCount = 0;

  while (hasMore && collected.length < MAX_COUNT) {
    // URL legítima de la API v1
    let url = `https://www.instagram.com/api/v1/friendships/${userId}/${mode}/?count=${batchSize}&search_surface=follow_list_page`;
    if (maxId) {
      url += `&max_id=${encodeURIComponent(maxId)}`;
    }

    try {
      // Ejecutamos el fetch DENTRO del navegador para heredar cookies y sesión
      const result = await page.evaluate(async (targetUrl) => {
        try {
          // Utilidad interna para leer cookies
          const getCookie = (name: string) => {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop()?.split(';').shift();
            return null;
          };

          const csrftoken = getCookie('csrftoken');
          if (!csrftoken) return { ok: false, error: 'No CSRF Token' };

          // Intentar obtener el claim header del localStorage (mejora indetectabilidad)
          const wwwClaim = window.localStorage.getItem('ig_www_claim') || '0';

          const res = await fetch(targetUrl, {
            method: 'GET',
            headers: {
              'x-ig-app-id': '936619743392459',
              'x-asbd-id': '129477',
              'x-csrftoken': csrftoken,
              'x-ig-www-claim': wwwClaim, // CRÍTICO para parecer navegador real
              'x-requested-with': 'XMLHttpRequest',
              'X-Instagram-AJAX': '1',
              'Referer': window.location.href,
            }
          });

          if (!res.ok) return { status: res.status, ok: false };
          const data = await res.json();
          return { ok: true, data };
        } catch (e) {
          return { ok: false, error: 'Fetch execution failed' };
        }
      }, url);

      // --- MANEJO DE RESPUESTAS Y ERRORES ---

      if (!result.ok) {
        if (result.status === 429) {
          consola.warn("Rate limited (429). Pausing significantly...");
          broadcast("info", { message: "Rate limit hit. Cooling down for 3 min..." });
          // Si nos limitan, esperamos mucho tiempo real. Es la única forma de salvar la sesión.
          await wait(180000, 200000);
          continue;
        }
        if (result.status === 401 || result.status === 403) {
          consola.error(`Auth Error (${result.status}). Session might be dead.`);
          break;
        }
        // Error genérico, esperamos un poco y reintentamos
        await wait(5000, 10000);
        continue;
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

      // Feedback visual
      consola.info(`Fetched ${batchCount} items. Total: ${collected.length}`);
      broadcast("data", {
        message: `Scraping ${mode}: ${collected.length} collected`,
        count: collected.length,
        mode
      });

      // Paginación
      if (data.next_max_id) {
        maxId = data.next_max_id;
        hasMore = true;
      } else {
        hasMore = false;
        consola.info("End of list reached.");
      }

      // --- ESTRATEGIA DE TIEMPO "HUMANA" ---

      requestCount++;

      // Delay base rápido (1.5s - 2.5s)
      let currentDelay = Math.random() * 1000 + 1500;

      // Cada 10 peticiones (500 usuarios), hacemos una pausa "de descanso"
      // Esto simula que el usuario dejó de hacer scroll un momento
      if (requestCount % 10 === 0) {
        consola.log("Micro-pause to simulate human reading...");
        currentDelay = 5000 + Math.random() * 3000;
      }

      // Movimiento de mouse mínimo para mantener la sesión "viva"
      if (requestCount % 3 === 0) {
        await page.mouse.move(Math.random() * 300, Math.random() * 300);
      }

      await new Promise(r => setTimeout(r, currentDelay));

    } catch (e) {
      consola.error("Loop error", e);
      break;
    }
  }

  const doneMsg = `Scrape complete. Found ${collected.length} ${mode}.`;
  consola.success(doneMsg);
  broadcast("status", { message: doneMsg });

  return collected;
}
