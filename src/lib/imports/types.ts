export type SheetMapping = {
  projectTitle: string;
  clientName: string;
  city: string;
  managerEmail: string;
  launchDate: string;
  permissionStatus: string;
  summary: string;
  rowId: string;
};

export type PreviewRowStatus = "новий" | "можливий дубль" | "помилка" | "вже імпортовано";

export type PreviewRow = {
  index: number;
  googleSheetRowId: string;
  projectTitle: string;
  clientName: string;
  city: string;
  managerEmail: string;
  launchDate: string;
  permissionStatus: string;
  summary: string;
  status: PreviewRowStatus;
  message: string;
  duplicateCaseId?: string;
};

export const defaultSheetMapping: SheetMapping = {
  projectTitle: "Назва проєкту",
  clientName: "Клієнт",
  city: "Місто",
  managerEmail: "Менеджер",
  launchDate: "Дата монтажу",
  permissionStatus: "Дозвіл",
  summary: "Опис",
  rowId: "ID рядка",
};
