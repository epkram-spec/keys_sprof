export type ScoringInput = {
  hasPermissionChance?: boolean;
  hasVisualShowcase?: boolean;
  hasClientTask?: boolean;
  hasSprofSolution?: boolean;
  hasMetricOrEffect?: boolean;
  isMarketRelevant?: boolean;
  hasVisualHook?: boolean;
  hasFeasibleDates?: boolean;
  launchDate?: string | null;
  permissionStatus?: string | null;
};

export type ScoringResult = {
  score: number;
  priority: "Гарячий кейс" | "Потенційний кейс" | "Спостерігаємо";
  details: Array<{
    label: string;
    points: number;
    matched: boolean;
  }>;
};

export const scoringCriteria = [
  {
    key: "hasPermissionChance",
    shortLabel: "Дозвіл",
    fullLabel: "Є дозвіл на зйомку або реальний шанс погодити",
    points: 2,
  },
  {
    key: "hasVisualShowcase",
    shortLabel: "Візуал",
    fullLabel: "Є що показати: кухня, зона, процес, монтаж або навчання",
    points: 2,
  },
  {
    key: "hasClientTask",
    shortLabel: "Задача",
    fullLabel: "Є задача клієнта, яку можна описати одним реченням",
    points: 1,
  },
  {
    key: "hasSprofSolution",
    shortLabel: "Рішення",
    fullLabel: "Є рішення SPROF: підбір, інтеграція, запуск або інша участь команди",
    points: 2,
  },
  {
    key: "hasMetricOrEffect",
    shortLabel: "Ефект",
    fullLabel: "Є ефект або цифра: швидкість, стабільність, втрати, люди чи інший результат",
    points: 2,
  },
  {
    key: "isMarketRelevant",
    shortLabel: "Ринок",
    fullLabel: "Обʼєкт або клієнт впізнаваний чи цікавий для ринку",
    points: 1,
  },
  {
    key: "hasVisualHook",
    shortLabel: "Родзинка",
    fullLabel: "Є візуальна родзинка: складні умови, темп або нестандартна задача",
    points: 1,
  },
  {
    key: "hasFeasibleDates",
    shortLabel: "Дати",
    fullLabel: "Є конкретні дати і команда фізично встигає на обʼєкт",
    points: 2,
  },
] as const;

export type ScoringCriterionKey = (typeof scoringCriteria)[number]["key"];

export function booleanFromFormValue(value: FormDataEntryValue | null) {
  return value === "on" || value === "true" || value === "Так";
}

export function calculateCaseScore(input: ScoringInput): ScoringResult {
  const normalizedInput = normalizeLegacyScoringInput(input);
  const details = scoringCriteria.map((criterion) => ({
    label: criterion.fullLabel,
    points: criterion.points,
    matched: Boolean(normalizedInput[criterion.key]),
  }));

  const score = details.reduce((total, item) => total + (item.matched ? item.points : 0), 0);

  if (score >= 10) {
    return { score, priority: "Гарячий кейс", details };
  }

  if (score >= 6) {
    return { score, priority: "Потенційний кейс", details };
  }

  return { score, priority: "Спостерігаємо", details };
}

export function normalizeLegacyScoringInput(input: ScoringInput & Record<string, unknown>): ScoringInput {
  return {
    hasPermissionChance:
      input.hasPermissionChance ??
      (input.permissionStatus === "Так" || input.permissionStatus === "Уточнюється"),
    hasVisualShowcase: input.hasVisualShowcase ?? Boolean(input.hasShowcase),
    hasClientTask: input.hasClientTask ?? false,
    hasSprofSolution: input.hasSprofSolution ?? Boolean(input.isComplexProject),
    hasMetricOrEffect: input.hasMetricOrEffect ?? false,
    isMarketRelevant: input.isMarketRelevant ?? Boolean(input.isRecognizableClient),
    hasVisualHook: input.hasVisualHook ?? Boolean(input.hasPhotoOrVideo),
    hasFeasibleDates: input.hasFeasibleDates ?? Boolean(input.launchDate),
    launchDate: input.launchDate,
    permissionStatus: input.permissionStatus,
  };
}
