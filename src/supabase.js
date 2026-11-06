import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configured = Boolean(url && key);

const memory = new Map();
const memoryStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
};

function authStorage() {
  try {
    const storage = window.localStorage;
    const key = "__calendar_storage_check__";
    storage.setItem(key, "1");
    storage.removeItem(key);
    return storage;
  } catch {
    return memoryStorage;
  }
}

// Stay signed in: the session is saved on the device and renewed automatically.
export const supabase = configured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "couple-calendar-auth",
        storage: typeof window !== "undefined" ? authStorage() : undefined,
      },
    })
  : null;

// Ask the browser not to clear this site's saved login when the device is short on space
if (typeof navigator !== "undefined") {
  try {
    navigator.storage?.persist?.()?.catch(() => {});
  } catch {
    // Persistence is an optional browser optimization.
  }
}
