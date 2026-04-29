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
  metadata: Record<string, unknown>;
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

export const projectStatusOptions = ["Новий", "В роботі", "Очікує уточнення", "Готовий до передачі"];

export const marketingStatusOptions = ["Не передано", "Перевірити", "Прийнято", "Повернуто"];
