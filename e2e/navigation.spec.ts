import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// Parcours d'un administrateur déjà connecté.
test.describe("Navigation (admin connecté)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("la liste des fiches s'affiche avec ses filtres", async ({ page }) => {
    // `getByRole(name)` matche en sous-chaîne : « Fiches » attrapait aussi bien
    // « Statut des Fiches » que « Fiches à valider », donc la page atteinte —
    // et son titre — variaient d'une exécution à l'autre.
    await expect(page.getByRole("link", { name: "Statut des Fiches" })).toBeVisible();
    await page.goto("/fiches");
    await expect(page).toHaveURL(/\/fiches/);
    // « Fiches de pré-visite » est rendu deux fois en <h1> : celui de la Topbar et
    // celui du hero de la page. On cible celui de la Topbar pour lever l'ambiguïté.
    await expect(
      page.locator("header").getByRole("heading", { name: "Fiches de pré-visite" }),
    ).toBeVisible();
    // Filtres de statut présents
    // `exact` obligatoire : sans lui, « Toutes » matche aussi « Toutes les dates ».
    await expect(page.getByRole("button", { name: "Toutes", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "À valider" })).toBeVisible();
  });

  test("on peut ouvrir le détail d'une fiche", async ({ page }) => {
    await page.goto("/fiches");
    // La liste n'arrive qu'après le fetch Supabase : attendre le compteur d'abord,
    // sinon l'assertion sur le premier lien expire avant le rendu des cartes.
    await expect(page.getByText(/fiches? au total/).first()).toBeVisible({ timeout: 20_000 });
    const firstFiche = page.locator('a[href^="/fiches/"]:not([href="/fiches/nouvelle"])').first();
    await expect(firstFiche).toBeVisible({ timeout: 20_000 });
    await firstFiche.click();
    await expect(page).toHaveURL(/\/fiches\/[0-9a-f-]{36}/);
    // La référence PHC- n'est pas un heading : le <h2> porte le nom du prospect,
    // et la Topbar affiche « Détail de la fiche ».
    await expect(
      page.locator("header").getByRole("heading", { name: "Détail de la fiche" }),
    ).toBeVisible();
    await expect(page.getByText(/PHC-/).first()).toBeVisible();
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
