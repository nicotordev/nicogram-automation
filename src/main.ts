import * as fs from "node:fs";
import * as path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";

type RunOptions = Readonly<{
  startUrl: string;
  userDataDir: string;
  slowMoMs: number;
  userAgent?: string;
}>;

function ensureDir(p: string): void {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function nowSafe(): string {
  return new Date().toISOString().replaceAll(":", "-");
}

async function openPersistent(
  options: RunOptions,
): Promise<{ context: BrowserContext; page: Page; }> {
  ensureDir(options.userDataDir);

  const context = await chromium.launchPersistentContext(options.userDataDir, {
    headless: false,

    // 🔑 importante: deja que la ventana sea “real”
    viewport: null,
    slowMo: options.slowMoMs,
    ...(options.userAgent !== undefined ? { userAgent: options.userAgent } : {}),

    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",

      // 🔑 fuerza X11 en WSLg
      "--ozone-platform=x11",

      // 🔑 fuerza que NO se vaya off-screen
      "--window-position=0,0",
      "--window-size=1280,720",
      "--start-maximized",

      "--disable-infobars",
      "--disable-blink-features=AutomationControlled",
    ],

    ignoreDefaultArgs: ["--enable-automation"],
  });

  context.on("close", () => {
    // eslint-disable-next-line no-console
    console.log("✅ Context cerrado.");
  });

  context.on("page", (p: Page) => {
    p.on("console", (msg) => {
      // eslint-disable-next-line no-console
      console.log(`[page console:${msg.type()}] ${msg.text()}`);
    });

    p.on("pageerror", (err) => {
      // eslint-disable-next-line no-console
      console.error("[pageerror]", err);
    });

    p.on("crash", () => {
      // eslint-disable-next-line no-console
      console.error("💥 La página crasheó (page.crash event).");
    });
  });

  const page = context.pages()[0] ?? (await context.newPage());

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });
  });

  page.on("crash", () => {
    // eslint-disable-next-line no-console
    console.error("💥 Page crashed (direct listener).");
  });

  await page.goto(options.startUrl, { waitUntil: "domcontentloaded" });

  // 🔑 trae la ventana al frente (si está detrás/minimizada)
  await page.bringToFront();
  await page.waitForTimeout(250);

  return { context, page };
}

async function waitForEnter(): Promise<void> {
  await new Promise<void>((resolve) => {
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", () => resolve());
  });
}

async function run(page: Page): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("🧭 Navega manualmente. Presiona Enter para continuar...");
  await waitForEnter();

  await page.mouse.move(100, 200);
  await page.waitForTimeout(Math.floor(Math.random() * 1000) + 500);

  const ts = nowSafe();
  await page.screenshot({ path: `./screenshots/snap-${ts}.png`, fullPage: true });
  // eslint-disable-next-line no-console
  console.log("✅ Screenshot guardado.");

  const title = await page.title();
  const webdriverFlag = await page.evaluate(() => navigator.webdriver);

  // eslint-disable-next-line no-console
  console.log(`✅ Título: ${title}`);
  // eslint-disable-next-line no-console
  console.log(
    `🕵️ navigator.webdriver: ${webdriverFlag === true ? "true (MALO)" : "undefined/false (OK)"
    }`,
  );
}

async function main(): Promise<void> {
  const root = process.cwd();
  ensureDir(path.join(root, "screenshots"));

  const winUserAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  const options: RunOptions = {
    startUrl: "https://www.instagram.com/",
    userDataDir: path.join(root, ".user-data"),
    slowMoMs: 100,
    userAgent: winUserAgent,
  };

  let context: BrowserContext | null = null;

  const shutdown = (signal: NodeJS.Signals): void => {
    // eslint-disable-next-line no-console
    console.log(`\n🧹 Recibido ${signal}. Cerrando contexto limpiamente...`);
    void (async () => {
      try {
        if (context !== null) await context.close();
      } finally {
        process.exit(0);
      }
    })();
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  const opened = await openPersistent(options);
  context = opened.context;

  try {
    await run(opened.page);
  } finally {
    await opened.context.close();
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  // eslint-disable-next-line no-console
  console.error(`❌ ${msg}`);
  process.exitCode = 1;
});
