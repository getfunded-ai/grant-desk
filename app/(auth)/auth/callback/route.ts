import { NextResponse, type NextRequest } from "next/server";
import { completeEmailSignIn } from "@/lib/auth/callback";
import { createClient } from "@/lib/supabase/server";

/** Every sign-in and invite email lands here. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const target = await completeEmailSignIn(request.nextUrl.searchParams, supabase?.auth ?? null);
  return NextResponse.redirect(new URL(target, request.url));
}
