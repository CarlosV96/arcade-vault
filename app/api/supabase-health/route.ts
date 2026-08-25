import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { error } = await supabase.from("_health_check").select("id").limit(1);

  // "PGRST205" = PostgREST no encontró la tabla en su schema cache: la conexión
  // sí llegó hasta el proyecto. Cualquier otro error (URL/clave inválida, sin
  // red, etc.) es una falla real.
  if (error && error.code !== "PGRST205") {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
