import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { submissionSchema } from "@/lib/validators";
import { verifyIbanFromFile, type OcrResult } from "@/lib/ocr";
import { CONSENT_VERSION, hashValue } from "@/lib/workflow";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const parsed = submissionSchema.safeParse({
      nationalId: form.get("nationalId"),
      hasStudentAccount: form.get("hasStudentAccount"),
      iban: form.get("iban"),
      bankName: form.get("bankName"),
      guardianName: form.get("guardianName") || undefined,
      guardianPhone: form.get("guardianPhone") || undefined,
    });
    const consentAccepted = form.get("consentAccepted") === "true";
    if (!consentAccepted) return NextResponse.json({ message: "يجب الموافقة على إقرار صحة البيانات واستخدامها." }, { status: 400 });
    if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "تحقق من البيانات" }, { status: 400 });

    const supabase = createServiceClient();
    const { data: student } = await supabase.from("students").select("id,full_name").eq("national_id", parsed.data.nationalId).eq("is_active", true).maybeSingle();
    if (!student) return NextResponse.json({ message: "الطالب غير موجود في قائمة الفريق." }, { status: 404 });

    const { data: existing } = await supabase.from("submissions").select("id,status,iban_attachment_path").eq("student_id", student.id).maybeSingle();
    if (existing && ["approved", "pending_review"].includes(existing.status)) return NextResponse.json({ message: "لا يمكن تعديل الطلب في حالته الحالية." }, { status: 409 });

    const attachment = form.get("attachment");
    let attachmentPath = existing?.iban_attachment_path ?? null;
    let ocr: OcrResult = { extractedIban: null, status: "not_found", confidence: null };

    if (attachment instanceof File && attachment.size > 0) {
      if (attachment.size > 8 * 1024 * 1024) return NextResponse.json({ message: "حجم الملف يجب ألا يتجاوز 8MB." }, { status: 400 });
      const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!allowed.includes(attachment.type)) return NextResponse.json({ message: "نوع الملف غير مدعوم." }, { status: 400 });
      const buffer = Buffer.from(await attachment.arrayBuffer());
      const extension = attachment.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "bin";
      attachmentPath = `students/${student.id}/${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("iban-documents").upload(attachmentPath, buffer, { contentType: attachment.type, upsert: false });
      if (uploadError) throw uploadError;
      ocr = await verifyIbanFromFile(buffer, attachment.type, parsed.data.iban);
    }
    if (!attachmentPath) return NextResponse.json({ message: "يجب إرفاق شهادة أو صورة الآيبان." }, { status: 400 });

    const isStudent = parsed.data.hasStudentAccount === "yes";
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    const payload = {
      student_id: student.id,
      has_student_bank_account: isStudent,
      student_iban: isStudent ? parsed.data.iban : null,
      guardian_name: isStudent ? null : parsed.data.guardianName?.trim(),
      guardian_phone: isStudent ? null : parsed.data.guardianPhone?.replace(/\D/g, ""),
      guardian_iban: isStudent ? null : parsed.data.iban,
      bank_name: parsed.data.bankName,
      iban_attachment_path: attachmentPath,
      extracted_iban: ocr.extractedIban,
      iban_match_status: ocr.status,
      iban_match_confidence: ocr.confidence,
      iban_verified_at: new Date().toISOString(),
      consent_accepted: true,
      consent_text_version: CONSENT_VERSION,
      consent_accepted_at: new Date().toISOString(),
      submitter_ip_hash: hashValue(forwarded),
      status: "pending_review",
      return_reason: null,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const query = existing
      ? supabase.from("submissions").update(payload).eq("id", existing.id)
      : supabase.from("submissions").insert(payload);
    const { error } = await query;
    if (error) throw error;
    const submissionId = existing?.id;
    if (submissionId) await supabase.from("submission_audit_log").insert({ submission_id: submissionId, action: "resubmitted", previous_values: existing, new_values: payload, metadata: { source: "student_portal" } });
    return NextResponse.json({ ok: true, ocrStatus: ocr.status });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "تعذر حفظ البيانات. حاول مرة أخرى." }, { status: 500 });
  }
}
