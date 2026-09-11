import { NextResponse } from "next/server";
import { createOptionalClient } from "@/lib/supabase/server";
import { SIGN_IN_PATH } from "@/lib/auth/paths";

export async function POST(request: Request) {
  const supabase = await createOptionalClient();
  await supabase?.auth.signOut();
  return NextResponse.redirect(new URL(SIGN_IN_PATH, request.url), { status: 303 });
}
