import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { nationalIdSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const nationalId = nationalIdSchema.parse(body.nationalId);
    const supabase = createServiceClient();
    const { data: student, error } = await supabase
      .from("students")
      .select("id, full_name, national_id, is_active")
      .eq("national_id", nationalId)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    if (!student) return NextResponse.json({ message: "لم يتم العثور على رقم الهوية ضمن قائمة لاعبي الفريق." }, { status: 404 });

    const { data: submission } = await supabase
      .from("submissions")
      .select("id,status,return_reason,has_student_bank_account,student_iban,guardian_name,guardian_phone,guardian_iban,bank_name,iban_attachment_path")
      .eq("student_id", student.id)
      .maybeSingle();

    return NextResponse.json({
      student: {
        id: student.id,
        name: student.full_name,
        status: submission?.status ?? "not_submitted",
        returnReason: submission?.return_reason ?? null,
        submission: submission ?? null,
      },
    });
  } catch {
    return NextResponse.json({ message: "بيانات التحقق غير صحيحة." }, { status: 400 });
  }
}
