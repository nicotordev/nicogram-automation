import { consola } from "consola";
import { type Page } from "playwright";

export async function waitForLogin(page: Page): Promise<void> {
  consola.info("Waiting for login... Please log in manually if needed.");

  try {
    await page.waitForSelector('svg[aria-label="Home"], svg[aria-label="Inicio"]', { timeout: 120000 });
    consola.success("Login detected! Home icon found.");
  } catch (e) {
    consola.warn("Failed to detect home page automatically (timeout).");
  }
}
