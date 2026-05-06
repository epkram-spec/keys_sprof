import { describe, expect, it } from "vitest";

import type { CaseRow } from "@/lib/cases/types";

import { buildCasesCsv } from "./csv";

function caseRow(title: string): CaseRow {
  return {
    id: "case-id",
    title,
    summary: null,
    owner_user_id: "owner-id",
    created_by_user_id: "creator-id",
    assigned_marketing_user_id: null,
    segment_id: null,
    city_id: null,
    project_status: "Новий",
    marketing_status: "Новий",
    score: 0,
    metadata: {},
    created_at: "2026-05-06T00:00:00.000Z",
    updated_at: "2026-05-06T00:00:00.000Z",
    archived_at: null,
    owner: { display_name: null, email: "manager@example.com" },
    cities: { name: "Київ" },
  };
}

describe("buildCasesCsv", () => {
  it("neutralizes spreadsheet formulas in exported cells", () => {
    const csv = buildCasesCsv([caseRow("=IMPORTXML(\"https://example.com\",\"//a\")")]);

    expect(csv).toContain("\"'=IMPORTXML(\"\"https://example.com\"\",\"\"//a\"\")\"");
  });
});
