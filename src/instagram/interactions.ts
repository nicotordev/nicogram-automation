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
