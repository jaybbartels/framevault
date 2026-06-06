import React, { useState, useEffect, useRef, useCallback } from "react";

// ── Supabase config ───────────────────────────────────────────────────────────
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function supaHeaders(token) {
  return {
    apikey: SUPA_KEY,
    Authorization: `Bearer ${token || SUPA_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

// ── Auth ──────────────────────────────────────────────────────────────────────
const SESSION_KEY = "map65_session";

function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}
function saveSession(s) {
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
}
function getToken() { return getSession()?.access_token || null; }
function getAuthUser() { return getSession()?.user || null; }

async function authSignUp(email, password) {
  const res = await fetch(`${SUPA_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: SUPA_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Signup failed");
  if (data.access_token) saveSession(data);
  return data;
}

async function authSignIn(email, password) {
  const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPA_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Login failed");
  saveSession(data);
  return data;
}

async function authSignOut() {
  const token = getToken();
  if (token) {
    await fetch(`${SUPA_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  saveSession(null);
}

// ── DB helpers ────────────────────────────────────────────────────────────────
async function dbGet(path) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    headers: supaHeaders(getToken()),
  });
  if (!res.ok) return null;
  return res.json();
}

async function dbPatch(path, body) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: supaHeaders(getToken()),
    body: JSON.stringify(body),
  });
  return res.ok;
}

async function dbPost(path, body) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: supaHeaders(getToken()),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "DB error");
  }
  return res.json();
}

async function dbDelete(path) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    method: "DELETE",
    headers: supaHeaders(getToken()),
  });
  return res.ok;
}

async function getProfile(userId) {
  const rows = await dbGet(`profiles?id=eq.${userId}&limit=1`);
  return rows?.[0] || null;
}

async function getCompany(companyId) {
  const rows = await dbGet(`companies?id=eq.${companyId}&limit=1`);
  return rows?.[0] || null;
}

async function getAllCompanies() {
  return (await dbGet(`companies?order=name.asc`)) || [];
}

async function getVideos(profile) {
  if (!profile) return [];
  let q;
  if (profile.role === "ANNOTATOR") {
    q = `videos?hidden=eq.false&order=created_at.desc`;
  } else {
    q = `videos?hidden=eq.false&order=created_at.desc&or=(company_id.eq.${profile.company_id},is_public.eq.true)`;
  }
  return (await dbGet(q)) || [];
}

async function uploadVideoFile(file, onProgress) {
  const ext = file.name.split(".").pop();
  const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const uploadUrl = `${SUPA_URL}/storage/v1/object/videos/${path}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl);
    xhr.setRequestHeader("apikey", SUPA_KEY);
    xhr.setRequestHeader("Authorization", `Bearer ${getToken()}`);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const publicUrl = `${SUPA_URL}/storage/v1/object/public/videos/${path}`;
        resolve(publicUrl);
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload network error"));
    xhr.send(file);
  });
}

// ── Specialty / Procedure data ────────────────────────────────────────────────
const SPECIALTIES = [
  "Colorectal",
  "General & Hepatobiliary",
  "Gynecology",
  "Thoracic",
  "Urology",
];

const PROCEDURES = {
  Thoracic: ["RUL Lobectomy","RML Lobectomy","RLL Lobectomy","LUL Lobectomy","LLL Lobectomy","Segmentectomy","Other"],
  Colorectal: ["Other"],
  "General & Hepatobiliary": ["Other"],
  Gynecology: ["Other"],
  Urology: ["Other"],
};

// ── Status labels ─────────────────────────────────────────────────────────────
const STATUS_LABEL = {
  RAW: "Native",
  IN_PROCESSING: "Annotation in Process",
  ANNOTATED: "Annotation Complete",
};

const STATUS_STYLE = {
  RAW:           { bg: "#0f2d4a", color: "#5090c8", border: "#1450a0" },
  IN_PROCESSING: { bg: "#2a1f0a", color: "#d4a44c", border: "#8a6420" },
  ANNOTATED:     { bg: "#0a2a1a", color: "#4caf7d", border: "#1a6640" },
};

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  bg:       "#060e1e",
  surface:  "#0a1628",
  surface2: "#0d1e35",
  border:   "#1a2d4a",
  brand:    "#1450a0",
  blue:     "#5090c8",
  pale:     "#78a0c8",
  text:     "#e8eef5",
  muted:    "#4a6080",
  danger:   "#c0392b",
  success:  "#1e8449",
  warning:  "#d4a44c",
};

// ── Global CSS ────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }
  body {
    font-family: 'Source Sans 3', sans-serif;
    background: ${C.bg};
    color: ${C.text};
    font-size: 14px;
    line-height: 1.5;
  }
  input, textarea, select {
    font-family: inherit;
    font-size: 13px;
    color: ${C.text};
    background: ${C.surface};
    border: 1.5px solid ${C.border};
    border-radius: 6px;
    padding: 9px 12px;
    width: 100%;
    outline: none;
    transition: border-color 0.2s;
  }
  input:focus, textarea:focus, select:focus { border-color: ${C.brand}; }
  input::placeholder, textarea::placeholder { color: ${C.muted}; }
  select option { background: ${C.surface}; }
  button { font-family: inherit; cursor: pointer; border: none; }
  table { border-collapse: collapse; width: 100%; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: ${C.surface}; }
  ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
  .fadeIn { animation: fadeIn 0.3s ease; }
`;

// ── Components ────────────────────────────────────────────────────────────────
function Spinner({ size = 16, color = C.blue }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size,
      border: `2px solid ${color}30`, borderTopColor: color,
      borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0,
    }} />
  );
}

function Btn({ children, onClick, disabled, variant = "primary", size = "md", loading, style: sx, title }) {
  const variants = {
    primary:   { background: C.brand, color: "#fff" },
    secondary: { background: "transparent", color: C.pale, border: `1.5px solid ${C.border}` },
    danger:    { background: C.danger, color: "#fff" },
    success:   { background: C.success, color: "#fff" },
    ghost:     { background: "transparent", color: C.blue },
  };
  const sizes = {
    sm: { padding: "5px 12px", fontSize: 12 },
    md: { padding: "8px 18px", fontSize: 13 },
    lg: { padding: "11px 24px", fontSize: 14 },
  };
  return (
    <button
      onClick={disabled || loading ? undefined : onClick}
      title={title}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        borderRadius: 6, fontWeight: 600, fontFamily: "'Rajdhani', sans-serif",
        letterSpacing: "0.03em", cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1, transition: "opacity 0.15s, background 0.15s",
        border: "none", ...variants[variant], ...sizes[size], ...sx,
      }}
    >
      {loading && <Spinner size={12} color={variant === "primary" || variant === "danger" || variant === "success" ? "#fff" : C.blue} />}
      {children}
    </button>
  );
}

function Badge({ status }) {
  const s = STATUS_STYLE[status] || { bg: C.surface2, color: C.muted, border: C.border };
  return (
    <span style={{
      fontSize: 11, padding: "3px 10px", borderRadius: 20,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, letterSpacing: "0.05em",
      whiteSpace: "nowrap",
    }}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function Modal({ title, onClose, children, width = 520 }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 100, padding: "1rem",
    }}>
      <div className="fadeIn" style={{
        background: C.surface, border: `1.5px solid ${C.border}`,
        borderRadius: 12, width: "100%", maxWidth: width,
        maxHeight: "90vh", overflow: "auto",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "1.25rem 1.5rem", borderBottom: `1px solid ${C.border}`,
        }}>
          <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 18, fontWeight: 700, color: C.blue }}>
            {title}
          </h3>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: C.muted, fontSize: 20,
            cursor: "pointer", lineHeight: 1, padding: "2px 6px",
          }}>×</button>
        </div>
        <div style={{ padding: "1.5rem" }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, fontFamily: "'Rajdhani', sans-serif", textTransform: "uppercase", letterSpacing: "0.07em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Toast({ message, type = "info", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  const colors = { info: C.blue, success: C.success, error: C.danger, warning: C.warning };
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 200,
      background: C.surface2, border: `1.5px solid ${colors[type]}`,
      borderRadius: 8, padding: "12px 18px", maxWidth: 360,
      boxShadow: `0 4px 20px rgba(0,0,0,0.4)`,
      fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: C.text,
    }}>
      {message}
    </div>
  );
}

// ── Auth Screen ───────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) return;
    if (mode === "signup" && !company.trim()) return;
    setLoading(true); setError("");
    try {
      if (mode === "signup") {
        // Create or get company
        const existing = await dbGet(`companies?name=ilike.${encodeURIComponent(company.trim())}&limit=1`);
        let companyId;
        if (existing?.length) {
          companyId = existing[0].id;
        } else {
          const created = await dbPost("companies", { name: company.trim() });
          companyId = created[0]?.id;
        }
        const session = await authSignUp(email, password);
        const userId = session.user?.id;
        if (userId && companyId) {
          await dbPost("profiles", { id: userId, email: email.trim(), company_id: companyId, role: "VIEWER" });
        }
      } else {
        await authSignIn(email, password);
      }
      onAuth();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      background: `linear-gradient(135deg, ${C.bg} 0%, #0a1830 100%)`,
    }}>
      {/* Left panel */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "3rem",
        borderRight: `1px solid ${C.border}`,
        background: `linear-gradient(160deg, #07101f 0%, #0d1e35 100%)`,
      }}>
        <img src="/logo.png" alt="MAP65" style={{ width: 180, marginBottom: "2rem" }} />
        <p style={{
          fontFamily: "'Rajdhani', sans-serif", fontSize: 16, color: C.pale,
          textAlign: "center", maxWidth: 280, lineHeight: 1.7, fontWeight: 500,
        }}>
          Surgical Video Management &amp; Annotation Platform
        </p>
        <div style={{ marginTop: "3rem", display: "flex", flexDirection: "column", gap: "1rem", width: "100%", maxWidth: 260 }}>
          {["Secure video storage", "Annotation workflow", "Multi-organization access"].map(f => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: C.brand, fontSize: 16 }}>◆</span>
              <span style={{ color: C.muted, fontSize: 13 }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{
        width: 420, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: "3rem 2.5rem",
      }}>
        <div style={{ width: "100%" }}>
          <h2 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 26, fontWeight: 700, color: C.text, marginBottom: 6 }}>
            {mode === "login" ? "Sign In" : "Create Account"}
          </h2>
          <p style={{ color: C.muted, fontSize: 13, marginBottom: "2rem" }}>
            {mode === "login" ? "Access your MAP65 portal" : "Register for MAP65 access"}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {mode === "signup" && (
              <Field label="Organization">
                <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Organization name" />
              </Field>
            )}
            <Field label="Email">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com" onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            </Field>
            <Field label="Password">
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            </Field>

            {error && (
              <div style={{ background: "#2a0a0a", border: `1px solid ${C.danger}`, borderRadius: 6, padding: "10px 14px", fontSize: 13, color: "#e87070" }}>
                {error}
              </div>
            )}

            <Btn onClick={handleSubmit} loading={loading} size="lg"
              disabled={!email.trim() || !password.trim() || (mode === "signup" && !company.trim())}
              style={{ width: "100%", justifyContent: "center", marginTop: 4 }}>
              {mode === "login" ? "Sign In" : "Create Account"}
            </Btn>
          </div>

          <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: 13, color: C.muted }}>
            {mode === "login" ? "Need an account? " : "Already have an account? "}
            <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
              style={{ background: "none", border: "none", color: C.blue, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              {mode === "login" ? "Register" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Upload Modal ──────────────────────────────────────────────────────────────
function UploadModal({ profile, companies, onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [activity, setActivity] = useState("");
  const [comments, setComments] = useState("");
  const [companyId, setCompanyId] = useState(profile.company_id);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef();

  const procedures = specialty ? (PROCEDURES[specialty] || ["Other"]) : [];

  async function handleUpload() {
    if (!file || !name.trim()) return;
    setUploading(true); setError(""); setProgress(0);
    try {
      const fileUrl = await uploadVideoFile(file, setProgress);
      await dbPost("videos", {
        name: name.trim(),
        creation_date: date || null,
        description: description.trim() || null,
        specialty: specialty || null,
        activity: activity || null,
        comments: comments.trim() || null,
        status: "RAW",
        is_public: false,
        hidden: false,
        file_url: fileUrl,
        company_id: companyId,
        uploaded_by: getAuthUser()?.id,
      });
      onUploaded();
    } catch (e) { setError(e.message); setUploading(false); }
  }

  return (
    <Modal title="Upload Video" onClose={onClose} width={580}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

        {/* File picker */}
        <div
          onClick={() => !uploading && fileRef.current?.click()}
          style={{
            border: `2px dashed ${file ? C.brand : C.border}`, borderRadius: 8,
            padding: "1.5rem", textAlign: "center", cursor: uploading ? "default" : "pointer",
            background: file ? "#0a1830" : "transparent", transition: "all 0.2s",
          }}>
          <input ref={fileRef} type="file" accept="video/*" style={{ display: "none" }}
            onChange={e => { const f = e.target.files[0]; if (f) { setFile(f); if (!name) setName(f.name.replace(/\.[^.]+$/, "")); } }} />
          {file ? (
            <div>
              <p style={{ color: C.blue, fontWeight: 600, fontSize: 13 }}>{file.name}</p>
              <p style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
          ) : (
            <div>
              <p style={{ color: C.muted, fontSize: 13 }}>Click to select video file</p>
              <p style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>MP4, MOV, AVI supported</p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {uploading && (
          <div>
            <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: C.brand, borderRadius: 3, transition: "width 0.3s" }} />
            </div>
            <p style={{ fontSize: 12, color: C.muted, marginTop: 5, textAlign: "right" }}>{progress}%</p>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <Field label="Video Name *">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter name" disabled={uploading} />
          </Field>
          <Field label="Date of Procedure">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} disabled={uploading} />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <Field label="Specialty">
            <select value={specialty} onChange={e => { setSpecialty(e.target.value); setActivity(""); }} disabled={uploading}>
              <option value="">Select specialty</option>
              {SPECIALTIES.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Procedure">
            <select value={activity} onChange={e => setActivity(e.target.value)} disabled={uploading || !specialty}>
              <option value="">Select procedure</option>
              {procedures.map(p => <option key={p}>{p}</option>)}
            </select>
          </Field>
        </div>

        {profile.role === "ANNOTATOR" && (
          <Field label="Organization">
            <select value={companyId} onChange={e => setCompanyId(e.target.value)} disabled={uploading}>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}

        <Field label="Description">
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Brief description of the video" rows={2} disabled={uploading} style={{ resize: "vertical" }} />
        </Field>

        <Field label="Comments">
          <textarea value={comments} onChange={e => setComments(e.target.value)}
            placeholder="Any additional comments" rows={2} disabled={uploading} style={{ resize: "vertical" }} />
        </Field>

        {error && (
          <div style={{ background: "#2a0a0a", border: `1px solid ${C.danger}`, borderRadius: 6, padding: "10px 14px", fontSize: 13, color: "#e87070" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
          <Btn variant="secondary" onClick={onClose} disabled={uploading}>Cancel</Btn>
          <Btn onClick={handleUpload} loading={uploading} disabled={!file || !name.trim()}>
            {uploading ? `Uploading ${progress}%` : "Upload Video"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

// ── Video Player Modal ────────────────────────────────────────────────────────
function PlayerModal({ video, onClose }) {
  return (
    <Modal title={video.name} onClose={onClose} width={860}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <video
          src={video.file_url}
          controls
          style={{ width: "100%", borderRadius: 8, background: "#000", maxHeight: 480 }}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: 13 }}>
          {video.creation_date && <div><span style={{ color: C.muted }}>Date: </span>{video.creation_date}</div>}
          {video.specialty && <div><span style={{ color: C.muted }}>Specialty: </span>{video.specialty}</div>}
          {video.activity && <div><span style={{ color: C.muted }}>Procedure: </span>{video.activity}</div>}
          <div><span style={{ color: C.muted }}>Status: </span><Badge status={video.status} /></div>
        </div>
        {video.description && <p style={{ fontSize: 13, color: C.pale, lineHeight: 1.6 }}>{video.description}</p>}
        {video.comments && <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, borderTop: `1px solid ${C.border}`, paddingTop: "0.75rem" }}>{video.comments}</p>}
      </div>
    </Modal>
  );
}

// ── Share Modal ───────────────────────────────────────────────────────────────
function ShareModal({ video, companies, profile, onClose, onRefresh }) {
  const [isPublic, setIsPublic] = useState(video.is_public);
  const [accessList, setAccessList] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dbGet(`video_access?video_id=eq.${video.id}`).then(rows => {
      setAccessList(rows || []);
      setLoading(false);
    });
  }, [video.id]);

  async function togglePublic() {
    setSaving(true);
    await dbPatch(`videos?id=eq.${video.id}`, { is_public: !isPublic });
    setIsPublic(v => !v);
    setSaving(false);
    onRefresh();
  }

  async function grantAccess() {
    if (!selectedCompany) return;
    setSaving(true);
    try {
      await dbPost("video_access", { video_id: video.id, company_id: selectedCompany, granted_by: getAuthUser()?.id });
      const rows = await dbGet(`video_access?video_id=eq.${video.id}`);
      setAccessList(rows || []);
      setSelectedCompany("");
    } catch {}
    setSaving(false);
  }

  async function revokeAccess(id) {
    setSaving(true);
    await dbDelete(`video_access?id=eq.${id}`);
    setAccessList(al => al.filter(a => a.id !== id));
    setSaving(false);
    onRefresh();
  }

  const grantedIds = new Set(accessList.map(a => a.company_id));
  const available = companies.filter(c => c.id !== profile.company_id && !grantedIds.has(c.id));

  return (
    <Modal title="Share Video" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem", background: C.bg, borderRadius: 8 }}>
          <div>
            <p style={{ fontWeight: 600, fontSize: 13 }}>Public Access</p>
            <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Anyone with the link can view</p>
          </div>
          <button onClick={togglePublic} disabled={saving} style={{
            width: 44, height: 24, borderRadius: 12,
            background: isPublic ? C.brand : C.border, border: "none", cursor: "pointer",
            transition: "background 0.2s", position: "relative",
          }}>
            <span style={{
              position: "absolute", top: 3, left: isPublic ? 23 : 3,
              width: 18, height: 18, borderRadius: 9, background: "#fff",
              transition: "left 0.2s",
            }} />
          </button>
        </div>

        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: C.muted, fontFamily: "'Rajdhani', sans-serif", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.75rem" }}>
            Organization Access
          </p>
          {loading ? <Spinner /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {accessList.map(a => {
                const co = companies.find(c => c.id === a.company_id);
                return (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: C.bg, borderRadius: 6 }}>
                    <span style={{ fontSize: 13 }}>{co?.name || a.company_id}</span>
                    <Btn size="sm" variant="danger" onClick={() => revokeAccess(a.id)} disabled={saving}>Revoke</Btn>
                  </div>
                );
              })}
              {available.length > 0 && (
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)} style={{ flex: 1 }}>
                    <option value="">Select organization…</option>
                    {available.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <Btn onClick={grantAccess} disabled={!selectedCompany || saving} loading={saving} size="md">Grant</Btn>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── Video Table ───────────────────────────────────────────────────────────────
function VideoTable({ videos, profile, companies, onRefresh, setToast }) {
  const [playerVideo, setPlayerVideo] = useState(null);
  const [shareVideo, setShareVideo] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState({});

  const canUpload = profile.role === "EDITOR" || profile.role === "ANNOTATOR";
  const isAnnotator = profile.role === "ANNOTATOR";

  function setBusyId(id, val) { setBusy(b => ({ ...b, [id]: val })); }

  async function updateStatus(video, status) {
    setBusyId(video.id, true);
    await dbPatch(`videos?id=eq.${video.id}`, { status });
    onRefresh();
    setBusyId(video.id, false);
    setToast({ message: `Status updated to ${STATUS_LABEL[status]}`, type: "success" });
  }

  async function removeVideo(video) {
    setBusyId(video.id, true);
    await dbPatch(`videos?id=eq.${video.id}`, { hidden: true });
    onRefresh();
    setToast({ message: "Video removed from list", type: "info" });
  }

  async function deleteVideo(video) {
    setBusyId(video.id, true);
    setConfirmDelete(null);
    // Delete storage file
    const path = video.file_url?.split("/storage/v1/object/public/videos/")?.[1];
    if (path) {
      await fetch(`${SUPA_URL}/storage/v1/object/videos/${path}`, {
        method: "DELETE",
        headers: { apikey: SUPA_KEY, Authorization: `Bearer ${getToken()}` },
      }).catch(() => {});
    }
    await dbDelete(`videos?id=eq.${video.id}`);
    onRefresh();
    setToast({ message: "Video deleted permanently", type: "info" });
  }

  function canActOnVideo(video) {
    return isAnnotator || video.company_id === profile.company_id;
  }

  if (videos.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "4rem 2rem", color: C.muted }}>
        <p style={{ fontSize: 32, marginBottom: "1rem" }}>📹</p>
        <p style={{ fontSize: 15, fontFamily: "'Rajdhani', sans-serif" }}>No videos found</p>
        <p style={{ fontSize: 13, marginTop: 6 }}>
          {canUpload ? "Upload a video to get started" : "No videos available for your account"}
        </p>
      </div>
    );
  }

  return (
    <>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr style={{ borderBottom: `1.5px solid ${C.border}` }}>
              {["Name", "Specialty", "Procedure", "Date", "Status", "Actions"].map(h => (
                <th key={h} style={{
                  padding: "10px 14px", textAlign: "left", fontSize: 11,
                  fontFamily: "'Rajdhani', sans-serif", fontWeight: 700,
                  color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em",
                  whiteSpace: "nowrap",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {videos.map((v, i) => (
              <tr key={v.id} style={{
                borderBottom: `1px solid ${C.border}`,
                background: i % 2 === 0 ? "transparent" : C.surface2,
                transition: "background 0.15s",
              }}>
                <td style={{ padding: "10px 14px", maxWidth: 220 }}>
                  <p style={{ fontWeight: 600, fontSize: 13, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name}</p>
                  {v.is_public && <span style={{ fontSize: 10, color: C.blue }}>◆ Public</span>}
                </td>
                <td style={{ padding: "10px 14px", fontSize: 13, color: C.pale, whiteSpace: "nowrap" }}>{v.specialty || "—"}</td>
                <td style={{ padding: "10px 14px", fontSize: 13, color: C.muted, whiteSpace: "nowrap", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{v.activity || "—"}</td>
                <td style={{ padding: "10px 14px", fontSize: 12, color: C.muted, whiteSpace: "nowrap" }}>{v.creation_date || "—"}</td>
                <td style={{ padding: "10px 14px" }}><Badge status={v.status} /></td>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {/* View */}
                    <Btn size="sm" variant="ghost" onClick={() => setPlayerVideo(v)} title="Play video">▶</Btn>

                    {/* Submit (Native → Annotation in Process) */}
                    {canUpload && canActOnVideo(v) && v.status === "RAW" && (
                      <Btn size="sm" variant="secondary" loading={busy[v.id]}
                        onClick={() => updateStatus(v, "IN_PROCESSING")}>Submit</Btn>
                    )}

                    {/* Annotate (Annotation in Process → Complete) */}
                    {isAnnotator && v.status === "IN_PROCESSING" && (
                      <Btn size="sm" variant="success" loading={busy[v.id]}
                        onClick={() => updateStatus(v, "ANNOTATED")}>Annotate</Btn>
                    )}

                    {/* Download */}
                    {canUpload && (
                      <a href={v.file_url} download target="_blank" rel="noreferrer"
                        style={{ textDecoration: "none" }}>
                        <Btn size="sm" variant="secondary" title="Download">⬇</Btn>
                      </a>
                    )}

                    {/* Share */}
                    {canUpload && canActOnVideo(v) && (
                      <Btn size="sm" variant="secondary" onClick={() => setShareVideo(v)} title="Share">⤴</Btn>
                    )}

                    {/* Remove (soft hide) */}
                    <Btn size="sm" variant="secondary" onClick={() => removeVideo(v)} title="Remove from list">✕</Btn>

                    {/* Delete (permanent) */}
                    {canUpload && canActOnVideo(v) && (
                      <Btn size="sm" variant="danger" onClick={() => setConfirmDelete(v)} title="Delete permanently">🗑</Btn>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {playerVideo && <PlayerModal video={playerVideo} onClose={() => setPlayerVideo(null)} />}

      {shareVideo && (
        <ShareModal video={shareVideo} companies={companies} profile={profile}
          onClose={() => setShareVideo(null)} onRefresh={onRefresh} />
      )}

      {confirmDelete && (
        <Modal title="Delete Video?" onClose={() => setConfirmDelete(null)} width={400}>
          <p style={{ fontSize: 14, color: C.pale, marginBottom: "1.5rem", lineHeight: 1.6 }}>
            Permanently delete <strong>{confirmDelete.name}</strong>? This cannot be undone.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Btn variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={() => deleteVideo(confirmDelete)}>Delete Permanently</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}

// ── Videos Tab ────────────────────────────────────────────────────────────────
function VideosTab({ profile, companies, setToast }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSpecialty, setFilterSpecialty] = useState("all");

  const loadVideos = useCallback(async () => {
    setLoading(true);
    const rows = await getVideos(profile);
    setVideos(rows || []);
    setLoading(false);
  }, [profile]);

  useEffect(() => { loadVideos(); }, [loadVideos]);

  const filtered = videos.filter(v => {
    if (filterStatus !== "all" && v.status !== filterStatus) return false;
    if (filterSpecialty !== "all" && v.specialty !== filterSpecialty) return false;
    if (search && !v.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const canUpload = profile.role === "EDITOR" || profile.role === "ANNOTATOR";

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search videos…"
          style={{ width: 220, flex: "0 0 auto" }}
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 180 }}>
          <option value="all">All Statuses</option>
          <option value="RAW">Native</option>
          <option value="IN_PROCESSING">Annotation in Process</option>
          <option value="ANNOTATED">Annotation Complete</option>
        </select>
        <select value={filterSpecialty} onChange={e => setFilterSpecialty(e.target.value)} style={{ width: 180 }}>
          <option value="all">All Specialties</option>
          {SPECIALTIES.map(s => <option key={s}>{s}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        {canUpload && (
          <Btn onClick={() => setShowUpload(true)}>+ Upload Video</Btn>
        )}
      </div>

      {/* Table */}
      <div style={{ background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
            <Spinner size={32} />
          </div>
        ) : (
          <VideoTable
            videos={filtered}
            profile={profile}
            companies={companies}
            onRefresh={loadVideos}
            setToast={setToast}
          />
        )}
      </div>

      {/* Stats row */}
      {!loading && (
        <div style={{ display: "flex", gap: "1.5rem", marginTop: "1rem", fontSize: 12, color: C.muted }}>
          <span>{videos.length} total</span>
          <span>{videos.filter(v => v.status === "RAW").length} native</span>
          <span>{videos.filter(v => v.status === "IN_PROCESSING").length} in process</span>
          <span>{videos.filter(v => v.status === "ANNOTATED").length} complete</span>
        </div>
      )}

      {showUpload && (
        <UploadModal
          profile={profile}
          companies={companies}
          onClose={() => setShowUpload(false)}
          onUploaded={() => { setShowUpload(false); loadVideos(); setToast({ message: "Video uploaded successfully", type: "success" }); }}
        />
      )}
    </div>
  );
}

// ── Organizations Tab ─────────────────────────────────────────────────────────
function OrgsTab({ companies, onRefresh, setToast }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setSaving] = useState(false);

  async function createOrg() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await dbPost("companies", { name: newName.trim() });
      setNewName(""); setShowCreate(false);
      onRefresh();
      setToast({ message: "Organization created", type: "success" });
    } catch (e) { setToast({ message: e.message, type: "error" }); }
    setSaving(false);
  }

  async function toggleSuspend(co) {
    await dbPatch(`companies?id=eq.${co.id}`, { suspended: !co.suspended });
    onRefresh();
    setToast({ message: co.suspended ? "Organization reactivated" : "Organization suspended", type: "info" });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1.25rem" }}>
        <Btn onClick={() => setShowCreate(true)}>+ New Organization</Btn>
      </div>

      <div style={{ background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        <table>
          <thead>
            <tr style={{ borderBottom: `1.5px solid ${C.border}` }}>
              {["Organization", "Status", "Created", "Actions"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {companies.map((co, i) => (
              <tr key={co.id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? "transparent" : C.surface2 }}>
                <td style={{ padding: "10px 14px", fontWeight: 600, fontSize: 13 }}>{co.name}</td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{
                    fontSize: 11, padding: "3px 10px", borderRadius: 20,
                    background: co.suspended ? "#2a0a0a" : "#0a2a1a",
                    color: co.suspended ? C.danger : C.success,
                    border: `1px solid ${co.suspended ? "#6a1010" : "#1a6640"}`,
                    fontFamily: "'Rajdhani', sans-serif", fontWeight: 700,
                  }}>
                    {co.suspended ? "Suspended" : "Active"}
                  </span>
                </td>
                <td style={{ padding: "10px 14px", fontSize: 12, color: C.muted }}>
                  {co.created_at ? new Date(co.created_at).toLocaleDateString() : "—"}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <Btn size="sm" variant={co.suspended ? "success" : "secondary"} onClick={() => toggleSuspend(co)}>
                    {co.suspended ? "Reactivate" : "Suspend"}
                  </Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="New Organization" onClose={() => setShowCreate(false)} width={400}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <Field label="Organization Name">
              <input value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Enter organization name"
                onKeyDown={e => e.key === "Enter" && createOrg()} />
            </Field>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Btn variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Btn>
              <Btn onClick={createOrg} loading={creating} disabled={!newName.trim()}>Create</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [tab, setTab] = useState("videos");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const u = getAuthUser();
    setUser(u);
    setAuthReady(true);
    if (u) loadProfile(u.id);
  }, []);

  async function loadProfile(userId) {
    const p = await getProfile(userId);
    setProfile(p);
    if (p) {
      const cos = await getAllCompanies();
      setCompanies(cos);
    }
  }

  async function handleAuth() {
    const u = getAuthUser();
    setUser(u);
    if (u) await loadProfile(u.id);
  }

  async function handleSignOut() {
    await authSignOut();
    setUser(null);
    setProfile(null);
    setCompanies([]);
  }

  async function refreshCompanies() {
    const cos = await getAllCompanies();
    setCompanies(cos);
  }

  function showToast(t) { setToast(t); }

  if (!authReady) return null;
  if (!user || !profile) return <AuthScreen onAuth={handleAuth} />;

  const isAnnotator = profile.role === "ANNOTATOR";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: C.bg }}>
      <style>{css}</style>

      {/* Header */}
      <header style={{
        background: C.surface, borderBottom: `1.5px solid ${C.border}`,
        padding: "0 1.5rem", display: "flex", alignItems: "center",
        height: 56, flexShrink: 0, gap: "1rem",
      }}>
        <img src="/logo.png" alt="MAP65" style={{ height: 32 }} />
        <div style={{ width: 1, height: 28, background: C.border, margin: "0 0.5rem" }} />

        {/* Nav tabs */}
        <nav style={{ display: "flex", gap: "0.25rem", flex: 1 }}>
          {[
            { key: "videos", label: "Videos" },
            ...(isAnnotator ? [{ key: "orgs", label: "Organizations" }] : []),
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              background: tab === t.key ? C.brand : "transparent",
              color: tab === t.key ? "#fff" : C.muted,
              border: "none", borderRadius: 6, padding: "6px 14px",
              fontSize: 13, fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 600, cursor: "pointer", letterSpacing: "0.03em",
              transition: "all 0.15s",
            }}>
              {t.label}
            </button>
          ))}
        </nav>

        {/* User info */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: 12, color: C.muted }}>{user.email}</span>
          <span style={{
            fontSize: 11, padding: "3px 8px", borderRadius: 4,
            background: C.surface2, border: `1px solid ${C.border}`,
            color: C.pale, fontFamily: "'Rajdhani', sans-serif", fontWeight: 700,
          }}>{profile.role}</span>
          <Btn size="sm" variant="secondary" onClick={handleSignOut}>Sign out</Btn>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, padding: "1.5rem", maxWidth: 1280, width: "100%", margin: "0 auto", alignSelf: "stretch" }}>
        <div className="fadeIn" key={tab}>
          {tab === "videos" && (
            <VideosTab profile={profile} companies={companies} setToast={showToast} />
          )}
          {tab === "orgs" && isAnnotator && (
            <OrgsTab companies={companies} onRefresh={refreshCompanies} setToast={showToast} />
          )}
        </div>
      </main>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
