import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase";
import { createCorrectionToken } from "@/lib/workflow";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAdmin(request); const { id } = await context.params;
    const { token, hash } = createCorrectionToken(); const expires = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("correction_tokens").insert({ submission_id: id, token_hash: hash, expires_at: expires, created_by: user.id });
    if (error) throw error;
    const base = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    return NextResponse.json({ url: `${base}/?correction=${token}`, expiresAt: expires });
  } catch { return NextResponse.json({ message: "تعذر إنشاء رابط التصحيح" }, { status: 500 }); }
}
