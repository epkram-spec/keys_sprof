import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    id: string;
    fileId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id, fileId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Потрібен вхід у кабінет.", { status: 401 });
  }

  const { data: file } = await supabase
    .from("case_files")
    .select("storage_bucket,storage_path,original_name,mime_type")
    .eq("id", fileId)
    .eq("case_id", id)
    .single<{
      storage_bucket: string;
      storage_path: string;
      original_name: string;
      mime_type: string | null;
    }>();

  if (!file) {
    return new NextResponse("Файл не знайдено або немає доступу.", { status: 404 });
  }

  const { data, error } = await supabase.storage.from(file.storage_bucket).download(file.storage_path);

  if (error || !data) {
    return new NextResponse("Не вдалося завантажити файл.", { status: 404 });
  }

  return new NextResponse(data, {
    headers: {
      "Content-Type": file.mime_type ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
