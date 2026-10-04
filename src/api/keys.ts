const LS = "senasetu.supabase.keys.v1";

export type SupabaseKeys = {
  url: string;
  anonKey: string;
  origin: "env" | "local";
};

function validUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function readSupabaseKeys(): SupabaseKeys | null {
  const envUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (envUrl && envKey && validUrl(envUrl)) {
    return { url: envUrl, anonKey: envKey, origin: "env" };
  }
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(LS);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { url?: string; anonKey?: string };
    const url = parsed.url?.trim() ?? "";
    const anonKey = parsed.anonKey?.trim() ?? "";
    if (url && anonKey && validUrl(url)) return { url, anonKey, origin: "local" };
  } catch {
    return null;
  }
  return null;
}

export function writeSupabaseKeys(url: string, anonKey: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LS, JSON.stringify({ url: url.trim(), anonKey: anonKey.trim() }));
}

export function clearSupabaseKeys() {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(LS);
  } catch {
    /* */
  }
}
