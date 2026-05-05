import { describe, expect, it } from "vitest";

import { calculateCaseScore, normalizeLegacyScoringInput } from "./scoring";

describe("calculateCaseScore", () => {
  it("рахує гарячий кейс від 10 балів", () => {
    const result = calculateCaseScore({
      hasPermissionChance: true,
      hasVisualShowcase: true,
      hasClientTask: "Клієнт запускає нову кухню і хоче стабільний темп видачі.",
      hasSprofSolution: "SPROF підібрав обладнання, інтегрував лінію і провів запуск.",
      hasMetricOrEffect: "Очікуване прискорення видачі на 25%.",
      hasHighProfileObject: true,
      hasFeasibleDates: true,
    });

    expect(result.score).toBe(13);
    expect(result.priority).toBe("Гарячий кейс");
  });

  it("рахує потенційний кейс у діапазоні 6-9", () => {
    const result = calculateCaseScore({
      hasPermissionChance: true,
      hasVisualShowcase: true,
      hasClientTask: "Потрібно швидко запустити кавову зону.",
      hasSprofSolution: "SPROF підібрав комплект обладнання.",
    });

    expect(result.score).toBe(7);
    expect(result.priority).toBe("Потенційний кейс");
  });

  it("не дає бали за порожні текстові поля", () => {
    const result = calculateCaseScore({
      hasClientTask: "   ",
      hasMetricOrEffect: "",
      hasVisualHook: "Нестандартний монтаж у вузькому просторі.",
    });

    expect(result.score).toBe(1);
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

    expect(result.score).toBe(11);
    expect(result.priority).toBe("Гарячий кейс");
  });
});
