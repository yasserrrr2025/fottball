import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

type Candidate = {
  row: number;
  full_name: string;
  national_id: string;
  reason?: string;
};

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

    if (rows.length === 0) {
      return NextResponse.json({ message: "الملف المرفق فارغ ولا يحتوي على بيانات." }, { status: 400 });
    }
    if (rows.length > 1000) {
      return NextResponse.json({ message: "الحد الأقصى 1000 طالب في الملف." }, { status: 400 });
    }

    const invalid: Candidate[] = [];
    const validMap = new Map<string, Candidate>();
    const duplicates: Candidate[] = [];

    rows.forEach((row, index) => {
      const keys = Object.keys(row);
      const rowNum = index + 2;

      // البحث عن الأعمدة بحسب الاسم أو الترتيب الافتراضي
      const nameKey = keys.find((k) => /اسم|طالب|student|name/i.test(k)) ?? keys[0];
      const idKey = keys.find((k) => /هوي|إقام|سجل|national|identity|id/i.test(k)) ?? keys[1];

      const rawName = String(row[nameKey] ?? "").trim();
      let rawId = String(row[idKey] ?? "").trim();

      // التحويل الذكي في حال تحويل Excel الأرقام الكبيرة إلى صيغة علمية
      if (typeof row[idKey] === "number") {
        rawId = Math.round(row[idKey] as number).toString();
      }
      rawId = rawId.replace(/\D/g, "");

      if (rawId.length > 0 && rawId.length < 10) {
        rawId = rawId.padStart(10, "0");
      }

      if (rawName.length < 4) {
        invalid.push({ 
          row: rowNum, 
          full_name: rawName || "غير محدد", 
          national_id: rawId || "مفقود", 
          reason: "اسم الطالب غير كامل (أقل من 4 أحرف)" 
        });
        return;
      }

      if (!/^\d{10}$/.test(rawId)) {
        invalid.push({ 
          row: rowNum, 
          full_name: rawName, 
          national_id: rawId || "مفقود", 
          reason: "رقم الهوية أو الإقامة غير صحيح (يجب أن يتكون من 10 أرقام)" 
        });
        return;
      }

      if (validMap.has(rawId)) {
        duplicates.push({ 
          row: rowNum, 
          full_name: rawName, 
          national_id: rawId, 
          reason: `رقم الهوية مكرر في الملف مع الطالب (${validMap.get(rawId)?.full_name})` 
        });
        return;
      }

      validMap.set(rawId, { row: rowNum, full_name: rawName, national_id: rawId });
    });

    const candidatesToInsert = Array.from(validMap.values());
    let importedCount = 0;

    if (candidatesToInsert.length > 0) {
      const { data, error } = await supabase
        .from("students")
        .upsert(
          candidatesToInsert.map((r) => ({
            full_name: r.full_name,
            national_id: r.national_id,
            created_by: user.id,
            is_active: true
          })),
          { onConflict: "national_id", ignoreDuplicates: true }
        )
        .select("id, national_id");

      if (error) throw error;
      importedCount = data?.length ?? 0;
    }

    return NextResponse.json({
      ok: true,
      totalRows: rows.length,
      importedCount,
      validCount: candidatesToInsert.length,
      invalid,
      duplicates,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "تعذر استيراد الملف";
    return NextResponse.json({ message: code === "UNAUTHORIZED" ? "غير مصرح" : code }, { status: 500 });
  }
}
