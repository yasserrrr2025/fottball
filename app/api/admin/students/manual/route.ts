import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase";
import { nationalIdSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAdmin(request);
    const body = await request.json();
    const nationalId = nationalIdSchema.parse(body.nationalId);
    const fullName = String(body.fullName || "").trim();
    if (fullName.length < 4) return NextResponse.json({ message: "اسم الطالب غير مكتمل." }, { status: 400 });
    const { error } = await supabase.from("students").insert({ full_name: fullName, national_id: nationalId, created_by: user.id });
    if (error?.code === "23505") return NextResponse.json({ message: "رقم الهوية مضاف مسبقًا." }, { status: 409 });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ message: code === "UNAUTHORIZED" ? "غير مصرح" : "تعذر إضافة الطالب" }, { status: code === "UNAUTHORIZED" ? 401 : 500 });
  }
}
