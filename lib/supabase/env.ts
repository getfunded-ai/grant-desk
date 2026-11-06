/**
 * Public Supabase settings. Both values are safe in the browser.
 * Missing values mean "not configured": public pages still build and render, and sign-in says so.
 */
export function getSupabasePublicEnv(): { url: string; publishableKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}
