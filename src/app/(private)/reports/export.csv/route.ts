import { NextResponse } from "next/server";

import type { AppRole } from "@/lib/auth/types";
import type { CaseRow } from "@/lib/cases/types";
import { buildCasesCsv } from "@/lib/reports/csv";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Потрібен вхід у кабінет.", { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: AppRole }>();

  if (profile?.role !== "leader" && profile?.role !== "admin") {
    return new NextResponse("CSV-експорт доступний тільки керівнику й адміністратору.", { status: 403 });
  }

  const { data } = await supabase
    .from("cases")
    .select(
      `
        id,title,summary,owner_user_id,created_by_user_id,assigned_marketing_user_id,
        segment_id,city_id,project_status,marketing_status,score,metadata,created_at,updated_at,archived_at,
        cities(name),
        owner:profiles!cases_owner_user_id_fkey(display_name,email)
      `,
    )
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  const csv = buildCasesCsv((data ?? []) as unknown as CaseRow[]);

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"sprof-cases-report.csv\"",
      "Cache-Control": "private, no-store",
    },
  });
}
