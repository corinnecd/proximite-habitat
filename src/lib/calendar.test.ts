import { describe, it, expect } from "vitest";
import {
  getMondayOfWeek,
  getWeekDays,
  getMonthGrid,
  toDateKey,
  addMonths,
  addWeeks,
  isSameDay,
} from "./calendar";

describe("getMondayOfWeek", () => {
  it("mercredi -> lundi précédent", () => {
    const wed = new Date(2026, 5, 10); // mercredi 10 juin 2026
    expect(toDateKey(getMondayOfWeek(wed))).toBe("2026-06-08");
  });
  it("dimanche -> lundi de la même semaine (pas la suivante)", () => {
    const sun = new Date(2026, 5, 14); // dimanche 14 juin 2026
    expect(toDateKey(getMondayOfWeek(sun))).toBe("2026-06-08");
  });
  it("lundi -> lui-même", () => {
    const mon = new Date(2026, 5, 8);
    expect(toDateKey(getMondayOfWeek(mon))).toBe("2026-06-08");
  });
});

describe("getWeekDays", () => {
  it("retourne 7 jours consécutifs, du lundi au dimanche", () => {
    const days = getWeekDays(new Date(2026, 5, 10));
    expect(days).toHaveLength(7);
    expect(toDateKey(days[0])).toBe("2026-06-08");
    expect(toDateKey(days[6])).toBe("2026-06-14");
    for (let i = 1; i < 7; i++) {
      expect(days[i].getTime() - days[i - 1].getTime()).toBe(24 * 60 * 60 * 1000);
    }
  });
});

describe("getMonthGrid", () => {
  it("juin 2026 : semaines complètes de 7 jours couvrant tout le mois", () => {
    const weeks = getMonthGrid(new Date(2026, 5, 15));
    for (const week of weeks) {
      expect(week).toHaveLength(7);
    }
    // Le 1er et le dernier jour du mois doivent être présents dans la grille.
    const flat = weeks.flat().map(toDateKey);
    expect(flat).toContain("2026-06-01");
    expect(flat).toContain("2026-06-30");
    // Chaque semaine commence un lundi.
    for (const week of weeks) {
      expect(week[0].getDay()).toBe(1);
    }
  });

  it("février 2026 (mois court) : la grille reste cohérente", () => {
    const weeks = getMonthGrid(new Date(2026, 1, 10));
    const flat = weeks.flat().map(toDateKey);
    expect(flat).toContain("2026-02-01");
    expect(flat).toContain("2026-02-28");
    for (const week of weeks) {
      expect(week).toHaveLength(7);
    }
  });
});

describe("toDateKey", () => {
  it("formate en YYYY-MM-DD avec zéro-padding", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("addMonths / addWeeks", () => {
  it("addMonths avance/recule sans déborder sur les mois courts", () => {
    const jan31 = new Date(2026, 0, 31);
    expect(toDateKey(addMonths(jan31, 1)).slice(0, 7)).toBe("2026-02");
  });
  it("addWeeks avance de 7 jours par unité", () => {
    const d = new Date(2026, 5, 8);
    expect(toDateKey(addWeeks(d, 2))).toBe("2026-06-22");
  });
});

describe("isSameDay", () => {
  it("compare uniquement année/mois/jour", () => {
    expect(isSameDay(new Date(2026, 5, 8, 3), new Date(2026, 5, 8, 20))).toBe(true);
    expect(isSameDay(new Date(2026, 5, 8), new Date(2026, 5, 9))).toBe(false);
  });
});
