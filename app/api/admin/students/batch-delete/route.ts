import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdmin(request);
    const body = await request.json();
    const { ids, deleteAll } = body;

    if (deleteAll) {
      const { error } = await supabase.from("students").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      return NextResponse.json({ ok: true, deletedAll: true });
    }

    if (Array.isArray(ids) && ids.length > 0) {
      const { error } = await supabase.from("students").delete().in("id", ids);
      if (error) throw error;
      return NextResponse.json({ ok: true, count: ids.length });
    }

    return NextResponse.json({ message: "لم يتم تحديد طلاب للحذف." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر حذف الطلاب المحددات.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
