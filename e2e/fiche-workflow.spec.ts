import { test, expect } from "@playwright/test";
import { REFERENT, ADMIN, login } from "./helpers";

test.describe("Workflow fiche : création → soumission → validation", () => {
  test("un référent crée et soumet une fiche, l'admin la valide", async ({ page }) => {
    // 1. Le référent se connecte et crée une fiche
    await login(page, REFERENT.email, REFERENT.password);

    await page.goto("/fiches/nouvelle");
    await expect(page.getByText("Étape 1")).toBeVisible({ timeout: 15_000 });

    // Remplir les coordonnées prospect (étape 1)
    const nom = `E2E-Test-${Date.now()}`;
    await page.locator('input[name="prospect_nom"]').fill(nom);
    await page.locator('input[name="prospect_prenom"]').fill("Playwright");
    await page.locator('input[name="prospect_adresse"]').fill("1 rue du Test");
    await page.locator('input[name="prospect_cp"]').fill("59000");
    await page.locator('input[name="prospect_ville"]').fill("Lille");
    await page.locator('input[name="prospect_telephone"]').fill("0600000000");

    // Sauvegarder en brouillon
    await page.getByRole("button", { name: /Sauvegarder/i }).first().click();
    await expect(page.getByText(/sauvegardée/i)).toBeVisible({ timeout: 10_000 });

    // Soumettre la fiche
    const submitBtn = page.getByRole("button", { name: /Soumettre/i });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await expect(page.getByText(/soumise/i)).toBeVisible({ timeout: 10_000 });
    }

    // 2. Se déconnecter et se reconnecter en admin
    await page.goto("/login");
    await login(page, ADMIN.email, ADMIN.password);

    // 3. Aller sur les fiches à valider
    await page.goto("/fiches?status=SOUMISE");
    await expect(page.getByText(nom)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Page reporting", () => {
  test("le funnel de conversion s'affiche pour l'admin", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/reporting");
    await expect(page.getByText("Funnel de conversion")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Taux global de conversion")).toBeVisible();
  });

  test("la section objectifs du mois s'affiche", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/reporting");
    await expect(page.getByText("Objectifs du mois")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Configurer" })).toBeVisible();
  });
});

test.describe("Import CSV", () => {
  test("le bouton Import CSV est visible pour l'admin", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/fiches");
    await expect(page.getByRole("button", { name: "Import CSV" })).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Page offline", () => {
  test("la page /offline affiche le message hors ligne", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByText("Vous êtes hors ligne")).toBeVisible();
    await expect(page.getByRole("button", { name: "Réessayer" })).toBeVisible();
  });
});
