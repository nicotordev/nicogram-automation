import { chromium, type BrowserContext, type Page } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

type RunOptions = Readonly<{
  startUrl: string;
  userDataDir: string;
  slowMoMs: number;
}>;

function ensureDir(p: string): void {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

async function openPersistent(options: RunOptions): Promise<{ context: BrowserContext; page: Page }> {
  ensureDir(options.userDataDir);

  const context = await chromium.launchPersistentContext(options.userDataDir, {
    headless: false,
    slowMo: options.slowMoMs,
    viewport: null,
    args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
  });

  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(options.startUrl, { waitUntil: "domcontentloaded" });
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
  console.log("🧭 Navega/loguéate manualmente. Cuando quieras que ejecute el paso automatizado, presiona Enter acá.");
  await waitForEnter();

  const ts = new Date().toISOString().replaceAll(":", "-");
  await page.screenshot({ path: `./screenshots/snap-${ts}.png`, fullPage: true });
  console.log(`✅ Screenshot guardado: screenshots/snap-${ts}.png`);

  const title = await page.title();
  console.log(`✅ Título actual: ${title}`);
}

async function main(): Promise<void> {
  const root = process.cwd();
  ensureDir(path.join(root, "screenshots"));

  const options: RunOptions = {
    startUrl: "https://www.instagram.com/",
    userDataDir: path.join(root, ".user-data"),
    slowMoMs: 50,
  };

  const { context, page } = await openPersistent(options);
  try {
    await run(page);
  } finally {
    await context.close();
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error(`❌ ${msg}`);
  process.exitCode = 1;
});
