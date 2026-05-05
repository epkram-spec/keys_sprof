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
  permissionComment?: string | null;
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
    shortLabel: "Дозвіл на зйомку",
    fullLabel: "Можна знімати цей обʼєкт або є реальний шанс погодити зйомку",
    points: 2,
    type: "boolean",
  },
  {
    key: "hasVisualShowcase",
    shortLabel: "Є що показати",
    fullLabel: "Є що показати: кухня, зона, процес, монтаж або навчання",
    points: 2,
    type: "boolean",
  },
  {
    key: "hasClientTask",
    shortLabel: "Задача клієнта",
    fullLabel: "Є задача клієнта, яку можна описати одним реченням",
    points: 1,
    type: "text",
  },
  {
    key: "hasSprofSolution",
    shortLabel: "Рішення SPROF",
    fullLabel: "Є рішення SPROF: підбір, інтеграція, запуск або інша участь команди",
    points: 2,
    type: "text",
  },
  {
    key: "hasMetricOrEffect",
    shortLabel: "Очікуваний результат",
    fullLabel: "Результат, який заклад очікує після співпраці зі SPROF",
    points: 2,
    type: "text",
  },
  {
    key: "hasVisualHook",
    shortLabel: "Особливість проєкту",
    fullLabel: "Нестандартна деталь або будь-що, що вирізняє цей проєкт серед інших",
    points: 1,
    type: "text",
  },
  {
    key: "hasHighProfileObject",
    shortLabel: "Відомий обʼєкт",
    fullLabel: "Якщо це відомий або популярний обʼєкт - так, якщо ні - ні",
    points: 2,
    type: "boolean",
  },
  {
    key: "hasBigCheck",
    shortLabel: "Дорогий обʼєкт",
    fullLabel: "Коли замовляють багато позицій або проєкт на велику суму",
    points: 1,
    type: "boolean",
  },
  {
    key: "hasBeforeOpportunity",
    shortLabel: "Зйомка до початку",
    fullLabel: "Можемо зняти обʼєкт до початку робіт",
    points: 1,
    type: "boolean",
  },
  {
    key: "hasDuringOpportunity",
    shortLabel: "Зйомка під час монтажу",
    fullLabel: "Можемо зняти процес під час монтажу або запуску",
    points: 1,
    type: "boolean",
  },
  {
    key: "hasAfterOpportunity",
    shortLabel: "Зйомка після монтажу",
    fullLabel: "Можемо зняти результат після запуску або під робочим навантаженням",
    points: 1,
    type: "boolean",
  },
  {
    key: "hasFeasibleDates",
    shortLabel: "Планова дата",
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
  const permissionDenied = normalizedInput.permissionStatus === "Ні";

  const details = scoringCriteria.map((criterion) => ({
    label: criterion.fullLabel,
    points: criterion.points,
    matched: permissionDenied ? false : isScoringCriterionMatched(normalizedInput, criterion.key),
  }));

  const score = permissionDenied ? 0 : details.reduce((total, item) => total + (item.matched ? item.points : 0), 0);

  if (score >= 10) {
    return { score, priority: "Гарячий кейс", details };
  }

  if (score >= 6) {
    return { score, priority: "Потенційний кейс", details };
  }

  return { score, priority: "Спостерігаємо", details };
}

export function normalizeLegacyScoringInput(input: ScoringInput & Record<string, unknown>): ScoringInput {
  const permissionStatus =
    typeof input.permissionStatus === "string"
      ? input.permissionStatus
      : input.hasPermissionChance === false
        ? "Ні"
        : input.hasPermissionChance === true
          ? "Так"
          : null;

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
    permissionStatus,
    permissionComment: typeof input.permissionComment === "string" ? input.permissionComment : null,
  };
}
