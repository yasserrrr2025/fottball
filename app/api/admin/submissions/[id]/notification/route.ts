import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase";
import { messageForStatus, normalizePhone } from "@/lib/workflow";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAdmin(request); const { id } = await context.params; const body = await request.json();
    const { data: s, error } = await supabase.from("submissions").select("status,return_reason,guardian_phone,students(full_name)").eq("id", id).single();
    if (error) throw error;
    const phone = normalizePhone(s.guardian_phone || body.phone || "");
    const message = messageForStatus((s.students as any).full_name, s.status, s.return_reason, body.correctionUrl || null);
    await supabase.from("notifications").insert({ submission_id: id, recipient_phone: phone || null, template_key: s.status, message_text: message, created_by: user.id });
    await supabase.from("submissions").update({ last_notified_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ message, whatsappUrl: phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : null });
  } catch { return NextResponse.json({ message: "تعذر تجهيز الإشعار" }, { status: 500 }); }
}
