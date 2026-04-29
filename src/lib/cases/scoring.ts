export type PermissionStatus = "Так" | "Уточнюється" | "Ні" | "";

export type ScoringInput = {
  launchDate?: string | null;
  permissionStatus?: PermissionStatus | string | null;
  hasShowcase?: boolean;
  isRecognizableClient?: boolean;
  isComplexProject?: boolean;
  hasMetricOrEffect?: boolean;
  hasCommentPerson?: boolean;
  hasPhotoOrVideo?: boolean;
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

export function booleanFromFormValue(value: FormDataEntryValue | null) {
  return value === "on" || value === "true" || value === "Так";
}

export function calculateCaseScore(input: ScoringInput): ScoringResult {
  const details = [
    {
      label: "Є дата монтажу або запуску",
      points: 3,
      matched: Boolean(input.launchDate),
    },
    {
      label: "Дозвіл на використання кейсу: Так",
      points: 3,
      matched: input.permissionStatus === "Так",
    },
    {
      label: "Дозвіл на використання кейсу: Уточнюється",
      points: 1,
      matched: input.permissionStatus === "Уточнюється",
    },
    {
      label: "Є що показати",
      points: 2,
      matched: Boolean(input.hasShowcase),
    },
    {
      label: "Впізнаваний клієнт",
      points: 2,
      matched: Boolean(input.isRecognizableClient),
    },
    {
      label: "Комплексний проєкт",
      points: 2,
      matched: Boolean(input.isComplexProject),
    },
    {
      label: "Є цифра або ефект",
      points: 2,
      matched: Boolean(input.hasMetricOrEffect),
    },
    {
      label: "Є людина для коментаря",
      points: 1,
      matched: Boolean(input.hasCommentPerson),
    },
    {
      label: "Є фото або відео",
      points: 1,
      matched: Boolean(input.hasPhotoOrVideo),
    },
  ];

  const score = details.reduce((total, item) => total + (item.matched ? item.points : 0), 0);

  if (score >= 10) {
    return { score, priority: "Гарячий кейс", details };
  }

  if (score >= 6) {
    return { score, priority: "Потенційний кейс", details };
  }

  return { score, priority: "Спостерігаємо", details };
}
