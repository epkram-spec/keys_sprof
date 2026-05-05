export type ScoringInput = {
  hasPermissionChance?: boolean;
  hasVisualShowcase?: boolean;
  hasClientTask?: string | null;
  hasSprofSolution?: string | null;
  hasMetricOrEffect?: string | null;
  hasVisualHook?: string | null;
  hasBeforeOpportunity?: boolean;
  hasDuringOpportunity?: boolean;
  hasAfterOpportunity?: boolean;
  hasHighProfileObject?: boolean;
  hasBigCheck?: boolean;
  hasFeasibleDates?: boolean;
  launchDate?: string | null;
  permissionStatus?: string | null;
  isMarketRelevant?: boolean;
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
    type: "boolean",
  },
  {
    key: "hasVisualShowcase",
    shortLabel: "Візуал",
    fullLabel: "Є що показати: кухня, зона, процес, монтаж або навчання",
    points: 2,
    type: "boolean",
  },
  {
    key: "hasClientTask",
    shortLabel: "Задача",
    fullLabel: "Є задача клієнта, яку можна описати одним реченням",
    points: 1,
    type: "text",
  },
  {
    key: "hasSprofSolution",
    shortLabel: "Рішення",
    fullLabel: "Є рішення SPROF: підбір, інтеграція, запуск або інша участь команди",
    points: 2,
    type: "text",
  },
  {
    key: "hasMetricOrEffect",
    shortLabel: "Ефект",
    fullLabel: "Є ефект або цифра: швидкість, стабільність, втрати, люди чи інший результат",
    points: 2,
    type: "text",
  },
  {
    key: "hasVisualHook",
    shortLabel: "Родзинка",
    fullLabel: "Є візуальна родзинка: складні умови, темп або нестандартна задача",
    points: 1,
    type: "text",
  },
  {
    key: "hasHighProfileObject",
    shortLabel: "Гучний",
    fullLabel: "Обʼєкт або клієнт впізнаваний, гучний або цікавий для ринку",
    points: 2,
    type: "boolean",
  },
  {
    key: "hasBigCheck",
    shortLabel: "Чек",
    fullLabel: "Великий чек або стратегічно важливий проєкт",
    points: 1,
    type: "boolean",
  },
  {
    key: "hasBeforeOpportunity",
    shortLabel: "До",
    fullLabel: "Можемо зняти обʼєкт до проєктування, монтажу або запуску",
    points: 1,
    type: "boolean",
  },
  {
    key: "hasDuringOpportunity",
    shortLabel: "Під час",
    fullLabel: "Можемо зняти процес під час проєктування, монтажу або запуску",
    points: 1,
    type: "boolean",
  },
  {
    key: "hasAfterOpportunity",
    shortLabel: "Після",
    fullLabel: "Можемо зняти результат після запуску або під робочим навантаженням",
    points: 1,
    type: "boolean",
  },
  {
    key: "hasFeasibleDates",
    shortLabel: "Дата",
    fullLabel: "Є планова дата стадії, щоб маркетинг встиг підготувати виїзд",
    points: 2,
    type: "boolean",
  },
] as const;

export type ScoringCriterionKey = (typeof scoringCriteria)[number]["key"];

export function booleanFromFormValue(value: FormDataEntryValue | null) {
  return value === "on" || value === "true" || value === "Так";
}

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export function isScoringCriterionMatched(input: ScoringInput, key: ScoringCriterionKey) {
  const value = input[key];
  return typeof value === "string" ? hasText(value) : Boolean(value);
}

export function calculateCaseScore(input: ScoringInput): ScoringResult {
  const normalizedInput = normalizeLegacyScoringInput(input);
  const details = scoringCriteria.map((criterion) => ({
    label: criterion.fullLabel,
    points: criterion.points,
    matched: isScoringCriterionMatched(normalizedInput, criterion.key),
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
    hasClientTask: typeof input.hasClientTask === "string" ? input.hasClientTask : "",
    hasSprofSolution:
      typeof input.hasSprofSolution === "string"
        ? input.hasSprofSolution
        : input.isComplexProject
          ? "Комплексне рішення SPROF"
          : "",
    hasMetricOrEffect: typeof input.hasMetricOrEffect === "string" ? input.hasMetricOrEffect : "",
    hasVisualHook:
      typeof input.hasVisualHook === "string"
        ? input.hasVisualHook
        : input.hasPhotoOrVideo
          ? "Є фото або відео"
          : "",
    hasHighProfileObject: input.hasHighProfileObject ?? Boolean(input.isRecognizableClient || input.isMarketRelevant),
    hasBigCheck: input.hasBigCheck ?? false,
    hasBeforeOpportunity: input.hasBeforeOpportunity ?? false,
    hasDuringOpportunity: input.hasDuringOpportunity ?? false,
    hasAfterOpportunity: input.hasAfterOpportunity ?? false,
    hasFeasibleDates: input.hasFeasibleDates ?? Boolean(input.launchDate),
    launchDate: input.launchDate,
    permissionStatus: input.permissionStatus,
  };
}
