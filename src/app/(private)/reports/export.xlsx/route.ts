import { NextResponse } from "next/server";

import type { AppRole } from "@/lib/auth/types";
import type { CaseRow } from "@/lib/cases/types";
import { buildCasesExcel } from "@/lib/reports/excel";
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
    .select("role,is_active")
    .eq("id", user.id)
    .single<{ role: AppRole; is_active: boolean }>();

  if (!profile?.is_active) {
    return new NextResponse("Обліковий запис деактивовано.", { status: 403 });
  }

  let query = supabase
    .from("cases")
    .select(
      `
        id,title,summary,owner_user_id,created_by_user_id,assigned_marketing_user_id,
        segment_id,city_id,project_status,marketing_status,score,metadata,created_at,updated_at,archived_at,
        case_segments(name),
        cities(name),
        owner:profiles!cases_owner_user_id_fkey(display_name,email)
      `,
    )
    .is("archived_at", null);

  if (profile.role === "manager") {
    query = query.eq("owner_user_id", user.id);
  }

  const { data } = await query.order("updated_at", { ascending: false });

  const excelBuffer = await buildCasesExcel((data ?? []) as unknown as CaseRow[]);

  return new NextResponse(excelBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=\"sprof-cases-report.xlsx\"",
      "Cache-Control": "private, no-store",
    },
  });
}
