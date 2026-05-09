import { cn } from "@/lib/utils";

type StatusTone = "neutral" | "red" | "orange" | "yellow" | "green" | "blue" | "violet" | "slate";

const toneClasses: Record<StatusTone, string> = {
  neutral: "border-slate-200 bg-white text-slate-700",
  red: "border-red-200 bg-red-50 text-red-700",
  orange: "border-orange-200 bg-orange-50 text-orange-700",
  yellow: "border-yellow-200 bg-yellow-50 text-yellow-800",
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  blue: "border-sky-200 bg-sky-50 text-sky-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
  slate: "border-slate-200 bg-slate-50 text-slate-600",
};

const cardToneClasses: Record<StatusTone, string> = {
  neutral: "border-slate-200 bg-white text-slate-800",
  red: "border-red-200 bg-red-50 text-red-800",
  orange: "border-orange-200 bg-orange-50 text-orange-800",
  yellow: "border-yellow-200 bg-yellow-50 text-yellow-900",
  green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  blue: "border-sky-200 bg-sky-50 text-sky-800",
  violet: "border-violet-200 bg-violet-50 text-violet-800",
  slate: "border-slate-200 bg-slate-50 text-slate-700",
};

export function getToneCardClass(tone: StatusTone) {
  return cardToneClasses[tone];
}

export function StatusPill({
  children,
  className,
  tone = "neutral",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: StatusTone;
}) {
  return (
    <span className={cn("h-fit max-w-full rounded-md border px-2.5 py-1 text-xs font-semibold leading-4", toneClasses[tone], className)}>
      {children}
    </span>
  );
}

export function getPriorityTone(priority: string): StatusTone {
  if (priority.includes("Гаряч")) {
    return "red";
  }

  if (priority.includes("Потенц")) {
    return "yellow";
  }

  return "slate";
}

export function getPermissionTone(permission: string): StatusTone {
  if (permission === "Так") {
    return "green";
  }

  if (permission === "Ні" || permission.includes("Без")) {
    return "red";
  }

  return "yellow";
}

export function getProjectTone(status: string): StatusTone {
  if (status.includes("Готов")) {
    return "green";
  }

  if (status.includes("Очіку")) {
    return "yellow";
  }

  if (status.includes("робот")) {
    return "blue";
  }

  return "slate";
}

export function getMarketingTone(status: string): StatusTone {
  if (status.includes("Перевір") || status.includes("Погод") || status.includes("погод")) {
    return "orange";
  }

  if (status.includes("Готов") || status.includes("Опублік")) {
    return "green";
  }

  if (status.includes("Зйом")) {
    return "blue";
  }

  if (status.includes("Матеріал") || status.includes("Знято")) {
    return "violet";
  }

  if (status.includes("Відхил")) {
    return "red";
  }

  if (status.includes("Арх")) {
    return "slate";
  }

  return "neutral";
}

export function getStageTone(stage: string): StatusTone {
  if (!stage) {
    return "slate";
  }

  if (stage.includes("Оплата") || stage.includes("підготовка")) {
    return "yellow";
  }

  if (stage.includes("Проєкт")) {
    return "blue";
  }

  if (stage.includes("Доставка")) {
    return "violet";
  }

  if (stage.includes("Монтаж")) {
    return "orange";
  }

  if (stage.includes("Запуск") || stage.includes("робота")) {
    return "green";
  }

  if (stage.includes("Маркетинг") || stage.includes("архів")) {
    return "green";
  }

  return "neutral";
}

export function getMetricTone(label: string): StatusTone {
  if (label.includes("Гаряч") || label.includes("Без дозвол")) {
    return "red";
  }

  if (label.includes("Перевір") || label.includes("Доповн") || label.includes("Завис")) {
    return "orange";
  }

  if (label.includes("Потенц") || label.includes("7")) {
    return "yellow";
  }

  if (label.includes("Опублік")) {
    return "green";
  }

  if (label.includes("Нов")) {
    return "blue";
  }

  return "neutral";
}
