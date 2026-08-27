import { test, expect, type Page } from "@playwright/test";
import {
  COMMERCIAL, COMMERCIAL_AVEC_FICHES, PROSPECTEUR,
  CHEF_EQUIPE, DIRECTION_GENERALE, ADMIN, login,
} from "./helpers";

/**
 * Vérifie les correctifs de périmètre par rôle issus de l'audit du 2026-08-05.
 * Chaque test cible un correctif précis et échoue si la régression revient.
 *
 * Les comptes CHEF_EQUIPE et DIRECTION_GENERALE ne sont pas créés par `npm run seed` :
 * renseignez E2E_CHEF_EQUIPE_EMAIL / _PASSWORD et E2E_DG_EMAIL / _PASSWORD pour les
 * activer, sinon les tests correspondants sont ignorés (et non silencieusement verts).
 */

/** Attend que la page ait fini son premier chargement de données. */
async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
}

test.describe("Audit #9 — COMMERCIAL ne peut pas modifier la planification", () => {
  test("la carte des parcours est en lecture seule", async ({ page }) => {
    await login(page, COMMERCIAL.email, COMMERCIAL.password);
    await page.goto("/planification");
    await settle(page);

    // `isEditable={canEditParcours}` est false : aucune action d'édition de parcours.
    await expect(page.getByRole("button", { name: /Enregistrer le parcours/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Supprimer le parcours/i })).toHaveCount(0);
  });
});

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
    if ((await premiereFiche.count()) === 0) {
      test.skip(true, "Aucune fiche AFFECTEE disponible pour ce commercial");
    }
    await premiereFiche.click();
    await expect(page).toHaveURL(/\/fiches\/[0-9a-f-]{36}/);
    await settle(page);

    const boutonAccepter = page.getByRole("button", { name: /Acceptation client/i }).first();
    if ((await boutonAccepter.count()) === 0) {
      test.skip(true, "La fiche ouverte ne propose pas la transition ACCEPTEE");
    }
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

test.describe("Audit #1 — le CHEF_EQUIPE voit son tableau de bord", () => {
  test.skip(!CHEF_EQUIPE.password, "E2E_CHEF_EQUIPE_EMAIL / _PASSWORD non renseignés");

  test("le dashboard affiche les sections référent, pas une page vide", async ({ page }) => {
    await login(page, CHEF_EQUIPE.email, CHEF_EQUIPE.password);
    await settle(page);

    // Avant le correctif, isReferent excluait CHEF_EQUIPE : aucune section ne s'affichait.
    await expect(page.getByRole("link", { name: "Tableau de bord" })).toBeVisible();
    await expect(page.locator('a[href^="/fiches?status="]').first()).toBeVisible();
  });
});
