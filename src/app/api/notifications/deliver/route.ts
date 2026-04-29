import { NextResponse } from "next/server";

import { env } from "@/env";
import { deliverPendingNotifications } from "@/lib/notifications/delivery";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (env.CRON_SECRET && token !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Немає доступу." }, { status: 401 });
  }

  const result = await deliverPendingNotifications();
  return NextResponse.json(result);
}
