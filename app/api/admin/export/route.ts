import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdmin(request);
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") || "approved";
    let query = supabase.from("submissions").select("*,students(full_name,national_id)").order("submitted_at");
    if (scope === "approved") query = query.eq("status", "approved");
    if (scope === "pending") query = query.eq("status", "pending_review");
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data || []).map((s: any, index: number) => ({
      "م": index + 1,
      "نوع الرياضة": "كرة القدم",
      "الفئة": "U13",
      "الجنس": "بنين",
      "اسم المدرسة الفائزة": "عماد الدين زنكي المتوسطة",
      "عدد اللاعبين": 20,
      "اسم المدرب/ـة": "موسى مهدي الفاهمي",
      "رقم الهوية الوطنية للمدرب": "1086500525",
      "رقم الجوال": "966508812384",
      "اسم الطالب رباعياً": s.students.full_name,
      "رقم الهوية الوطنية": s.students.national_id,
      "هل الطالب يملك حساب بنكي": s.has_student_bank_account ? "نعم" : "لا",
      "رقم آيبان الطالب /ـة": s.student_iban || "",
      "رقم آيبان ولي الأمر": s.guardian_iban || "",
      "اسم البنك": s.bank_name,
      "إرفاق رابط صورة الآيبان أو QR": s.iban_attachment_path,
      "اسم ولي الأمر": s.guardian_name || "",
      "رقم جوال ولي الأمر": s.guardian_phone || "",
      "حالة الطلب": s.status
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "الفريق");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buffer, { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename=football-team-${scope}.xlsx` } });
  } catch {
    return NextResponse.json({ message: "تعذر تصدير الملف" }, { status: 500 });
  }
}
