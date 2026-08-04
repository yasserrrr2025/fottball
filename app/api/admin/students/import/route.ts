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
    
    // قراءة أسطر الملف كمصفوفة ثنائية الأبعاد بدون فرض ترويسات محددة
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });

    if (matrix.length === 0) {
      return NextResponse.json({ message: "الملف المرفق فارغ ولا يحتوي على بيانات." }, { status: 400 });
    }
    if (matrix.length > 1000) {
      return NextResponse.json({ message: "الحد الأقصى 1000 طالب في الملف." }, { status: 400 });
    }

    const invalid: Candidate[] = [];
    const validMap = new Map<string, Candidate>();
    const duplicates: Candidate[] = [];
    let processedRowsCount = 0;

    matrix.forEach((rowCells, index) => {
      if (!Array.isArray(rowCells) || rowCells.length === 0) return;

      const rowNum = index + 1;
      const stringCells = rowCells.map(c => {
        if (typeof c === "number") return Math.round(c).toString();
        return String(c ?? "").trim();
      });

      const rowLine = stringCells.join(" ").trim();
      if (!rowLine) return; // سطر فارغ

      // تجاهل صف الترويسة الرئيسية مثل (اسم الطالب، رقم الهوية، حالة التسجيل)
      if (/اسم.*طالب|رقم.*هوية|حالة.*تسجيل|تحديد|ملاحظات/i.test(rowLine) && !/\d{9,10}/.test(rowLine)) {
        return;
      }

      processedRowsCount++;

      let foundName = "";
      let foundId = "";

      // استخراج الاسم ورقم الهوية بذكاء من خلايا الصف
      stringCells.forEach((cell) => {
        const cleanDigits = cell.replace(/\D/g, "");
        
        // إذا كانت الخلية تحتوي على 10 أرقام (أو 8-9 أرقام وتحتاج إكمال)
        if (/^\d{10}$/.test(cleanDigits)) {
          foundId = cleanDigits;
        } else if (cleanDigits.length >= 8 && cleanDigits.length <= 10 && /^\d+$/.test(cell.trim())) {
          foundId = cleanDigits.padStart(10, "0");
        } else if (cell.length >= 3 && !/^\d+$/.test(cell) && !/لم يعبئ|معتمد|مرفوض|بانتظار/i.test(cell)) {
          if (!foundName || cell.length > foundName.length) {
            foundName = cell;
          }
        }
      });

      // افتراض احتياطي في حال كان ترتيب الخلايا [الاسم، رقم الهوية]
      if (!foundName && stringCells[0] && !/^\d+$/.test(stringCells[0])) {
        foundName = stringCells[0];
      }
      if (!foundId && stringCells[1]) {
        const digits = stringCells[1].replace(/\D/g, "");
        if (digits.length >= 8) foundId = digits.padStart(10, "0");
      }

      if (foundName.length < 4) {
        invalid.push({ 
          row: rowNum, 
          full_name: foundName || "غير محدد", 
          national_id: foundId || "مفقود", 
          reason: "اسم الطالب مفقود أو غير كامل (أقل من 4 أحرف)" 
        });
        return;
      }

      if (!/^\d{10}$/.test(foundId)) {
        invalid.push({ 
          row: rowNum, 
          full_name: foundName, 
          national_id: foundId || "مفقود", 
          reason: "رقم الهوية غير صحيح (يجب أن يتكون من 10 أرقام)" 
        });
        return;
      }

      if (validMap.has(foundId)) {
        duplicates.push({ 
          row: rowNum, 
          full_name: foundName, 
          national_id: foundId, 
          reason: `رقم الهوية مكرر في الملف مع الطالب (${validMap.get(foundId)?.full_name})` 
        });
        return;
      }

      validMap.set(foundId, { row: rowNum, full_name: foundName, national_id: foundId });
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
      imported: importedCount,
      importedCount,
      validCount: candidatesToInsert.length,
      totalRows: processedRowsCount,
      invalid,
      duplicates,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "تعذر استيراد الملف";
    return NextResponse.json({ message: code === "UNAUTHORIZED" ? "غير مصرح" : code }, { status: 500 });
  }
}
