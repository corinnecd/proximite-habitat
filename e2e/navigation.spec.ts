import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// Parcours d'un administrateur déjà connecté.
test.describe("Navigation (admin connecté)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("la liste des fiches s'affiche avec ses filtres", async ({ page }) => {
    await page.getByRole("link", { name: "Fiches" }).first().click();
    await expect(page).toHaveURL(/\/fiches/);
    await expect(page.getByRole("heading", { name: "Fiches de pré-visite" })).toBeVisible();
    // Filtres de statut présents
    await expect(page.getByRole("button", { name: "Toutes" })).toBeVisible();
    await expect(page.getByRole("button", { name: "À valider" })).toBeVisible();
  });

  test("on peut ouvrir le détail d'une fiche", async ({ page }) => {
    await page.goto("/fiches");
    const firstFiche = page.locator('a[href^="/fiches/"]:not([href="/fiches/nouvelle"])').first();
    await expect(firstFiche).toBeVisible();
    await firstFiche.click();
    await expect(page).toHaveURL(/\/fiches\/[0-9a-f-]{36}/);
    // En-tête de détail : référence PHC-...
    await expect(page.getByRole("heading", { name: /PHC-/ })).toBeVisible();
  });

  test("la page de reporting se charge", async ({ page }) => {
    await page.getByRole("link", { name: "Reporting" }).first().click();
    await expect(page).toHaveURL(/\/reporting/);
  });

  test("la page utilisateurs est accessible à l'admin", async ({ page }) => {
    await page.getByRole("link", { name: "Utilisateurs" }).first().click();
    await expect(page).toHaveURL(/\/utilisateurs/);
  });
});
