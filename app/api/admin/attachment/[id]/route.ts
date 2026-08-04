import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireAdmin(request);
    const { id } = await context.params;
    const { data: submission } = await supabase.from("submissions").select("iban_attachment_path").eq("id", id).maybeSingle();
    if (!submission?.iban_attachment_path) return NextResponse.json({ message: "لا يوجد مرفق" }, { status: 404 });
    const { data, error } = await supabase.storage.from("iban-documents").createSignedUrl(submission.iban_attachment_path, 300);
    if (error) throw error;
    return NextResponse.json({ url: data.signedUrl });
  } catch {
    return NextResponse.json({ message: "تعذر فتح المرفق" }, { status: 401 });
  }
}
