import { test, expect, type Page } from "@playwright/test";
import {
  COMMERCIAL_AVEC_FICHES, PROSPECTEUR,
  DIRECTION_GENERALE, ADMIN, login,
} from "./helpers";

/**
 * Vérifie les correctifs de périmètre par rôle issus de l'audit du 2026-08-05.
 * Chaque test cible un correctif précis et échoue si la régression revient.
 *
 * Le compte DIRECTION_GENERALE n'est pas créé par `npm run seed` : renseignez
 * E2E_DG_EMAIL / E2E_DG_PASSWORD pour activer le test #10, sinon il est ignoré
 * (et non silencieusement vert).
 */

/** Attend que la page ait fini son premier chargement de données. */
async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
}

/*
 * Audit #9 : test e2e retiré. La règle a été rectifiée — l'édition des parcours
 * est ouverte aux référents, commerciaux et direction, puisque le chef d'équipe
 * est nommé parmi ces trois profils. La carte n'est rendue que s'il existe une
 * planification pour la semaine affichée : un test e2e dépendrait donc des
 * données de la semaine en cours. La règle est désormais couverte de façon
 * déterministe par `canEditParcours` dans src/lib/permissions.test.ts.
 */

test.describe("Audit #20 — l'import CSV de masse est réservé à la direction", () => {
  test("un PROSPECTEUR ne voit pas le bouton Import CSV", async ({ page }) => {
    await login(page, PROSPECTEUR.email, PROSPECTEUR.password);
    await page.goto("/fiches");
    await settle(page);

    await expect(page.getByRole("button", { name: /Import CSV/i })).toHaveCount(0);
  });

  test("une DIRECTION voit le bouton Import CSV", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/fiches");
    await settle(page);

    await expect(page.getByRole("button", { name: /Import CSV/i })).toBeVisible();
  });
});

test.describe("Audit #6 — le sélecteur de succursale est réservé au DG", () => {
  test("une DIRECTION non-DG ne voit pas le sélecteur global", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/calendrier");
    await settle(page);

    // Sans ce sélecteur, branchFilter vaut profile.organization_id : le calendrier
    // est borné à la succursale de l'utilisateur.
    await expect(page.getByText("Toutes les succursales")).toHaveCount(0);
  });
});

test.describe("Audit #5 — montant HT obligatoire pour accepter", () => {
  test("la confirmation reste désactivée tant que le montant est vide", async ({ page }) => {
    await login(page, COMMERCIAL_AVEC_FICHES.email, COMMERCIAL_AVEC_FICHES.password);
    await page.goto("/fiches?status=AFFECTEE");
    await settle(page);

    // Cible une fiche par son UUID : exclut /fiches/nouvelle et les liens de navigation.
    const premiereFiche = page
      .locator('a[href^="/fiches/"]')
      .filter({ hasNot: page.locator("nav") })
      .and(page.locator('a[href*="-"]'))
      .first();
    await expect(premiereFiche).toBeVisible();
    await premiereFiche.click();
    await expect(page).toHaveURL(/\/fiches\/[0-9a-f-]{36}/);
    await settle(page);

    // `count()` ne patiente pas : on attend explicitement le rendu des actions,
    // sinon le test se saute lui-même de façon aléatoire.
    const boutonAccepter = page.getByRole("button", { name: /Acceptation client/i }).first();
    await expect(boutonAccepter).toBeVisible();
    await boutonAccepter.click();
    await expect(page.getByText(/montant HT est obligatoire/i)).toBeVisible();

    const confirmer = page.getByRole("button", { name: /^Confirmer/i });
    await expect(confirmer).toBeDisabled();

    // Un montant valide débloque la confirmation — on ne clique pas : test non mutant.
    await page.locator("#montant-ht").fill("12500");
    await page.getByRole("textbox", { name: /Motif/i }).fill("Test e2e");
    await expect(confirmer).toBeEnabled();
  });
});

test.describe("Audit #10 — DIRECTION_GENERALE est en lecture seule", () => {
  test.skip(!DIRECTION_GENERALE.password, "E2E_DG_EMAIL / E2E_DG_PASSWORD non renseignés");

  test("aucun bouton de création d'utilisateur", async ({ page }) => {
    await login(page, DIRECTION_GENERALE.email, DIRECTION_GENERALE.password);
    await page.goto("/utilisateurs");
    await settle(page);

    await expect(page.getByText(/collaborateur/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Nouvel utilisateur/i })).toHaveCount(0);
  });
});

/*
 * Audit #1 (dashboard du CHEF_EQUIPE) : test retiré.
 * Le chef d'équipe n'est pas un profil à part : c'est un référent, un commercial
 * ou, exceptionnellement, un membre de la direction, désigné par
 * `planification_hebdo.chef_equipe_id`. Il n'y a donc pas de compte dédié à
 * tester, et le rôle `CHEF_EQUIPE` de l'enum ne reflète pas le métier.
 */
