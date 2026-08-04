import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireAdmin(request);
    const { id } = await params;
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر حذف الطالب";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireAdmin(request);
    const { id } = await params;
    const body = await request.json();
    const fullName = String(body.fullName || "").trim();
    const nationalId = String(body.nationalId || "").trim();

    if (fullName.length < 4) {
      return NextResponse.json({ message: "اسم الطالب يجب ألا يقل عن 4 أحرف." }, { status: 400 });
    }
    if (!/^\d{10}$/.test(nationalId)) {
      return NextResponse.json({ message: "رقم الهوية أو الإقامة يجب أن يتكون من 10 أرقام." }, { status: 400 });
    }

    const { error } = await supabase
      .from("students")
      .update({ full_name: fullName, national_id: nationalId, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error?.code === "23505") {
      return NextResponse.json({ message: "رقم الهوية هذا مستخدم بالفعل لطالب آخر." }, { status: 409 });
    }
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تعديل بيانات الطالب";
    return NextResponse.json({ message }, { status: 500 });
  }
}
