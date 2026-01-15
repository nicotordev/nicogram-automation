import { consola } from "consola";
import { type Page } from "playwright";
import { clearPopups } from "./interactions.js";

export async function navigateToProfile(page: Page): Promise<string> {
  consola.info("Navigating to user profile...");
  await clearPopups(page);

  const profileLinkText = page.getByRole('link', { name: /Profile|Perfil/i });

  if (await profileLinkText.count() > 0 && await profileLinkText.first().isVisible()) {
    consola.debug("Found profile link by text/role.");
    await profileLinkText.first().click();
  } else {
    consola.debug("Text link not found, searching for avatar in nav...");
    const nav = page.locator('nav').first();
    if (await nav.isVisible()) {
      const avatarLink = nav.getByRole('link').filter({ has: page.locator('img') }).last();

      if (await avatarLink.count() > 0) {
        consola.debug("Found avatar link in nav, clicking...");
        await avatarLink.click();
      } else {
        const genericProfile = page.locator('a[href*="/"][role="link"]').last();
        consola.debug("Trying generic last link fallback...");
        await genericProfile.click();
      }
    } else {
      throw new Error("Could not find navigation sidebar.");
    }
  }

  await page.waitForSelector('header section', { timeout: 10000 });

  const url = page.url();
  const match = url.match(/instagram\.com\/([^\/\?]+)/);
  const username = match ? match[1] : "unknown";

  consola.success(`On profile page for: ${username}`);
  return username || "unknown";
}
