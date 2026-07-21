import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  bucketStart,
  buildBuckets,
  conversionRate,
  currentAndPreviousPeriod,
  DEFAULT_BUCKET_COUNT,
  type StatPoint,
} from "./stats";

// Horloge figée au lundi 8 juin 2026 (midi local) pour des résultats déterministes.
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 8, 12, 0, 0));
});
afterAll(() => vi.useRealTimers());

const at = (iso: string, status: StatPoint["status"] = "SOUMISE"): StatPoint => ({ created_at: iso, status });

describe("bucketStart", () => {
  const wed = new Date(2026, 5, 10, 9); // mercredi 10 juin 2026

  it("semaine → lundi précédent", () => {
    expect(bucketStart(wed, "week").getTime()).toBe(new Date(2026, 5, 8).getTime());
  });
  it("mois → 1er du mois", () => {
    expect(bucketStart(wed, "month").getTime()).toBe(new Date(2026, 5, 1).getTime());
  });
  it("trimestre → début du trimestre (T2 → avril)", () => {
    expect(bucketStart(wed, "quarter").getTime()).toBe(new Date(2026, 3, 1).getTime());
  });
  it("semestre → janvier pour S1, juillet pour S2", () => {
    expect(bucketStart(new Date(2026, 5, 10), "semester").getTime()).toBe(new Date(2026, 0, 1).getTime());
    expect(bucketStart(new Date(2026, 6, 10), "semester").getTime()).toBe(new Date(2026, 6, 1).getTime());
  });
  it("année → 1er janvier", () => {
    expect(bucketStart(wed, "year").getTime()).toBe(new Date(2026, 0, 1).getTime());
  });
});

describe("buildBuckets", () => {
  it("retourne le bon nombre de tranches, la dernière étant la période courante", () => {
    const buckets = buildBuckets([], "month");
    expect(buckets).toHaveLength(DEFAULT_BUCKET_COUNT.month);
    const last = buckets[buckets.length - 1];
    expect(last.start.getTime()).toBe(new Date(2026, 5, 1).getTime()); // juin 2026
    expect(last.total).toBe(0);
  });

  it("ventile les fiches dans la bonne tranche et compte par statut", () => {
    const rows: StatPoint[] = [
      at("2026-06-10T12:00:00Z", "ACCEPTEE"),
      at("2026-06-15T12:00:00Z", "REFUSEE"),
      at("2026-06-20T12:00:00Z", "BROUILLON"),
      at("2026-05-10T12:00:00Z", "SOUMISE"),
    ];
    const buckets = buildBuckets(rows, "month");
    const june = buckets[buckets.length - 1];
    const may = buckets[buckets.length - 2];

    expect(june.total).toBe(3);
    expect(june.submitted).toBe(2); // hors BROUILLON
    expect(june.accepted).toBe(1);
    expect(june.refused).toBe(1);
    expect(may.total).toBe(1);
    expect(may.submitted).toBe(1);
  });

  it("ignore les fiches hors fenêtre (trop anciennes)", () => {
    const buckets = buildBuckets([at("2000-01-01T12:00:00Z")], "month");
    expect(buckets.reduce((s, b) => s + b.total, 0)).toBe(0);
  });

  it("libellé de semestre lisible", () => {
    const buckets = buildBuckets([], "semester");
    const labels = buckets.map((b) => b.label);
    expect(labels[labels.length - 1]).toBe("1er sem. 26"); // juin 2026 = 1er semestre
    expect(labels.some((l) => l.startsWith("2e sem."))).toBe(true);
  });
});

describe("conversionRate", () => {
  it("acceptées / affectées en %", () => {
    expect(conversionRate({ assigned: 4, accepted: 1 })).toBe(25);
    expect(conversionRate({ assigned: 0, accepted: 0 })).toBe(0);
  });
});

describe("currentAndPreviousPeriod", () => {
  it("sépare période courante et précédente", () => {
    const rows: StatPoint[] = [
      at("2026-06-10T12:00:00Z", "ACCEPTEE"),
      at("2026-05-10T12:00:00Z", "SOUMISE"),
      at("2026-05-20T12:00:00Z", "REFUSEE"),
    ];
    const { current, previous } = currentAndPreviousPeriod(rows, "month");
    expect(current.total).toBe(1);
    expect(current.accepted).toBe(1);
    expect(previous.total).toBe(2);
    expect(previous.refused).toBe(1);
  });
});
