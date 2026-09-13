import { createClient } from "@supabase/supabase-js";

// هل الكود يعمل الآن في المتصفح أم في السيرفر؟
const isClient = typeof window !== "undefined";

// رابط سوبابيز (يدعم المتصفح والسيرفر)
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

// المفتاح: في المتصفح نستخدم مفتاح anon العام، وفي السيرفر نستخدم مفتاح service_role
const supabaseKey = isClient
  ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  : (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: isClient,
          autoRefreshToken: isClient,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      })
    : null;

export function isSupabaseRealtimeConfigured() {
  return Boolean(supabase);
}

export default supabase;