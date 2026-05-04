import { describe, expect, it } from "vitest";

import { calculateCaseScore, normalizeLegacyScoringInput } from "./scoring";

describe("calculateCaseScore", () => {
  it("рахує гарячий кейс від 10 балів", () => {
    const result = calculateCaseScore({
      hasPermissionChance: true,
      hasVisualShowcase: true,
      hasClientTask: true,
      hasSprofSolution: true,
      hasMetricOrEffect: true,
      isMarketRelevant: true,
    });

    expect(result.score).toBe(10);
    expect(result.priority).toBe("Гарячий кейс");
  });

  it("рахує потенційний кейс у діапазоні 6-9", () => {
    const result = calculateCaseScore({
      hasPermissionChance: true,
      hasVisualShowcase: true,
      hasClientTask: true,
      hasSprofSolution: true,
    });

    expect(result.score).toBe(7);
    expect(result.priority).toBe("Потенційний кейс");
  });

  it("рахує спостереження у діапазоні 0-5", () => {
    const result = calculateCaseScore({
      hasClientTask: true,
      isMarketRelevant: true,
      hasVisualHook: true,
    });

    expect(result.score).toBe(3);
    expect(result.priority).toBe("Спостерігаємо");
  });

  it("зберігає сумісність зі старими полями скорингу", () => {
    const input = normalizeLegacyScoringInput({
      permissionStatus: "Так",
      hasShowcase: true,
      isComplexProject: true,
      isRecognizableClient: true,
      hasPhotoOrVideo: true,
      launchDate: "2026-05-10",
    });

    const result = calculateCaseScore(input);

    expect(result.score).toBe(10);
    expect(result.priority).toBe("Гарячий кейс");
  });
});
