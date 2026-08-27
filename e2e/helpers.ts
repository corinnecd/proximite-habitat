import { expect, type Page } from "@playwright/test";

// Identifiants de démo (cf. README / scripts/seed.mjs). Surchargés par env si besoin.
export const ADMIN = {
  email: process.env.E2E_EMAIL || "direction1@hdf.fr",
  password: process.env.E2E_PASSWORD || "Direction123!",
};

export const REFERENT = {
  email: "referent1@hdf.fr",
  password: "Referent123!",
};

export const COMMERCIAL = {
  email: "commercial1@hdf.fr",
  password: "Commercial123!",
};

export const PROSPECTEUR = {
  email: "prospecteur1@phc.fr",
  password: "Prospecteur123!",
};

// Commercial de l'organisation phc, qui porte des fiches AFFECTEE dans le jeu de
// démo — nécessaire pour tester la transition vers ACCEPTEE (cf. scripts/seed.mjs).
export const COMMERCIAL_AVEC_FICHES = {
  email: "commercial2@phc.fr",
  password: "Commercial123!",
};

// Non créés par `npm run seed` : uniquement via l'environnement, pour ne pas
// versionner les mots de passe de comptes réels.
export const CHEF_EQUIPE = {
  email: process.env.E2E_CHEF_EQUIPE_EMAIL || "",
  password: process.env.E2E_CHEF_EQUIPE_PASSWORD || "",
};

export const DIRECTION_GENERALE = {
  email: process.env.E2E_DG_EMAIL || "",
  password: process.env.E2E_DG_PASSWORD || "",
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
  // Le middleware redirige vers "/" et le dashboard affiche le salut. Celui-ci
  // dépend de l'heure (Bonjour / Bon après-midi / Bonsoir) : les trois doivent
  // être acceptés, sinon la suite ne passe que le matin.
  await expect(page.getByText(GREETING_RE)).toBeVisible();
}

/** Le salut du dashboard, variable selon l'heure (cf. `(dashboard)/page.tsx`). */
export const GREETING_RE = /Bonjour|Bon après-midi|Bonsoir/i;
