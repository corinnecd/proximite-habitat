import { defineConfig, devices } from "@playwright/test";

// Tests end-to-end : pilotent l'application réelle (Next.js + Supabase).
// Nécessitent un .env.local valide et les comptes de démo (`npm run seed`).
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // évite les connexions concurrentes qui se gênent
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    // Sans plafond, une action (click, fill…) sur un locator introuvable attend
    // indéfiniment : le test meurt sur son budget global et l'erreur pointe le
    // test — ou pire, le hook — au lieu du locator fautif. Avec un plafond, on
    // obtient le locator, la ligne et le journal d'attente.
    actionTimeout: 15_000,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
