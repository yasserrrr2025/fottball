import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase";

const allowed = ["approve", "approve_next", "return", "reject", "reopen"] as const;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAdmin(request);
    const { id } = await context.params;
    const body = await request.json();
    if (!allowed.includes(body.action)) return NextResponse.json({ message: "إجراء غير صحيح" }, { status: 400 });
    const { data: current } = await supabase.from("submissions").select("*").eq("id", id).maybeSingle();
    if (!current) return NextResponse.json({ message: "الطلب غير موجود" }, { status: 404 });
    if (["approve", "approve_next"].includes(body.action) && current.iban_match_status === "mismatched") return NextResponse.json({ message: "لا يمكن الاعتماد قبل معالجة عدم تطابق الآيبان مع المرفق." }, { status: 409 });

    let update: Record<string, unknown> = { updated_at: new Date().toISOString(), review_note: body.reviewNote || null };
    if (["approve", "approve_next"].includes(body.action)) update = { ...update, status: "approved", approved_at: new Date().toISOString(), approved_by: user.id, return_reason: null };
    if (body.action === "return") {
      const reason = String(body.reason || "").trim();
      if (reason.length < 5) return NextResponse.json({ message: "اكتب سبب الإعادة بوضوح" }, { status: 400 });
      update = { ...update, status: "returned_for_correction", return_reason: reason, approved_at: null, approved_by: null };
    }
    if (body.action === "reject") update = { ...update, status: "rejected", return_reason: String(body.reason || "تم رفض الطلب"), approved_at: null, approved_by: null };
    if (body.action === "reopen") update = { ...update, status: "returned_for_correction", return_reason: String(body.reason || "أعيد فتح الطلب للتعديل"), approved_at: null, approved_by: null };

    const { error } = await supabase.from("submissions").update(update).eq("id", id);
    if (error) throw error;
    await supabase.from("submission_audit_log").insert({ submission_id: id, action: body.action, reason: body.reason || null, performed_by: user.id, previous_values: current, new_values: { ...current, ...update }, metadata: { review_note: body.reviewNote || null } });
    let nextId: string | null = null;
    if (body.action === "approve_next") {
      const { data: next } = await supabase.from("submissions").select("id").eq("status", "pending_review").neq("id", id).order("submitted_at").limit(1).maybeSingle();
      nextId = next?.id || null;
    }
    return NextResponse.json({ ok: true, nextId });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ message: code === "UNAUTHORIZED" ? "غير مصرح" : "تعذر تنفيذ الإجراء" }, { status: code === "UNAUTHORIZED" ? 401 : 500 });
  }
}
