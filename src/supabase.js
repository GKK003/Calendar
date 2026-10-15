import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configured = Boolean(url && key);

// Stay signed in: the session is saved on the device and renewed automatically.
export const supabase = configured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "couple-calendar-auth",
        storage:
          typeof window !== "undefined" ? window.localStorage : undefined,
      },
    })
  : null;

// Ask the browser not to clear this site's saved login when the device is short on space
if (typeof navigator !== "undefined")
  navigator.storage?.persist?.().catch(() => {});
