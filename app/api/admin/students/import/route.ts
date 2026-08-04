import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAdmin(request);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ message: "ملف Excel مطلوب." }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ message: "حجم الملف يتجاوز 5MB." }, { status: 400 });
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    if (rows.length > 1000) return NextResponse.json({ message: "الحد الأقصى 1000 طالب في الملف." }, { status: 400 });

    const candidates = rows.map((row, index) => {
      const keys = Object.keys(row);
      const nameKey = keys.find((k) => /اسم.*طالب|الاسم|student.*name/i.test(k));
      const idKey = keys.find((k) => /هوي|إقام|national.*id|identity/i.test(k));
      return { row: index + 2, full_name: String(nameKey ? row[nameKey] : "").trim(), national_id: String(idKey ? row[idKey] : "").replace(/\D/g, "").padStart(10, "0") };
    });
    const valid = candidates.filter((r) => r.full_name.length >= 4 && /^\d{10}$/.test(r.national_id));
    const invalid = candidates.filter((r) => !valid.includes(r));
    const unique = Array.from(new Map(valid.map((r) => [r.national_id, r])).values());
    const { data, error } = await supabase.from("students").upsert(unique.map((r) => ({ full_name: r.full_name, national_id: r.national_id, created_by: user.id, is_active: true })), { onConflict: "national_id", ignoreDuplicates: true }).select("id");
    if (error) throw error;
    return NextResponse.json({ imported: data?.length ?? 0, valid: unique.length, invalid });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ message: code === "UNAUTHORIZED" ? "غير مصرح" : "تعذر استيراد الملف" }, { status: code === "UNAUTHORIZED" ? 401 : 500 });
  }
}
