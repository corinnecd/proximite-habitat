import { expect, type Page } from "@playwright/test";

// Identifiants de démo (cf. README / scripts/seed.mjs). Surchargés par env si besoin.
export const ADMIN = {
  email: process.env.E2E_EMAIL || "admin@phc.fr",
  password: process.env.E2E_PASSWORD || "Admin123!",
};

/** Connecte l'utilisateur et attend l'arrivée sur le tableau de bord. */
export async function login(
  page: Page,
  email: string = ADMIN.email,
  password: string = ADMIN.password
) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  // Le middleware redirige vers "/" et le dashboard affiche le salut.
  await expect(page.getByText(/Bonjour/i)).toBeVisible();
}
