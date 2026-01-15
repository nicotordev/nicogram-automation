import { consola } from "consola";
import { type Page } from "playwright";

export async function clearPopups(page: Page) {
  const buttonsToClick = [
    "Not Now", "Ahora no", "Cancel", "Cancelar",
    "OK", "Aceptar", "De acuerdo"
  ];

  try {
    const dialog = page.locator('div[role="dialog"]');
    if (await dialog.isVisible({ timeout: 2000 })) {
      consola.debug("Detected a dialog/popup, attempting to close...");

      for (const label of buttonsToClick) {
        const btn = dialog.getByRole('button', { name: label, exact: true });
        if (await btn.count() > 0 && await btn.isVisible()) {
          consola.debug(`Clicking "${label}" to dismiss popup.`);
          await btn.first().click();
          await page.waitForTimeout(1000);
          return;
        }
      }

      const closeIcon = dialog.locator('svg[aria-label="Close"], svg[aria-label="Cerrar"]');
      if (await closeIcon.count() > 0) {
        consola.debug("Clicking 'X' to dismiss popup.");
        await closeIcon.first().click();
        await page.waitForTimeout(1000);
        return;
      }

      consola.debug("Pressing Escape to clear dialog.");
      await page.keyboard.press('Escape');
    }
  } catch (e) {
    // Ignore errors here
  }
}

// Helper
const wait = (min: number, max: number) =>
  new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min)));

export async function unfollowUser(page: Page, username: string) {
  consola.info(`Navigating to @${username} to unfollow...`);
  await page.goto(`https://www.instagram.com/${username}/`);
  await wait(2000, 4000);

  // Look for Following button
  // It usually has a _acan class and contains text "Following"
  // We can try to find by text first
  const followingBtn = page.getByRole('button', { name: /Following|Siguiendo/i }).first();

  if (await followingBtn.isVisible()) {
    await followingBtn.click();
    await wait(1000, 2000);

    // Expect a dialog
    const dialog = page.locator('div[role="dialog"]');
    if (await dialog.isVisible()) {
      const unfollowConfirm = dialog.getByRole('button', { name: /Unfollow|Dejar de seguir/i });
      if (await unfollowConfirm.isVisible()) {
        await unfollowConfirm.click();
        consola.success(`Unfollowed @${username}`);
        await wait(2000, 3000); // Wait for action to register
      } else {
        consola.warn("Unfollow confirmation button not found");
      }
    } else {
      // Sometimes clicking "Following" just unfollows directly? No, usually confirms.
      // Or maybe the button name is slightly different.
      consola.warn("Unfollow dialog not found");
    }
  } else {
    consola.warn(`Following button not found for @${username}. Maybe not following?`);
  }
}
