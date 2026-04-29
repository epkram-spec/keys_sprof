import { describe, expect, it } from "vitest";

import { calculateCaseScore } from "./scoring";

describe("calculateCaseScore", () => {
  it("рахує гарячий кейс від 10 балів", () => {
    const result = calculateCaseScore({
      launchDate: "2026-05-01",
      permissionStatus: "Так",
      hasShowcase: true,
      isRecognizableClient: true,
      hasMetricOrEffect: true,
    });

    expect(result.score).toBe(12);
    expect(result.priority).toBe("Гарячий кейс");
  });

  it("рахує потенційний кейс у діапазоні 6-9", () => {
    const result = calculateCaseScore({
      permissionStatus: "Уточнюється",
      hasShowcase: true,
      isComplexProject: true,
      hasCommentPerson: true,
    });

    expect(result.score).toBe(6);
    expect(result.priority).toBe("Потенційний кейс");
  });

  it("рахує спостереження в діапазоні 0-5", () => {
    const result = calculateCaseScore({
      permissionStatus: "Ні",
      hasPhotoOrVideo: true,
      hasCommentPerson: true,
    });

    expect(result.score).toBe(2);
    expect(result.priority).toBe("Спостерігаємо");
  });

  it("не додає одночасно 3 і 1 бал за дозвіл", () => {
    const approved = calculateCaseScore({ permissionStatus: "Так" });
    const pending = calculateCaseScore({ permissionStatus: "Уточнюється" });

    expect(approved.score).toBe(3);
    expect(pending.score).toBe(1);
  });
});
