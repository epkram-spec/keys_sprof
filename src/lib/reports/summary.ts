import type { AppRole } from "@/lib/auth/types";
import type { CaseRow } from "@/lib/cases/types";

export type ManagerActivity = {
  ownerId: string;
  ownerName: string;
  total: number;
  hot: number;
  published: number;
};

export type ReportSummary = {
  total: number;
  hot: number;
  potential: number;
  observing: number;
  stalled: number;
  withoutPermission: number;
  upcomingLaunch: number;
  published: number;
  managerActivity: ManagerActivity[];
};

export function buildReportSummary(cases: CaseRow[], role: AppRole): ReportSummary {
  const visibleCases = role === "manager" ? cases : cases;
  const managerMap = new Map<string, ManagerActivity>();

  for (const caseItem of visibleCases) {
    const ownerId = caseItem.owner_user_id;
    const ownerName = caseItem.owner?.display_name ?? caseItem.owner?.email ?? "Невідомо";
    const current = managerMap.get(ownerId) ?? { ownerId, ownerName, total: 0, hot: 0, published: 0 };
    current.total += 1;
    if (getPriority(caseItem) === "Гарячий кейс") {
      current.hot += 1;
    }
    if (caseItem.marketing_status === "Опубліковано") {
      current.published += 1;
    }
    managerMap.set(ownerId, current);
  }

  return {
    total: visibleCases.length,
    hot: visibleCases.filter((caseItem) => getPriority(caseItem) === "Гарячий кейс").length,
    potential: visibleCases.filter((caseItem) => getPriority(caseItem) === "Потенційний кейс").length,
    observing: visibleCases.filter((caseItem) => getPriority(caseItem) === "Спостерігаємо").length,
    stalled: visibleCases.filter(isStalled).length,
    withoutPermission: visibleCases.filter((caseItem) => getPermission(caseItem) === "Ні" || !getPermission(caseItem)).length,
    upcomingLaunch: visibleCases.filter(hasUpcomingLaunch).length,
    published: visibleCases.filter((caseItem) => caseItem.marketing_status === "Опубліковано").length,
    managerActivity: Array.from(managerMap.values()).sort((a, b) => b.total - a.total),
  };
}

export function getPriority(caseItem: CaseRow) {
  const priority = caseItem.metadata.priority;
  return typeof priority === "string" ? priority : "Спостерігаємо";
}

export function getLaunchDate(caseItem: CaseRow) {
  const monitoring = caseItem.metadata.marketingMonitoring;
  if (monitoring && typeof monitoring === "object" && "keyDate" in monitoring) {
    const keyDate = (monitoring as Record<string, unknown>).keyDate;
    if (typeof keyDate === "string" && keyDate) {
      return keyDate;
    }
  }

  const scoringInput = getScoringInput(caseItem);
  const launchDate = scoringInput.launchDate;
  return typeof launchDate === "string" ? launchDate : "";
}

export function getPermission(caseItem: CaseRow) {
  const scoringInput = getScoringInput(caseItem);
  if (typeof scoringInput.hasPermissionChance === "boolean") {
    return scoringInput.hasPermissionChance ? "Так" : "Ні";
  }
  const permission = scoringInput.permissionStatus;
  return typeof permission === "string" ? permission : "";
}

function getScoringInput(caseItem: CaseRow) {
  return caseItem.metadata.scoringInput && typeof caseItem.metadata.scoringInput === "object"
    ? (caseItem.metadata.scoringInput as Record<string, unknown>)
    : {};
}

function hasUpcomingLaunch(caseItem: CaseRow) {
  const launchDate = getLaunchDate(caseItem);
  if (!launchDate) {
    return false;
  }

  const date = new Date(`${launchDate}T00:00:00`);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return date >= start && date <= end;
}

function isStalled(caseItem: CaseRow) {
  if (caseItem.marketing_status === "Опубліковано" || caseItem.marketing_status === "Архів") {
    return false;
  }

  const updatedAt = new Date(caseItem.updated_at);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - 14);
  return updatedAt < threshold;
}
