import { test, expect } from "@playwright/test";
import { ADMIN, GREETING_RE, login } from "./helpers";

test.describe("Authentification", () => {
  test("la page de connexion s'affiche", async ({ page }) => {
    await page.goto("/login");
    // Le titre du formulaire est « Bon retour » ; « Connexion » n'apparaît que
    // dans la mention « Connexion sécurisée », qui n'est pas un heading.
    await expect(page.getByRole("heading", { name: "Bon retour" })).toBeVisible();
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

    // Le message d'erreur est rendu dans un <div class="… text-destructive …">,
    // pas dans un <p> : cibler la classe, pas la balise.
    await expect(page.locator(".text-destructive")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(GREETING_RE)).toHaveCount(0);
  });

  test("une connexion valide mène au tableau de bord", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await expect(page.getByText(GREETING_RE)).toBeVisible();
    await expect(page.getByRole("link", { name: "Tableau de bord" })).toBeVisible();
  });
});
