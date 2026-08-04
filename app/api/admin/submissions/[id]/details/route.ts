import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireAdmin(request); const { id } = await context.params;
    const [submission, audit, notifications] = await Promise.all([
      supabase.from("submissions").select("*,students(full_name,national_id)").eq("id", id).single(),
      supabase.from("submission_audit_log").select("*").eq("submission_id", id).order("created_at", { ascending: false }),
      supabase.from("notifications").select("*").eq("submission_id", id).order("created_at", { ascending: false })
    ]);
    if (submission.error) throw submission.error;
    return NextResponse.json({ submission: submission.data, audit: audit.data || [], notifications: notifications.data || [] });
  } catch { return NextResponse.json({ message: "تعذر تحميل التفاصيل" }, { status: 500 }); }
}
