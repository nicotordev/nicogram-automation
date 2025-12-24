import { chromium, type BrowserContext, type Page } from "playwright";
import { prisma } from "./lib/prisma.js";
import * as fs from "node:fs";
import * as path from "node:path";

type RunOptions = Readonly<{
  startUrl: string;
  userDataDir: string;
  slowMoMs: number;
  headless: boolean;
}>;

type EdgeKind = "FOLLOWERS" | "FOLLOWING";

type CollectedUser = Readonly<{
  username: string;
}>;

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function header(title: string): void {
  const line = "─".repeat(Math.max(24, title.length + 8));
  console.log(`\n${line}\n✨ ${title}\n${line}`);
}

function info(msg: string): void {
  console.log(`• ${msg}`);
}

function ok(msg: string): void {
  console.log(`✅ ${msg}`);
}

function warn(msg: string): void {
  console.warn(`⚠️  ${msg}`);
}

function fail(msg: string): void {
  console.error(`❌ ${msg}`);
}

async function openPersistent(options: RunOptions): Promise<{ context: BrowserContext; page: Page; }> {
  ensureDir(options.userDataDir);

  const context = await chromium.launchPersistentContext(options.userDataDir, {
    headless: options.headless,
    slowMo: options.slowMoMs,
    viewport: null,
    args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
  });

  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(options.startUrl, { waitUntil: "domcontentloaded" });

  return { context, page };
}

async function waitForEnter(prompt: string): Promise<void> {
  info(prompt);
  await new Promise<void>((resolve) => {
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", () => resolve());
  });
}

async function gotoOwnProfile(page: Page): Promise<string> {
  header("Paso 1: Encontrar tu perfil");

  // Instagram suele tener un link al perfil en la barra superior:
  // - a[href^="/<username>/"]
  // - o un enlace con aria-label tipo "Profile"
  //
  // Vamos con estrategia:
  // 1) intentar pillar el link de perfil desde nav
  // 2) si falla, pedirle al user que abra su perfil y presione Enter

  const candidate = await page.evaluate((): string | null => {
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href^='/']"));
    const likely = anchors
      .map((a) => a.getAttribute("href"))
      .filter((href): href is string => typeof href === "string")
      .filter((href) => {
        const clean = href.split("?")[0];
        const parts = clean?.split("/").filter(Boolean);
        return parts?.length === 1 && !["explore", "accounts", "direct", "reels"].includes(parts[0] ?? "");
      });

    // Escoge el primero que parezca username-style y no sea rutas comunes
    return likely[0] ?? null;
  });

  if (candidate == null) {
    warn("No pude inferir el link del perfil desde la UI.");
    await waitForEnter("Abre tu perfil en el navegador (tu página /<usuario>/) y luego presiona Enter aquí.");
  } else {
    const url = new URL(candidate, "https://www.instagram.com").toString();
    info(`Encontré un link probable de perfil: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded" });
  }

  const profileUrl = page.url();
  const username = extractUsernameFromProfileUrl(profileUrl);
  ok(`Perfil detectado: @${username}`);
  return username;
}

function extractUsernameFromProfileUrl(profileUrl: string): string {
  const u = new URL(profileUrl);
  const parts = u.pathname.split("/").filter(Boolean);
  const first = parts[0];
  if (typeof first !== "string" || first.length === 0) {
    throw new Error(`No pude extraer username desde URL: ${profileUrl}`);
  }

  // rutas que NO son perfil
  const reserved = new Set(["accounts", "explore", "direct", "reels", "p", "stories"]);
  if (reserved.has(first)) {
    throw new Error(`La URL actual no parece de perfil (path: /${first}/). Abre tu perfil y reintenta.`);
  }

  return first;
}

async function openEdgeDialog(page: Page, kind: EdgeKind): Promise<void> {
  header(`Paso 2: Abrir modal de ${kind === "FOLLOWERS" ? "Followers" : "Following"}`);

  const suffix = kind === "FOLLOWERS" ? "/followers/" : "/following/";
  const linkSelector = `a[href$='${suffix}']`;

  await page.waitForSelector(linkSelector, { timeout: 30_000 });
  await page.click(linkSelector);

  // Modal/dialog
  await page.waitForSelector("div[role='dialog']", { timeout: 30_000 });
  ok("Modal abierto.");
}

async function collectUsersFromDialog(page: Page): Promise<CollectedUser[]> {
  header("Paso 3: Scrollear y capturar usernames");

  const dialogSelector = "div[role='dialog']";
  const listContainerSelector = `${dialogSelector} ul`;

  await page.waitForSelector(listContainerSelector, { timeout: 30_000 });

  const seen = new Set<string>();
  let stableRounds = 0;

  for (let round = 1; round <= 300; round++) {
    const batch = await page.evaluate(
      (dialogSel: string): string[] => {
        const dialog = document.querySelector(dialogSel);
        if (!(dialog instanceof HTMLElement)) return [];

        const anchors = Array.from(dialog.querySelectorAll<HTMLAnchorElement>("a[href^='/'"));
        const usernames = anchors
          .map((a) => a.getAttribute("href"))
          .filter((href): href is string => typeof href === "string")
          .map((href) => href.split("?")[0])
          .map((href) => href?.split("/").filter(Boolean)[0])
          .filter((u): u is string => typeof u === "string" && u.length > 0);

        // Dedup básico
        return Array.from(new Set(usernames));
      },
      dialogSelector,
    );

    let added = 0;
    for (const u of batch) {
      if (!seen.has(u)) {
        seen.add(u);
        added++;
      }
    }

    info(`Round ${round}: +${added} nuevos (total: ${seen.size})`);

    // Scrollea dentro del modal (Instagram suele tener un contenedor scrollable)
    const didScroll = await page.evaluate((dialogSel: string): boolean => {
      const dialog = document.querySelector(dialogSel);
      if (!(dialog instanceof HTMLElement)) return false;

      const scrollables = Array.from(dialog.querySelectorAll<HTMLElement>("div"));
      const target = scrollables.find((el) => el.scrollHeight > el.clientHeight);

      if (!target) return false;

      const before = target.scrollTop;
      target.scrollTop = target.scrollHeight;
      return target.scrollTop !== before;
    }, dialogSelector);

    await page.waitForTimeout(600);

    if (!didScroll || added === 0) {
      stableRounds++;
    } else {
      stableRounds = 0;
    }

    // Si por varios rounds no cambia, asumimos fin
    if (stableRounds >= 6) {
      ok("Parece que llegamos al final (sin cambios por varios rounds).");
      break;
    }
  }

  const users = Array.from(seen).map((username) => ({ username }));
  ok(`Capturados: ${users.length} usuarios`);
  return users;
}

async function closeDialog(page: Page): Promise<void> {
  // Cierra con Escape (simple y menos frágil que buscar X)
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}

async function saveToDb(params: Readonly<{ ownerUsername: string; kind: EdgeKind; users: CollectedUser[]; }>): Promise<void> {
  header(`Paso 4: Guardar en DB (Prisma) — ${params.kind}`);

  // ✅ Asume este schema (abajo te lo dejo)
  // - IgAccount { id, username }
  // - IgEdge { ownerId, targetId, kind }
  //
  // Guardamos:
  // 1) owner account
  // 2) upsert de cada target
  // 3) upsert relación owner->target (kind)

  const owner = await prisma.igAccount.upsert({
    where: { username: params.ownerUsername },
    update: {},
    create: { username: params.ownerUsername },
  });

  let upserts = 0;
  for (const u of params.users) {
    const target = await prisma.igAccount.upsert({
      where: { username: u.username },
      update: {},
      create: { username: u.username },
    });

    await prisma.igEdge.upsert({
      where: {
        ownerId_targetId_kind: {
          ownerId: owner.id,
          targetId: target.id,
          kind: params.kind,
        },
      },
      update: {},
      create: {
        ownerId: owner.id,
        targetId: target.id,
        kind: params.kind,
      },
    });

    upserts++;
    if (upserts % 50 === 0) info(`DB: ${upserts}/${params.users.length} relaciones guardadas...`);
  }

  ok(`DB: ${upserts} relaciones guardadas/actualizadas.`);
}

async function run(page: Page): Promise<void> {
  header("NicoGram Bot — modo humano");
  info("1) Loguéate manualmente en Instagram.");
  info("2) Cuando estés listo, presiona Enter acá para empezar el scraping y guardado.");
  await waitForEnter("⏎ Enter = submit / arrancar");

  const ownerUsername = await gotoOwnProfile(page);

  // Followers
  await openEdgeDialog(page, "FOLLOWERS");
  const followers = await collectUsersFromDialog(page);
  await saveToDb({ ownerUsername, kind: "FOLLOWERS", users: followers });
  await closeDialog(page);

  // Following
  await openEdgeDialog(page, "FOLLOWING");
  const following = await collectUsersFromDialog(page);
  await saveToDb({ ownerUsername, kind: "FOLLOWING", users: following });
  await closeDialog(page);

  header("Listo ✅");
  ok(`Owner: @${ownerUsername}`);
  ok(`Followers: ${followers.length}`);
  ok(`Following: ${following.length}`);
}

async function main(): Promise<void> {
  const root = process.cwd();

  const options: RunOptions = {
    startUrl: "https://www.instagram.com/",
    userDataDir: path.join(root, ".user-data"),
    slowMoMs: 50,
    headless: false,
  };

  const { context, page } = await openPersistent(options);

  try {
    await run(page);
  } finally {
    await context.close();
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  fail(msg);
  process.exitCode = 1;
});
