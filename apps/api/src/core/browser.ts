import * as fs from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright";

export type RunOptions = Readonly<{
  startUrl: string;
  userDataDir: string;
  slowMoMs: number;
  userAgent?: string;
}>;

export function ensureDir(p: string): void {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

export async function openPersistent(
  options: RunOptions,
): Promise<{ context: BrowserContext; page: Page; }> {
  ensureDir(options.userDataDir);

  const context = await chromium.launchPersistentContext(options.userDataDir, {
    headless: false,
    viewport: null,
    slowMo: options.slowMoMs,
    ...(options.userAgent !== undefined ? { userAgent: options.userAgent } : {}),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--ozone-platform=x11",
      "--window-position=0,0",
      "--window-size=1280,720",
      "--start-maximized",
      "--disable-infobars",
      "--disable-blink-features=AutomationControlled",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  });

  const page = context.pages()[0] ?? (await context.newPage());

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });
  });

  await page.goto(options.startUrl, { waitUntil: "domcontentloaded" });
  await page.bringToFront();

  return { context, page };
}
