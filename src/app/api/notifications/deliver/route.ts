import { NextResponse } from "next/server";

import { env } from "@/env";
import { deliverPendingNotifications } from "@/lib/notifications/delivery";
import { getBearerToken, getRequiredSecret } from "@/lib/security/secrets";

export async function POST(request: Request) {
  let cronSecret: string;

  try {
    cronSecret = getRequiredSecret("CRON_SECRET", env.CRON_SECRET);
  } catch {
    return NextResponse.json({ error: "Службовий ключ не налаштований." }, { status: 503 });
  }

  if (getBearerToken(request) !== cronSecret) {
    return NextResponse.json({ error: "Немає доступу." }, { status: 401 });
  }

  const result = await deliverPendingNotifications();
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
