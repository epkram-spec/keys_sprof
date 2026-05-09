export type CaseMetadata = {
  contactName?: string | null;
  contactPhone?: string | null;
  source?: string | null;
  expectedValue?: string | null;
  notes?: string | null;
  googleSheetRowId?: string | null;
  googleSheetLastImportedAt?: string | null;
  priority?: string | null;
  marketingMonitoring?: {
    paymentStatus?: string | null;
    equipmentApproved?: boolean;
    keyDate?: string | null;
    stagePlannedDate?: string | null;
    projectStage?: string | null;
    stageChangedAt?: string | null;
    stageHistory?: StageHistoryItem[];
    permissionComment?: string | null;
    shootingWindows?: {
      before?: string | null;
      during?: string | null;
      after?: string | null;
    };
    isHighProfile?: boolean;
    bigCheck?: boolean;
  };
  scoringInput?: Record<string, unknown>;
  scoring?: Record<string, unknown>;
  [key: string]: unknown;
};

export type CaseRow = {
  id: string;
  title: string;
  summary: string | null;
  owner_user_id: string;
  created_by_user_id: string | null;
  assigned_marketing_user_id: string | null;
  segment_id: string | null;
  city_id: string | null;
  project_status: string | null;
  marketing_status: string | null;
  score: number | null;
  metadata: CaseMetadata;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  case_segments?: { name: string } | null;
  cities?: { name: string } | null;
  owner?: { display_name: string | null; email: string } | null;
};

export type CaseComment = {
  id: string;
  body: string;
  created_at: string;
  author?: { display_name: string | null; email: string } | null;
};

export type CaseActivity = {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor?: { display_name: string | null; email: string } | null;
};

export type DirectoryOption = {
  id: string;
  name: string;
};

export type StageHistoryItem = {
  stage: string;
  plannedDate: string | null;
  changedAt: string;
  changedBy: string;
};

export const projectStatusOptions = ["Новий", "В роботі", "Очікує уточнення", "Готовий до передачі"];

export const projectStageOptions = [
  "Оплата і підготовка",
  "Проєктування",
  "Доставка",
  "Монтаж",
  "Запуск і робота",
  "Маркетинг і архів",
];

/** Maps old (v1) stage names to new consolidated stages */
export const legacyStageMapping: Record<string, string> = {
  "Оплата за обладнання": "Оплата і підготовка",
  "Комплектація погоджена": "Оплата і підготовка",
  "Проєктування / підбір рішення": "Проєктування",
  "Доставка запланована": "Доставка",
  "Доставка виконана": "Доставка",
  "Монтаж запланований": "Монтаж",
  "Монтаж у процесі": "Монтаж",
  "Монтаж виконано": "Монтаж",
  "Запуск / навчання заплановано": "Запуск і робота",
  "Запуск / навчання виконано": "Запуск і робота",
  "Робоче навантаження / експлуатація": "Запуск і робота",
  "Готово для маркетингу": "Маркетинг і архів",
  "Опубліковано": "Маркетинг і архів",
  "Архів": "Маркетинг і архів",
};

export const marketingStatusOptions = [
  "Новий",
  "Перевірити",
  "Потрібно погодити зйомку",
  "Готово до зйомки",
  "Зйомка запланована",
  "Знято",
  "Монтаж",
  "Опубліковано",
  "Відхилено",
  "Архів",
];
