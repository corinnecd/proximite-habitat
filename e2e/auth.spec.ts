import { test, expect } from "@playwright/test";
import { ADMIN, login } from "./helpers";

test.describe("Authentification", () => {
  test("la page de connexion s'affiche", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("une route protégée redirige vers /login si non connecté", async ({ page }) => {
    await page.goto("/fiches");
    await expect(page).toHaveURL(/\/login/);
  });

  test("des identifiants invalides affichent une erreur et restent sur /login", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("admin@phc.fr");
    await page.locator('input[type="password"]').fill("MauvaisMotDePasse!");
    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(page.locator("p.text-destructive")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/Bonjour/i)).toHaveCount(0);
  });

  test("une connexion valide mène au tableau de bord", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await expect(page.getByText(/Bonjour/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "Tableau de bord" })).toBeVisible();
  });
});
