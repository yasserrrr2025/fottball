import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { hashValue } from "@/lib/workflow";
export async function POST(request: Request) {
  try {
    const { token } = await request.json(); const supabase = createServiceClient();
    const { data, error } = await supabase.from("correction_tokens").select("id,submission_id,expires_at,used_at,submissions(*,students(full_name,national_id))").eq("token_hash", hashValue(String(token || ""))).maybeSingle();
    if (error || !data || data.used_at || new Date(data.expires_at) < new Date()) return NextResponse.json({ message: "رابط التصحيح غير صالح أو منتهي" }, { status: 410 });
    return NextResponse.json({ submission: data.submissions });
  } catch { return NextResponse.json({ message: "تعذر التحقق من الرابط" }, { status: 500 }); }
}
