// ── Shared Supabase client, token management, and constants ────────────────────
// Used by both App.jsx (desktop) and MobileApp.jsx (mobile) to guarantee
// identical business logic and zero duplication of critical auth code.

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const PUBLIC_ORG_ID = "00000000-0000-0000-0000-000000000001";
export const APP_VERSION = "1.0.5";

// ── Token management ─────────────────────────────────────────────────────────

// Callback set by App component — called when both tokens are expired
export let onSessionExpired = null;
export function setOnSessionExpired(fn) { onSessionExpired = fn; }

export function parseJwtExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch { return null; }
}

export function getUserIdFromToken(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub || null;
  } catch { return null; }
}

export function isTokenExpired(token) {
  const expiry = parseJwtExpiry(token);
  if (!expiry) return true;
  // Refresh 60 seconds before actual expiry
  return Date.now() > expiry - 60000;
}

export async function refreshToken() {
  const refreshTk = localStorage.getItem("sb_refresh_token");
  if (!refreshTk) throw new Error("No refresh token available");

  const res = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshTk }),
  });

  if (!res.ok) throw new Error("Refresh token expired — please sign in again");

  const data = await res.json();
  localStorage.setItem("sb_token", data.access_token);
  if (data.refresh_token) localStorage.setItem("sb_refresh_token", data.refresh_token);
  return data.access_token;
}

export async function getToken() {
  const token = localStorage.getItem("sb_token");
  if (!token) return null;

  if (!isTokenExpired(token)) return token;

  // Token expired — try to refresh silently
  try {
    return await refreshToken();
  } catch (e) {
    // Both tokens expired — clear storage and notify app
    localStorage.removeItem("sb_token");
    localStorage.removeItem("sb_refresh_token");
    if (onSessionExpired) onSessionExpired();
    return null;
  }
}

// ── Supabase API functions ────────────────────────────────────────────────────

export async function supabase(path, options = {}) {
  const token = await getToken();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    if (res.status === 401) {
      localStorage.removeItem("sb_token");
      localStorage.removeItem("sb_refresh_token");
      if (onSessionExpired) onSessionExpired();
      throw new Error("Session expired — please sign in again");
    }
    throw new Error(err.message || res.statusText);
  }
  return res.status === 204 ? null : res.json();
}

// Supabase fetch using anon key only (for external viewers with no session)
export async function supabaseAnon(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || res.statusText);
  }
  return res.status === 204 ? null : res.json();
}

export async function authFetch(path, body, method = "POST") {
  const token = await getToken();
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || data.message || "Auth error");
  return data;
}

// Invite a user via Supabase Auth Edge Function (uses service role key server-side)
export async function inviteUser(email, redirectTo) {
  const token = await getToken();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-invite`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, redirectTo }),
  });
  const data = await res.json();
  if (!res.ok) {
    const detail = data.detail ? ` — ${JSON.stringify(data.detail)}` : "";
    const logs = data.logs ? `\nLogs: ${data.logs.join(" | ")}` : "";
    throw new Error(`${data.error || "Invite failed"}${detail}${logs}`);
  }
  return data;
}

// ── Shared domain constants ──────────────────────────────────────────────────

export const SPECIALTIES = ["Colorectal","General & Hepatobiliary","Gynecology","Thoracic","Urology"];

export const PROCEDURES = {
  Thoracic: ["RUL Lobectomy","RML Lobectomy","RLL Lobectomy","LUL Lobectomy","LLL Lobectomy","Segmentectomy","Other"],
  Colorectal: ["Other"],
  "General & Hepatobiliary": ["Other"],
  Gynecology: ["Other"],
  Urology: ["Other"],
};

export const VIEW_RESTRICTIONS = [
  { value: "none",     label: "Unrestricted" },
  { value: "once_org", label: "Once per user (org members)" },
  { value: "once_all", label: "Once per user (everyone)" },
];

export const STATUS_LABELS = {
  RAW: "Native",
  IN_PROCESSING: "Annotation in Process",
  ANNOTATED: "Annotation Complete",
};

export const ROLES = ["VIEWER","EDITOR","ORGADMIN","ANNOTATOR"];

export const ROLE_COLORS = {
  VIEWER:    { bg: "rgba(74,100,128,0.3)",    color: "var(--text-muted)",  border: "rgba(74,100,128,0.4)" },
  EDITOR:    { bg: "rgba(20,80,160,0.25)",    color: "var(--blue-pale)",   border: "rgba(20,80,160,0.4)" },
  ORGADMIN:  { bg: "rgba(240,160,48,0.15)",   color: "var(--raw)",         border: "rgba(240,160,48,0.35)" },
  ANNOTATOR: { bg: "rgba(56,200,120,0.15)",   color: "var(--annotated)",   border: "rgba(56,200,120,0.3)" },
};

export function canDo(role, action) {
  const perms = {
    upload:          ["EDITOR","ORGADMIN","ANNOTATOR"],
    download:        ["EDITOR","ORGADMIN","ANNOTATOR"],
    annotate:        ["ANNOTATOR"],
    manageCompanies: ["ANNOTATOR"],
    crossCompany:    ["ANNOTATOR"],
    share:           ["EDITOR","ORGADMIN","ANNOTATOR"],
    delete:          ["EDITOR","ORGADMIN","ANNOTATOR"],
    inviteUsers:     ["ORGADMIN","ANNOTATOR"],
  };
  return (perms[action] || []).includes(role);
}

export function isPublicOrg(id) { return id === PUBLIC_ORG_ID; }

export function uploadFileWithProgress(url, file, token, apiKey, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("apikey", apiKey);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.addEventListener("progress", e => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
      else reject(new Error(`Upload failed: ${xhr.statusText}`));
    });
    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.send(file);
  });
}
