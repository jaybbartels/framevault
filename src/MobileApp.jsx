import { useState, useEffect, useRef } from "react";
import {
  supabase, supabaseAnon, authFetch, inviteUser, getToken,
  setOnSessionExpired, getUserIdFromToken, uploadFileWithProgress,
  SUPABASE_URL, SUPABASE_ANON_KEY, PUBLIC_ORG_ID, APP_VERSION,
  SPECIALTIES, PROCEDURES, VIEW_RESTRICTIONS, STATUS_LABELS, ROLES, ROLE_COLORS,
  canDo, isPublicOrg,
} from "./lib/supabase.js";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Source+Sans+3:wght@400;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  :root {
    --navy-900:#060e1e; --navy-800:#0a1628; --navy-700:#0f2040; --navy-600:#142850;
    --blue-primary:#1450a0; --blue-mid:#2860b4; --blue-light:#5090c8; --blue-pale:#78a0c8;
    --white:#ffffff; --text:#e8eef8; --text-secondary:#8aa4c8; --text-muted:#4a6480;
    --border:rgba(20,80,160,0.25); --border-bright:rgba(88,144,200,0.4);
    --surface:rgba(10,22,40,0.95); --surface2:rgba(15,32,64,0.85);
    --raw:#f0a030; --processing:#5090c8; --annotated:#38c878; --danger:#e05060; --share:#a060e0;
    --font-head:'Rajdhani',sans-serif; --font-body:'Source Sans 3',sans-serif;
    --r:10px; --r-lg:16px;
    --safe-bottom: env(safe-area-inset-bottom, 0px);
    --safe-top: env(safe-area-inset-top, 0px);
  }
  html, body { background:var(--navy-900); color:var(--text); font-family:var(--font-body); -webkit-text-size-adjust:100%; overscroll-behavior-y:none; }
  body { min-height:100vh; min-height:100dvh; font-size:15px; line-height:1.5; }
  #root { min-height:100vh; min-height:100dvh; }
  ::-webkit-scrollbar { display:none; }
  input, select, textarea, button { font-size:16px; }

  .m-app { min-height:100vh; min-height:100dvh; display:flex; flex-direction:column; position:relative; }

  .m-topbar {
    height: calc(56px + var(--safe-top));
    padding-top: var(--safe-top);
    background: rgba(6,14,30,0.97);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border-bright);
    display: flex; align-items: center; padding-left: 16px; padding-right: 16px;
    position: sticky; top: 0; z-index: 100; gap: 10px;
  }
  .m-logo { height: 26px; }
  .m-topbar-title { font-family: var(--font-head); font-size: 16px; font-weight: 700; color: var(--white); letter-spacing: 0.5px; flex: 1; }
  .m-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, var(--blue-primary), var(--blue-light)); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; font-family: var(--font-head); color: white; flex-shrink: 0; }

  .m-content { flex: 1; overflow-y: auto; padding: 16px; padding-bottom: calc(84px + var(--safe-bottom)); -webkit-overflow-scrolling: touch; }

  .m-bottomnav {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
    background: rgba(6,14,30,0.98);
    backdrop-filter: blur(20px);
    border-top: 1px solid var(--border-bright);
    display: flex; padding-bottom: var(--safe-bottom);
  }
  .m-navbtn {
    flex: 1; background: none; border: none; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    padding: 10px 4px 8px; color: var(--text-muted);
    font-family: var(--font-head); font-size: 10px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.3px;
  }
  .m-navbtn.active { color: var(--blue-light); }
  .m-navicon { font-size: 20px; line-height: 1; }

  .m-stats-row { display: flex; gap: 8px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 2px; }
  .m-stat-pill { flex: 1; min-width: 90px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: 12px; text-align: center; }
  .m-stat-num { font-family: var(--font-head); font-size: 22px; font-weight: 700; color: var(--white); line-height: 1; }
  .m-stat-lbl { font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; font-family: var(--font-head); }

  .m-searchbar { display: flex; gap: 8px; margin-bottom: 14px; }
  .m-search-input { flex: 1; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--r); color: var(--text); padding: 11px 14px; outline: none; }
  .m-filter-btn { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--r); color: var(--text-secondary); padding: 11px 14px; font-family: var(--font-head); font-size: 12px; font-weight: 600; }

  .m-video-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg);
    padding: 16px; margin-bottom: 12px; position: relative; overflow: hidden;
  }
  .m-video-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
  .m-video-name { font-family: var(--font-head); font-weight: 700; font-size: 15px; color: var(--white); line-height: 1.3; }
  .m-video-meta { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
  .m-video-desc { font-size: 12px; color: var(--text-secondary); margin-bottom: 10px; line-height: 1.5; }
  .m-video-actions { display: flex; gap: 8px; overflow-x: auto; padding-top: 8px; border-top: 1px solid var(--border); margin-top: 4px; }

  .m-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; padding: 3px 9px; border-radius: 20px; font-family: var(--font-head); white-space: nowrap; }
  .m-dot { width: 5px; height: 5px; border-radius: 50%; }
  .m-tag-RAW { background: rgba(240,160,48,0.15); color: var(--raw); } .m-tag-RAW .m-dot { background: var(--raw); }
  .m-tag-IN_PROCESSING { background: rgba(80,144,200,0.15); color: var(--processing); } .m-tag-IN_PROCESSING .m-dot { background: var(--processing); }
  .m-tag-ANNOTATED { background: rgba(56,200,120,0.15); color: var(--annotated); } .m-tag-ANNOTATED .m-dot { background: var(--annotated); }
  .m-tag-public { background: rgba(56,200,120,0.12); color: var(--annotated); }
  .m-tag-meta { background: var(--surface2); color: var(--text-secondary); }

  .m-action-btn {
    flex-shrink: 0; display: flex; align-items: center; gap: 5px;
    background: var(--surface2); border: 1px solid var(--border); border-radius: 20px;
    padding: 8px 14px; font-family: var(--font-head); font-size: 11px; font-weight: 700;
    color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.3px; white-space: nowrap;
  }
  .m-action-primary { background: var(--blue-primary); border-color: var(--blue-primary); color: white; }
  .m-action-danger { background: rgba(224,80,96,0.12); border-color: rgba(224,80,96,0.3); color: var(--danger); }

  .m-fab {
    position: fixed; right: 18px; bottom: calc(84px + var(--safe-bottom));
    width: 56px; height: 56px; border-radius: 50%;
    background: linear-gradient(135deg, var(--blue-primary), var(--blue-light));
    border: none; color: white; font-size: 26px; font-weight: 300;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 6px 20px rgba(20,80,160,0.5); z-index: 90;
  }

  .m-sheet-overlay { position: fixed; inset: 0; background: rgba(2,6,16,0.7); backdrop-filter: blur(4px); z-index: 300; display: flex; align-items: flex-end; }
  .m-sheet {
    background: var(--navy-800); border-top: 1px solid var(--border-bright);
    border-radius: 20px 20px 0 0; width: 100%; max-height: 90vh; max-height: 90dvh;
    overflow-y: auto; padding: 20px 20px calc(28px + var(--safe-bottom));
    animation: m-sheet-up .25s ease;
  }
  @keyframes m-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .m-sheet-handle { width: 36px; height: 4px; background: var(--border-bright); border-radius: 2px; margin: 0 auto 16px; }
  .m-sheet-title { font-family: var(--font-head); font-size: 19px; font-weight: 700; color: var(--white); margin-bottom: 4px; }
  .m-sheet-sub { font-size: 12px; color: var(--text-muted); margin-bottom: 18px; }

  .m-fullscreen { position: fixed; inset: 0; background: var(--navy-900); z-index: 350; display: flex; flex-direction: column; }
  .m-fs-header { display: flex; align-items: center; gap: 12px; padding: calc(14px + var(--safe-top)) 16px 14px; border-bottom: 1px solid var(--border); background: var(--navy-800); }
  .m-fs-close { background: none; border: none; color: var(--text-secondary); font-size: 22px; padding: 4px; }
  .m-fs-title { font-family: var(--font-head); font-size: 16px; font-weight: 700; color: var(--white); flex: 1; }
  .m-fs-body { flex: 1; overflow-y: auto; padding: 18px; padding-bottom: calc(24px + var(--safe-bottom)); -webkit-overflow-scrolling: touch; }

  .m-field { margin-bottom: 16px; }
  .m-field label { display: block; font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; font-weight: 600; font-family: var(--font-head); margin-bottom: 6px; }
  .m-field input, .m-field select, .m-field textarea {
    width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--r);
    color: var(--text); padding: 13px 14px; outline: none; font-family: var(--font-body);
  }
  .m-field textarea { resize: vertical; min-height: 80px; }
  .m-field select option { background: var(--navy-700); }

  .m-btn {
    width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
    background: linear-gradient(135deg, var(--blue-primary), var(--blue-mid)); color: white;
    border: none; border-radius: var(--r); padding: 15px; font-family: var(--font-head);
    font-size: 15px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;
  }
  .m-btn:disabled { opacity: 0.5; }
  .m-btn-ghost { background: var(--surface2); border: 1px solid var(--border); color: var(--text-secondary); }
  .m-btn-danger { background: rgba(224,80,96,0.15); border: 1px solid rgba(224,80,96,0.4); color: var(--danger); }
  .m-btn-row { display: flex; gap: 10px; }
  .m-btn-row .m-btn { width: auto; flex: 1; }

  .m-auth { min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; padding-top: calc(24px + var(--safe-top)); }
  .m-auth-logo { width: 160px; margin-bottom: 24px; }
  .m-auth-title { font-family: var(--font-head); font-size: 24px; font-weight: 700; color: var(--white); margin-bottom: 6px; text-align: center; }
  .m-auth-sub { font-size: 13px; color: var(--text-secondary); margin-bottom: 28px; text-align: center; }
  .m-auth-card { width: 100%; max-width: 380px; }
  .m-auth-link { background: none; border: none; color: var(--blue-light); font-family: var(--font-head); font-weight: 600; font-size: 13px; }
  .m-auth-divider { height: 1px; background: var(--border); margin: 18px 0; }

  .m-info { background: rgba(20,80,160,0.1); border: 1px solid var(--border-bright); border-radius: var(--r); padding: 12px 14px; font-size: 12px; color: var(--text-secondary); margin-bottom: 16px; line-height: 1.6; }
  .m-warning { background: rgba(224,80,96,0.1); border: 1px solid rgba(224,80,96,0.3); border-radius: var(--r); padding: 12px 14px; font-size: 12px; color: var(--danger); margin-top: 12px; }

  .m-toast-wrap { position: fixed; top: calc(64px + var(--safe-top)); left: 16px; right: 16px; z-index: 999; display: flex; flex-direction: column; gap: 8px; }
  .m-toast { background: var(--navy-700); border: 1px solid var(--border-bright); border-radius: var(--r); padding: 12px 16px; font-size: 13px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); animation: m-toast-in .2s ease; }
  @keyframes m-toast-in { from { opacity:0; transform: translateY(-10px); } to { opacity:1; transform: translateY(0); } }
  .m-toast.success { border-color: var(--annotated); } .m-toast.error { border-color: var(--danger); } .m-toast.info { border-color: var(--blue-light); }

  .m-empty { text-align: center; padding: 60px 20px; color: var(--text-muted); }
  .m-empty-icon { font-size: 44px; margin-bottom: 14px; opacity: 0.6; }
  .m-empty h3 { font-family: var(--font-head); font-size: 17px; color: var(--text-secondary); margin-bottom: 6px; }
  .m-empty p { font-size: 13px; }

  .m-spinner { width: 22px; height: 22px; border: 2.5px solid var(--border); border-top-color: var(--blue-light); border-radius: 50%; animation: m-spin .7s linear infinite; }
  @keyframes m-spin { to { transform: rotate(360deg); } }
  .m-loading-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; min-height: 100dvh; gap: 20px; }

  .m-progress-track { width: 100%; height: 8px; background: var(--navy-700); border-radius: 4px; overflow: hidden; border: 1px solid var(--border); margin-top: 10px; }
  .m-progress-bar { height: 100%; background: linear-gradient(90deg, var(--blue-primary), var(--blue-light)); transition: width .3s; }

  .m-user-row { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: 14px; margin-bottom: 10px; }
  .m-user-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 8px; }
  .m-user-email { font-size: 13px; color: var(--text); font-weight: 600; }
  .m-user-sub { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

  .m-org-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 16px; margin-bottom: 12px; }
  .m-org-name { font-family: var(--font-head); font-weight: 700; font-size: 15px; color: var(--white); margin-bottom: 4px; }
  .m-org-meta { font-size: 11px; color: var(--text-muted); font-family: monospace; margin-bottom: 12px; }

  .m-link-box { background: var(--navy-700); border: 1px solid var(--border-bright); border-radius: var(--r); padding: 14px; font-family: monospace; font-size: 12px; color: var(--blue-light); word-break: break-all; margin: 12px 0; }

  .m-segment { display: flex; background: var(--surface2); border-radius: var(--r); padding: 4px; margin-bottom: 18px; }
  .m-segment button { flex: 1; background: none; border: none; padding: 9px; font-family: var(--font-head); font-size: 12px; font-weight: 600; color: var(--text-muted); border-radius: 8px; text-transform: uppercase; letter-spacing: 0.3px; }
  .m-segment button.active { background: var(--blue-primary); color: white; }

  .m-toggle-row { display: flex; align-items: center; justify-content: space-between; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--r); padding: 14px; margin-bottom: 14px; }
  .m-toggle { position: relative; width: 46px; height: 26px; flex-shrink: 0; }
  .m-toggle-track { position: absolute; inset: 0; background: var(--navy-600); border-radius: 13px; border: 1px solid var(--border); }
  .m-toggle-track.on { background: var(--blue-primary); border-color: var(--blue-light); }
  .m-toggle-thumb { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; background: white; border-radius: 50%; transition: transform .2s; }
  .m-toggle-thumb.on { transform: translateX(20px); }

  .m-footer { text-align: center; padding: 20px 16px 8px; font-size: 10px; color: var(--text-muted); font-family: var(--font-head); }
  .m-footer a { color: var(--text-muted); text-decoration: none; }
`;

let toastId = 0;

function Spinner() { return <div className="m-spinner" />; }

function MToast({ toasts, remove }) {
  const icons = { success:"✓", error:"✕", info:"ℹ" };
  return (
    <div className="m-toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`m-toast ${t.type}`} onClick={() => remove(t.id)}>
          {icons[t.type]} {t.msg}
        </div>
      ))}
    </div>
  );
}

function StatusTag({ status }) {
  return <span className={`m-tag m-tag-${status}`}><span className="m-dot" />{STATUS_LABELS[status] || status}</span>;
}

function RoleTag({ role }) {
  const c = ROLE_COLORS[role] || ROLE_COLORS.VIEWER;
  return <span className="m-tag" style={{ background:c.bg, color:c.color }}>{role}</span>;
}

function MToggle({ on, onToggle }) {
  return (
    <div className="m-toggle" onClick={onToggle}>
      <div className={`m-toggle-track ${on ? "on" : ""}`}><div className={`m-toggle-thumb ${on ? "on" : ""}`} /></div>
    </div>
  );
}

function Sheet({ title, sub, onClose, children }) {
  return (
    <div className="m-sheet-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="m-sheet">
        <div className="m-sheet-handle" />
        {title && <div className="m-sheet-title">{title}</div>}
        {sub && <div className="m-sheet-sub">{sub}</div>}
        {children}
      </div>
    </div>
  );
}

function FullScreen({ title, onClose, children, rightAction }) {
  return (
    <div className="m-fullscreen">
      <div className="m-fs-header">
        <button className="m-fs-close" onClick={onClose}>✕</button>
        <div className="m-fs-title">{title}</div>
        {rightAction}
      </div>
      <div className="m-fs-body">{children}</div>
    </div>
  );
}

function MAuthScreen({ onLogin, addToast }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("login");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [inviteToken, setInviteToken] = useState(null);
  const [inviteName, setInviteName] = useState("");

  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    if (hash.includes("access_token") && hash.includes("type=invite")) {
      const params = new URLSearchParams(hash.replace("#",""));
      const token = params.get("access_token");
      if (token) { setInviteToken(token); setMode("accept"); return; }
    }
    if (hash.includes("access_token") && hash.includes("type=recovery")) {
      const params = new URLSearchParams(hash.replace("#",""));
      const token = params.get("access_token");
      if (token) { setInviteToken(token); setMode("reset"); return; }
    }
    if (hash.includes("error=") || search.includes("error=")) {
      setMode("login");
    }
  }, []);

  async function handleSubmit() {
    if (["login","register","forgot"].includes(mode) && !email) { addToast("Please enter your email","error"); return; }
    if (["login","register","accept","reset"].includes(mode) && !password) { addToast("Please enter a password","error"); return; }
    if (["register","accept"].includes(mode) && !termsAccepted) { addToast("Please accept the Terms of Service","error"); return; }
    setLoading(true);
    try {
      if (mode === "login") {
        const data = await authFetch("token?grant_type=password", { email, password });
        localStorage.setItem("sb_token", data.access_token);
        if (data.refresh_token) localStorage.setItem("sb_refresh_token", data.refresh_token);
        const myUserId = getUserIdFromToken(data.access_token);
        const profiles = await supabase(`profiles?id=eq.${myUserId}&select=*,companies(*)`);
        if (!profiles.length) throw new Error("Profile not found");
        onLogin({ ...profiles[0], token:data.access_token });
      } else if (mode === "register") {
        await authFetch("signup", { email, password });
        setMode("confirm");
      } else if (mode === "accept") {
        localStorage.setItem("sb_token", inviteToken);
        const myUserId = getUserIdFromToken(inviteToken);
        await authFetch("user", { password }, "PUT");
        if (inviteName.trim()) {
          await supabase(`profiles?id=eq.${myUserId}`, { method:"PATCH", body:JSON.stringify({ name:inviteName.trim() }) });
        }
        const profiles = await supabase(`profiles?id=eq.${myUserId}&select=*,companies(*)`);
        if (!profiles.length) throw new Error("Profile not found");
        window.location.hash = "";
        onLogin({ ...profiles[0], token:inviteToken });
      } else if (mode === "forgot") {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
          method: "POST",
          headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ email, redirect_to: window.location.origin + "/mobile" }),
        });
        if (!res.ok) { const data = await res.json(); throw new Error(data.error_description || data.msg || "Failed"); }
        setMode("confirm_reset");
      } else if (mode === "reset") {
        localStorage.setItem("sb_token", inviteToken);
        await authFetch("user", { password }, "PUT");
        localStorage.removeItem("sb_token");
        window.location.hash = "";
        addToast("Password updated! Please sign in.", "success");
        setMode("login");
      }
    } catch(e) { addToast(e.message, "error"); }
    finally { setLoading(false); }
  }

  if (mode === "confirm" || mode === "confirm_reset") {
    return (
      <div className="m-auth">
        <img src="/logo.png" alt="MAP65" className="m-auth-logo" />
        <div className="m-auth-title">Check Your Email</div>
        <p className="m-auth-sub">We sent {mode === "confirm" ? "a confirmation" : "a password reset"} link to<br /><strong style={{ color:"var(--blue-light)" }}>{email}</strong></p>
        <div className="m-auth-card">
          <button className="m-btn m-btn-ghost" onClick={() => setMode("login")}>Back to Sign In</button>
        </div>
      </div>
    );
  }

  const titles = { login:"Sign In", register:"Create Account", accept:"Activate Account", forgot:"Reset Password", reset:"New Password" };

  return (
    <div className="m-auth">
      <img src="/logo.png" alt="MAP65" className="m-auth-logo" />
      <div className="m-auth-title">{titles[mode]}</div>
      <p className="m-auth-sub">MAP65 Surgical Video Platform</p>
      <div className="m-auth-card">
        {mode === "accept" && (
          <div className="m-field"><label>Your Name (optional)</label>
            <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Dr. Jane Smith" />
          </div>
        )}
        {mode !== "accept" && (
          <div className="m-field"><label>Email</label>
            <input type="email" inputMode="email" autoCapitalize="none" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@organization.com" />
          </div>
        )}
        {mode !== "forgot" && (
          <div className="m-field"><label>{mode === "accept" || mode === "reset" ? "New Password" : "Password"}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>
        )}
        {(mode === "register" || mode === "accept") && (
          <label style={{ display:"flex", gap:8, fontSize:11, color:"var(--text-muted)", marginBottom:18, lineHeight:1.5 }}>
            <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} style={{ marginTop:2 }} />
            <span>I agree to the MAP65 <a href="/terms.html" target="_blank" style={{ color:"var(--blue-light)" }}>Terms of Service</a></span>
          </label>
        )}
        <button className="m-btn" onClick={handleSubmit} disabled={loading}>
          {loading ? <Spinner /> : mode === "login" ? "Sign In" : mode === "register" ? "Create Account" : mode === "forgot" ? "Send Reset Link" : mode === "reset" ? "Set Password" : "Activate"}
        </button>
        {mode === "login" && (
          <>
            <div className="m-auth-divider" />
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <button className="m-auth-link" onClick={() => setMode("register")}>Register</button>
              <button className="m-auth-link" style={{ color:"var(--text-muted)" }} onClick={() => setMode("forgot")}>Forgot password?</button>
            </div>
          </>
        )}
        {mode === "register" && (
          <>
            <div className="m-auth-divider" />
            <button className="m-auth-link" onClick={() => setMode("login")}>← Back to Sign In</button>
          </>
        )}
        {mode === "forgot" && (
          <>
            <div className="m-auth-divider" />
            <button className="m-auth-link" onClick={() => setMode("login")}>← Back to Sign In</button>
          </>
        )}
      </div>
    </div>
  );
}

function MUploadSheet({ user, companies, activeCompanyId, onClose, onSave, addToast }) {
  const [form, setForm] = useState({
    name:"", creation_date:new Date().toISOString().slice(0,10),
    description:"", specialty:SPECIALTIES[0], activity:PROCEDURES[SPECIALTIES[0]][0],
    comments:"", view_restriction:"none",
    company_id:activeCompanyId || user.company_id || companies[0]?.id, file:null,
  });
  const [uploading, setUploading] = useState(false);
  const [percent, setPercent] = useState(0);
  const fileRef = useRef();

  function set(k,v) { setForm(f => ({ ...f, [k]:v })); }
  function setSpecialty(s) { setForm(f => ({ ...f, specialty:s, activity:PROCEDURES[s][0] })); }

  async function handleSave() {
    if (!form.name || !form.creation_date) { addToast("Name and date required","error"); return; }
    setUploading(true); setPercent(0);
    try {
      let file_url = null;
      if (form.file) {
        const ext = form.file.name.split(".").pop();
        const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        await uploadFileWithProgress(`${SUPABASE_URL}/storage/v1/object/videos/${path}`, form.file, await getToken(), SUPABASE_ANON_KEY, setPercent);
        file_url = `${SUPABASE_URL}/storage/v1/object/public/videos/${path}`;
      }
      const [video] = await supabase("videos", { method:"POST", body:JSON.stringify({
        name:form.name, creation_date:form.creation_date, description:form.description,
        specialty:form.specialty, activity:form.activity, comments:form.comments,
        view_restriction:form.view_restriction, company_id:form.company_id,
        status:"RAW", file_url, uploaded_by:user.id,
      })});
      addToast("Video uploaded","success");
      onSave(video); onClose();
    } catch(e) { addToast(e.message,"error"); setUploading(false); }
  }

  const procedures = PROCEDURES[form.specialty] || ["Other"];

  return (
    <FullScreen title="Upload Video" onClose={() => !uploading && onClose()}>
      {!uploading ? (
        <>
          <div className="m-field"><label>Video Name *</label><input value={form.name} onChange={e => set("name",e.target.value)} placeholder="e.g. RUL Lobectomy — Case 42" /></div>
          <div className="m-field"><label>Creation Date *</label><input type="date" value={form.creation_date} onChange={e => set("creation_date",e.target.value)} /></div>
          <div className="m-field"><label>Specialty</label>
            <select value={form.specialty} onChange={e => setSpecialty(e.target.value)}>{SPECIALTIES.map(s => <option key={s}>{s}</option>)}</select>
          </div>
          <div className="m-field"><label>Procedure</label>
            <select value={form.activity} onChange={e => set("activity",e.target.value)}>{procedures.map(p => <option key={p}>{p}</option>)}</select>
          </div>
          <div className="m-field"><label>Description</label><textarea value={form.description} onChange={e => set("description",e.target.value)} placeholder="Describe what is shown…" /></div>
          <div className="m-field"><label>Comments</label><textarea value={form.comments} onChange={e => set("comments",e.target.value)} placeholder="Variant anatomy, complications, teaching notes…" /></div>
          <div className="m-field"><label>View Restriction</label>
            <select value={form.view_restriction} onChange={e => set("view_restriction",e.target.value)}>{VIEW_RESTRICTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
          </div>
          {user.role === "ANNOTATOR" && (
            <div className="m-field"><label>Organization</label>
              <select value={form.company_id} onChange={e => set("company_id",e.target.value)}>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>
          )}
          <div className="m-field"><label>Video File (up to 5GB)</label>
            <input ref={fileRef} type="file" accept="video/*" onChange={e => set("file",e.target.files[0])} style={{ background:"none", border:"none", padding:"10px 0" }} />
          </div>
          <button className="m-btn" onClick={handleSave} style={{ marginTop:8 }}>Upload Video</button>
        </>
      ) : (
        <div style={{ paddingTop:40 }}>
          <div style={{ textAlign:"center", marginBottom:16, fontFamily:"var(--font-head)", fontWeight:700 }}>
            {percent === 0 ? "Starting…" : percent === 100 ? "Processing…" : `${percent}%`}
          </div>
          <div className="m-progress-track"><div className="m-progress-bar" style={{ width:`${percent}%` }} /></div>
          <p style={{ textAlign:"center", fontSize:12, color:"var(--text-muted)", marginTop:14 }}>Keep this window open — large files may take several minutes</p>
        </div>
      )}
    </FullScreen>
  );
}

function MVideoDetail({ video, user, onClose, onStatusChange, addToast }) {
  const [loading, setLoading] = useState(false);
  const [hasViewed, setHasViewed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => { checkView(); }, []);

  async function checkView() {
    try {
      if (video.view_restriction === "none") { setChecking(false); return; }
      const views = await supabase(`video_views?video_id=eq.${video.id}&viewer_id=eq.${user.id}&select=id`);
      setHasViewed(views.length > 0);
    } catch(e) {} finally { setChecking(false); }
  }

  async function recordView() {
    try {
      await supabase("video_views", { method:"POST", body:JSON.stringify({
        video_id: video.id, viewer_id: user.id, viewer_email: user.email,
        viewer_org_id: user.company_id, is_external: false, email_verified: true,
      })});
    } catch(e) {}
  }

  async function submitForAnnotation() {
    setLoading(true);
    try {
      await supabase(`videos?id=eq.${video.id}`, { method:"PATCH", body:JSON.stringify({ status:"IN_PROCESSING" }) });
      addToast("Submitted for annotation","success");
      onStatusChange(video.id,"IN_PROCESSING"); onClose();
    } catch(e) { addToast(e.message,"error"); } finally { setLoading(false); }
  }

  async function markAnnotated() {
    setLoading(true);
    try {
      await supabase(`videos?id=eq.${video.id}`, { method:"PATCH", body:JSON.stringify({ status:"ANNOTATED" }) });
      addToast("Annotation complete","success");
      onStatusChange(video.id,"ANNOTATED"); onClose();
    } catch(e) { addToast(e.message,"error"); } finally { setLoading(false); }
  }

  return (
    <FullScreen title={video.name} onClose={onClose}>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
        <StatusTag status={video.status} />
        {video.is_public && <span className="m-tag m-tag-public">🌐 Public</span>}
        {video.view_restriction !== "none" && <span className="m-tag m-tag-meta">👁 One View</span>}
      </div>

      {checking ? (
        <div style={{ display:"flex", justifyContent:"center", padding:40 }}><Spinner /></div>
      ) : hasViewed ? (
        <div className="m-info" style={{ textAlign:"center", padding:20 }}>👁 You have already viewed this video.</div>
      ) : video.file_url ? (
        <video style={{ width:"100%", borderRadius:"var(--r)", background:"#000", marginBottom:18 }} controls playsInline src={video.file_url} onPlay={recordView} />
      ) : null}

      <div style={{ display:"grid", gridTemplateColumns:"100px 1fr", gap:"10px 12px", fontSize:13, marginBottom:20 }}>
        <span style={{ color:"var(--text-muted)" }}>Org</span><span>{video.companies?.name || "—"}</span>
        <span style={{ color:"var(--text-muted)" }}>Date</span><span>{video.creation_date}</span>
        <span style={{ color:"var(--text-muted)" }}>Specialty</span><span>{video.specialty || "—"}</span>
        <span style={{ color:"var(--text-muted)" }}>Procedure</span><span>{video.activity || "—"}</span>
        <span style={{ color:"var(--text-muted)" }}>Description</span><span>{video.description || "—"}</span>
        <span style={{ color:"var(--text-muted)" }}>Comments</span><span>{video.comments || "—"}</span>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {video.status === "RAW" && canDo(user.role,"upload") && video.company_id === user.company_id && (
          <button className="m-btn" onClick={submitForAnnotation} disabled={loading}>{loading ? <Spinner/> : "Submit for Annotation"}</button>
        )}
        {video.status === "IN_PROCESSING" && canDo(user.role,"annotate") && (
          <button className="m-btn" style={{ background:"var(--annotated)" }} onClick={markAnnotated} disabled={loading}>{loading ? <Spinner/> : "Mark Annotation Complete"}</button>
        )}
        {canDo(user.role,"download") && video.file_url && (
          <a className="m-btn m-btn-ghost" href={video.file_url} download style={{ textDecoration:"none" }}>⬇ Download</a>
        )}
        {canDo(user.role,"share") && video.company_id === user.company_id && (
          <button className="m-btn m-btn-ghost" onClick={() => setShowShare(true)}>⤴ Share / One-Time Link</button>
        )}
      </div>

      {showShare && <MShareSheet video={video} user={user} onClose={() => setShowShare(false)} addToast={addToast} />}
    </FullScreen>
  );
}

function MShareSheet({ video, user, onClose, addToast }) {
  const [tab, setTab] = useState("link");
  const [isPublic, setIsPublic] = useState(video.is_public || false);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkDays, setLinkDays] = useState(7);
  const [creating, setCreating] = useState(false);
  const [newLink, setNewLink] = useState(null);
  const [copied, setCopied] = useState(false);

  async function togglePublic() {
    const v = !isPublic;
    setIsPublic(v);
    try {
      await supabase(`videos?id=eq.${video.id}`, { method:"PATCH", body:JSON.stringify({ is_public:v }) });
      addToast(v ? "Video is now public" : "Video set to private","success");
    } catch(e) { addToast(e.message,"error"); setIsPublic(!v); }
  }

  async function createLink() {
    if (!linkEmail.trim()) { addToast("Enter recipient email","error"); return; }
    setCreating(true);
    try {
      const expiresAt = new Date(Date.now() + linkDays * 86400000).toISOString();
      const [link] = await supabase("video_links", { method:"POST", body:JSON.stringify({
        video_id: video.id, sent_to_email: linkEmail.trim(), created_by: user.id, expires_at: expiresAt,
      })});
      setNewLink(`${window.location.origin}/?view=${link.token}`);
      setLinkEmail("");
      addToast("Link created","success");
    } catch(e) { addToast(e.message,"error"); } finally { setCreating(false); }
  }

  return (
    <Sheet title="Share Video" sub={video.name} onClose={onClose}>
      <div className="m-segment">
        <button className={tab === "link" ? "active" : ""} onClick={() => setTab("link")}>🔗 Link</button>
        <button className={tab === "public" ? "active" : ""} onClick={() => setTab("public")}>🌐 Public</button>
      </div>
      {tab === "link" && (
        <>
          <div className="m-field"><label>Recipient Email</label><input value={linkEmail} onChange={e => setLinkEmail(e.target.value)} placeholder="recipient@hospital.com" /></div>
          <div className="m-field"><label>Expires After (days)</label><input type="number" value={linkDays} onChange={e => setLinkDays(parseInt(e.target.value)||7)} /></div>
          <button className="m-btn" onClick={createLink} disabled={creating}>{creating ? <Spinner/> : "Generate Link"}</button>
          {newLink && (
            <>
              <div className="m-link-box" onClick={() => { navigator.clipboard.writeText(newLink); setCopied(true); setTimeout(()=>setCopied(false),2000); }}>{newLink}</div>
              <p style={{ textAlign:"center", fontSize:12, color: copied ? "var(--annotated)" : "var(--text-muted)" }}>{copied ? "✓ Copied!" : "Tap to copy"}</p>
            </>
          )}
        </>
      )}
      {tab === "public" && (
        <div className="m-toggle-row">
          <div>
            <div style={{ fontSize:14 }}>Make video public</div>
            <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>All MAP65 orgs can view</div>
          </div>
          <MToggle on={isPublic} onToggle={togglePublic} />
        </div>
      )}
    </Sheet>
  );
}

function MConfirm({ title, body, warning, confirmLabel="Confirm", danger, onConfirm, onClose, loading }) {
  return (
    <Sheet title={title} onClose={onClose}>
      <p style={{ fontSize:14, color:"var(--text-secondary)", lineHeight:1.6, marginBottom:8 }}>{body}</p>
      {warning && <div className="m-warning">⚠ {warning}</div>}
      <div className="m-btn-row" style={{ marginTop:20 }}>
        <button className="m-btn m-btn-ghost" onClick={onClose}>Cancel</button>
        <button className={`m-btn ${danger ? "m-btn-danger" : ""}`} onClick={onConfirm} disabled={loading}>{loading ? <Spinner/> : confirmLabel}</button>
      </div>
    </Sheet>
  );
}

function MVideosTab({ user, companies, activeCompanyId, addToast }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [selected, setSelected] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { fetchVideos(); }, [activeCompanyId]);

  async function fetchVideos() {
    setLoading(true);
    try {
      let q = "videos?select=*,companies(name)&hidden=eq.false&order=created_at.desc";
      if (user.role === "ANNOTATOR" && activeCompanyId) q += `&company_id=eq.${activeCompanyId}`;
      setVideos(await supabase(q));
    } catch(e) { addToast(e.message,"error"); } finally { setLoading(false); }
  }

  function handleStatusChange(id, status) { setVideos(vs => vs.map(v => v.id === id ? { ...v, status } : v)); }

  async function handleRemove(video) {
    setActionLoading(true);
    try {
      await supabase(`videos?id=eq.${video.id}`, { method:"PATCH", body:JSON.stringify({ hidden:true }) });
      setVideos(vs => vs.filter(v => v.id !== video.id));
      addToast("Removed from list","info");
    } catch(e) { addToast(e.message,"error"); } finally { setActionLoading(false); setConfirming(null); }
  }

  async function handleDelete(video) {
    setActionLoading(true);
    try {
      if (video.file_url) {
        const path = video.file_url.split("/videos/")[1];
        if (path) await fetch(`${SUPABASE_URL}/storage/v1/object/videos/${path}`, { method:"DELETE", headers: { apikey:SUPABASE_ANON_KEY, Authorization:`Bearer ${await getToken()}` } });
      }
      await supabase(`videos?id=eq.${video.id}`, { method:"DELETE", prefer:"" });
      setVideos(vs => vs.filter(v => v.id !== video.id));
      addToast("Video deleted","success");
    } catch(e) { addToast(e.message,"error"); } finally { setActionLoading(false); setConfirming(null); }
  }

  const isOwner = v => v.company_id === user.company_id || (user.role === "ANNOTATOR" && v.company_id === activeCompanyId);

  const filtered = videos.filter(v => {
    const s = search.toLowerCase();
    return (!s || v.name.toLowerCase().includes(s) || (v.specialty||"").toLowerCase().includes(s) || (v.activity||"").toLowerCase().includes(s))
      && (statusFilter === "ALL" || v.status === statusFilter);
  });

  const counts = {
    RAW: videos.filter(v => v.status === "RAW").length,
    IN_PROCESSING: videos.filter(v => v.status === "IN_PROCESSING").length,
    ANNOTATED: videos.filter(v => v.status === "ANNOTATED").length,
  };

  return (
    <>
      <div className="m-stats-row">
        <div className="m-stat-pill"><div className="m-stat-num" style={{ color:"var(--raw)" }}>{counts.RAW}</div><div className="m-stat-lbl">Native</div></div>
        <div className="m-stat-pill"><div className="m-stat-num" style={{ color:"var(--processing)" }}>{counts.IN_PROCESSING}</div><div className="m-stat-lbl">In Process</div></div>
        <div className="m-stat-pill"><div className="m-stat-num" style={{ color:"var(--annotated)" }}>{counts.ANNOTATED}</div><div className="m-stat-lbl">Complete</div></div>
      </div>

      <div className="m-searchbar">
        <input className="m-search-input" placeholder="Search videos…" value={search} onChange={e => setSearch(e.target.value)} />
        <button className="m-filter-btn" onClick={() => setShowFilters(true)}>⚙ {statusFilter !== "ALL" ? "1" : ""}</button>
      </div>

      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", padding:60 }}><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="m-empty"><div className="m-empty-icon">🎬</div><h3>No Videos</h3><p>{canDo(user.role,"upload") ? "Tap + to upload your first video" : "No videos available"}</p></div>
      ) : (
        filtered.map(v => (
          <div key={v.id} className="m-video-card" onClick={() => setSelected(v)}>
            <div className="m-video-top">
              <div className="m-video-name">{v.name}</div>
            </div>
            <div className="m-video-meta">
              <StatusTag status={v.status} />
              {v.is_public && <span className="m-tag m-tag-public">🌐</span>}
              {v.specialty && <span className="m-tag m-tag-meta">{v.specialty}</span>}
            </div>
            {v.description && <div className="m-video-desc">{v.description}</div>}
            <div className="m-video-actions" onClick={e => e.stopPropagation()}>
              <button className="m-action-btn m-action-primary" onClick={() => setSelected(v)}>▶ View</button>
              {canDo(user.role,"download") && v.file_url && <a className="m-action-btn" href={v.file_url} download>⬇ Save</a>}
              <button className="m-action-btn" onClick={() => setConfirming({ type:"remove", video:v })}>✕ Remove</button>
              {canDo(user.role,"delete") && isOwner(v) && (
                <button className="m-action-btn m-action-danger" onClick={() => setConfirming({ type:"delete", video:v })}>🗑 Delete</button>
              )}
            </div>
          </div>
        ))
      )}

      {canDo(user.role,"upload") && <button className="m-fab" onClick={() => setShowUpload(true)}>+</button>}

      {showFilters && (
        <Sheet title="Filter Videos" onClose={() => setShowFilters(false)}>
          <div className="m-field"><label>Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="ALL">All Status</option>
              <option value="RAW">Native</option>
              <option value="IN_PROCESSING">Annotation in Process</option>
              <option value="ANNOTATED">Annotation Complete</option>
            </select>
          </div>
          <button className="m-btn" onClick={() => setShowFilters(false)}>Apply</button>
        </Sheet>
      )}

      {showUpload && <MUploadSheet user={user} companies={companies} activeCompanyId={activeCompanyId} onClose={() => setShowUpload(false)} onSave={v => setVideos(p => [v,...p])} addToast={addToast} />}
      {selected && <MVideoDetail video={selected} user={user} onClose={() => setSelected(null)} onStatusChange={handleStatusChange} addToast={addToast} />}

      {confirming?.type === "remove" && (
        <MConfirm title="Remove Video" body={`Remove "${confirming.video.name}" from your list?`} confirmLabel="Remove" onConfirm={() => handleRemove(confirming.video)} onClose={() => setConfirming(null)} loading={actionLoading} />
      )}
      {confirming?.type === "delete" && (
        <MConfirm title="Delete Video" body={`Permanently delete "${confirming.video.name}"?`} warning="This cannot be undone." confirmLabel="Delete" danger onConfirm={() => handleDelete(confirming.video)} onClose={() => setConfirming(null)} loading={actionLoading} />
      )}
    </>
  );
}

function MUsersTab({ user, companies, activeCompanyId, addToast, appUrl }) {
  const [users, setUsers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("VIEWER");
  const [sending, setSending] = useState(false);

  const targetCompanyId = user.role === "ANNOTATOR" ? (activeCompanyId || companies[0]?.id) : user.company_id;
  const availableRoles = user.role === "ANNOTATOR" ? ROLES : user.role === "ORGADMIN" ? ["VIEWER","EDITOR","ORGADMIN"] : ["VIEWER"];

  useEffect(() => { fetchData(); }, [activeCompanyId]);

  async function fetchData() {
    setLoading(true);
    try {
      const filter = user.role === "ANNOTATOR" ? (activeCompanyId ? `&company_id=eq.${activeCompanyId}` : "") : `&company_id=eq.${user.company_id}`;
      const [u, i] = await Promise.all([
        supabase(`profiles?select=*,companies(name)&order=created_at.desc${filter}`),
        supabase(`invitations?select=*,companies(name)&order=created_at.desc${filter}`),
      ]);
      setUsers(u); setInvitations(i);
    } catch(e) { addToast(e.message,"error"); } finally { setLoading(false); }
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) { addToast("Email required","error"); return; }
    setSending(true);
    try {
      const finalRole = isPublicOrg(targetCompanyId) ? "VIEWER" : inviteRole;
      await supabase("invitations", { method:"POST", body:JSON.stringify({ email:inviteEmail.trim(), name:inviteName.trim()||null, company_id:targetCompanyId, role:finalRole, invited_by:user.id }) });
      await inviteUser(inviteEmail.trim(), appUrl);
      addToast(`Invite sent to ${inviteEmail}`,"success");
      setInviteEmail(""); setInviteName(""); setShowInvite(false);
      fetchData();
    } catch(e) { addToast(e.message,"error"); } finally { setSending(false); }
  }

  async function changeRole(id, role) {
    try {
      await supabase(`profiles?id=eq.${id}`, { method:"PATCH", body:JSON.stringify({ role }) });
      setUsers(us => us.map(u => u.id === id ? { ...u, role } : u));
      addToast("Role updated","success");
    } catch(e) { addToast(e.message,"error"); }
  }

  async function revokeInvite(id) {
    try {
      await supabase(`invitations?id=eq.${id}`, { method:"DELETE", prefer:"return=representation" });
      setInvitations(is => is.filter(i => i.id !== id));
      addToast("Invitation revoked","success");
    } catch(e) { addToast(`Failed: ${e.message}`,"error"); }
  }

  return (
    <>
      {invitations.filter(i => !i.accepted).length > 0 && (
        <>
          <div style={{ fontFamily:"var(--font-head)", fontSize:13, fontWeight:700, color:"var(--text-secondary)", textTransform:"uppercase", marginBottom:10 }}>Pending</div>
          {invitations.filter(i => !i.accepted).map(inv => (
            <div key={inv.id} className="m-user-row">
              <div className="m-user-top">
                <div><div className="m-user-email">{inv.email}</div><div className="m-user-sub">{inv.name || "No name yet"}</div></div>
                <RoleTag role={inv.role} />
              </div>
              <button className="m-btn m-btn-danger" style={{ padding:"8px" }} onClick={() => revokeInvite(inv.id)}>Revoke</button>
            </div>
          ))}
        </>
      )}

      <div style={{ fontFamily:"var(--font-head)", fontSize:13, fontWeight:700, color:"var(--text-secondary)", textTransform:"uppercase", margin:"16px 0 10px" }}>Active Users</div>
      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", padding:40 }}><Spinner /></div>
      ) : users.length === 0 ? (
        <div className="m-empty"><div className="m-empty-icon">👥</div><h3>No Users</h3></div>
      ) : (
        users.map(u => {
          // Only show an editable dropdown if:
          // - it's not me
          // - not a Public org user (those use Move to Org elsewhere)
          // - the CURRENT value of their role is actually one I'm allowed to assign
          //   (this prevents ORGADMIN from ever touching an ANNOTATOR's role,
          //   and prevents the <select> from silently misrepresenting an out-of-range role)
          const canEditThisUser = u.id !== user.id
            && !isPublicOrg(u.company_id)
            && availableRoles.includes(u.role);

          return (
            <div key={u.id} className="m-user-row">
              <div className="m-user-top">
                <div><div className="m-user-email">{u.email}</div><div className="m-user-sub">{u.name || u.companies?.name || "—"}</div></div>
                <RoleTag role={u.role} />
              </div>
              {canEditThisUser ? (
                <select value={u.role} onChange={e => changeRole(u.id, e.target.value)} style={{ width:"100%", background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:"var(--r)", color:"var(--text)", padding:"8px" }}>
                  {availableRoles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              ) : u.id !== user.id && (
                <div style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-head)", textTransform:"uppercase" }}>
                  {isPublicOrg(u.company_id) ? "Public — view only" : "No permission to edit"}
                </div>
              )}
            </div>
          );
        })
      )}

      <button className="m-fab" onClick={() => setShowInvite(true)}>+</button>

      {showInvite && (
        <Sheet title="Invite User" onClose={() => setShowInvite(false)}>
          <div className="m-field"><label>Name (optional)</label><input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Dr. Jane Smith" /></div>
          <div className="m-field"><label>Email *</label><input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="user@organization.com" /></div>
          <div className="m-field"><label>Role</label>
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}>{availableRoles.map(r => <option key={r} value={r}>{r}</option>)}</select>
          </div>
          <button className="m-btn" onClick={sendInvite} disabled={sending}>{sending ? <Spinner/> : "Send Invite"}</button>
        </Sheet>
      )}
    </>
  );
}

function MStatsTab({ user, companies, addToast }) {
  const [stats, setStats] = useState([]);
  const [orgViews, setOrgViews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCompanyId, setActiveCompanyId] = useState(user.role === "ANNOTATOR" ? "" : user.company_id);

  useEffect(() => { fetchStats(); }, [activeCompanyId]);

  async function fetchStats() {
    setLoading(true);
    try {
      const companyId = activeCompanyId || user.company_id;
      const videos = await supabase(`videos?company_id=eq.${companyId}&select=id,name,specialty,status`);
      if (videos.length) {
        const ids = videos.map(v => `"${v.id}"`).join(",");
        const views = await supabase(`video_views?video_id=in.(${ids})&select=*&order=viewed_at.desc`);
        const byVideo = {};
        views.forEach(v => { (byVideo[v.video_id] ||= []).push(v); });
        setStats(videos.map(v => ({ ...v, views: byVideo[v.id] || [] })));
      } else setStats([]);
      const ov = await supabase(`video_views?viewer_org_id=eq.${companyId}&select=*,videos(name)&order=viewed_at.desc&limit=30`);
      setOrgViews(ov);
    } catch(e) { addToast(e.message,"error"); } finally { setLoading(false); }
  }

  const totalViews = stats.reduce((s,v) => s + v.views.length, 0);

  return (
    <>
      {user.role === "ANNOTATOR" && (
        <select value={activeCompanyId} onChange={e => setActiveCompanyId(e.target.value)} style={{ width:"100%", marginBottom:16, background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:"var(--r)", color:"var(--text)", padding:"12px" }}>
          {companies.filter(c => !isPublicOrg(c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      <div className="m-stats-row">
        <div className="m-stat-pill"><div className="m-stat-num">{stats.length}</div><div className="m-stat-lbl">Videos</div></div>
        <div className="m-stat-pill"><div className="m-stat-num">{totalViews}</div><div className="m-stat-lbl">Views</div></div>
        <div className="m-stat-pill"><div className="m-stat-num">{stats.reduce((s,v)=>s+v.views.filter(x=>x.is_external).length,0)}</div><div className="m-stat-lbl">External</div></div>
      </div>

      {loading ? <div style={{ display:"flex", justifyContent:"center", padding:40 }}><Spinner /></div> : (
        <>
          <div style={{ fontFamily:"var(--font-head)", fontSize:13, fontWeight:700, color:"var(--text-secondary)", textTransform:"uppercase", marginBottom:10 }}>My Videos</div>
          {stats.map(v => (
            <div key={v.id} className="m-org-card">
              <div className="m-org-name">{v.name}</div>
              <div className="m-org-meta">{v.specialty} · {v.views.length} view{v.views.length !== 1 ? "s" : ""}</div>
              {v.views.slice(0,3).map(vw => (
                <div key={vw.id} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"6px 0", borderTop:"1px solid var(--border)" }}>
                  <span>{vw.viewer_email}{vw.is_external && <span className="m-tag m-tag-meta" style={{ marginLeft:6 }}>External</span>}</span>
                  <span style={{ color:"var(--text-muted)" }}>{new Date(vw.viewed_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          ))}

          {orgViews.length > 0 && (
            <>
              <div style={{ fontFamily:"var(--font-head)", fontSize:13, fontWeight:700, color:"var(--text-secondary)", textTransform:"uppercase", margin:"20px 0 10px" }}>Viewed by Org</div>
              {orgViews.map(vw => (
                <div key={vw.id} className="m-user-row">
                  <div style={{ fontSize:13 }}>{vw.videos?.name}</div>
                  <div className="m-user-sub">{vw.viewer_email} · {new Date(vw.viewed_at).toLocaleDateString()}</div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </>
  );
}

function MOrgsTab({ companies, setCompanies, addToast, appUrl }) {
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [termsType, setTermsType] = useState("general");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [creating, setCreating] = useState(false);

  async function toggleSuspend(c) {
    if (isPublicOrg(c.id)) { addToast("Cannot suspend Public org","error"); return; }
    try {
      await supabase(`companies?id=eq.${c.id}`, { method:"PATCH", body:JSON.stringify({ suspended:!c.suspended }) });
      setCompanies(cs => cs.map(x => x.id === c.id ? { ...x, suspended:!x.suspended } : x));
      addToast(`Organization ${!c.suspended ? "suspended" : "reactivated"}`,"success");
    } catch(e) { addToast(e.message,"error"); }
  }

  async function createOrg() {
    if (!name.trim() || !adminEmail.trim()) { addToast("Name and admin email required","error"); return; }
    if (!termsAccepted) { addToast("Terms must be accepted","error"); return; }
    setCreating(true);
    try {
      const [c] = await supabase("companies", { method:"POST", body:JSON.stringify({ name, terms_type:termsType }) });
      setCompanies(p => [...p, c]);
      await supabase("invitations", { method:"POST", body:JSON.stringify({ email:adminEmail.trim(), name:adminName.trim()||null, company_id:c.id, role:"ORGADMIN" }) });
      await inviteUser(adminEmail.trim(), appUrl);
      addToast("Organization created and invite sent","success");
      setShowNew(false); setName(""); setAdminEmail(""); setAdminName(""); setTermsAccepted(false);
    } catch(e) { addToast(e.message,"error"); } finally { setCreating(false); }
  }

  return (
    <>
      {companies.map(c => (
        <div key={c.id} className="m-org-card" style={{ opacity: c.suspended ? 0.5 : 1 }}>
          <div className="m-org-name">{c.name} {isPublicOrg(c.id) && <span className="m-tag m-tag-meta">Public</span>} {c.suspended && <span className="m-tag" style={{ background:"rgba(224,80,96,0.15)", color:"var(--danger)" }}>Suspended</span>}</div>
          <div className="m-org-meta">{c.id?.slice(0,12)}…</div>
          {!isPublicOrg(c.id) && (
            <button className={`m-btn ${c.suspended ? "m-btn-ghost" : "m-btn-danger"}`} onClick={() => toggleSuspend(c)}>{c.suspended ? "Reactivate" : "Suspend"}</button>
          )}
        </div>
      ))}

      <button className="m-fab" onClick={() => setShowNew(true)}>+</button>

      {showNew && (
        <Sheet title="New Organization" onClose={() => setShowNew(false)}>
          <div className="m-field"><label>Organization Name *</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Johns Hopkins Medicine" /></div>
          <div className="m-field"><label>Terms Type</label>
            <select value={termsType} onChange={e => setTermsType(e.target.value)}><option value="general">General</option><option value="partnership">Partnership</option></select>
          </div>
          <div className="m-field"><label>Admin Name (optional)</label><input value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="Dr. Jane Smith" /></div>
          <div className="m-field"><label>Admin Email *</label><input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="admin@organization.com" /></div>
          <label style={{ display:"flex", gap:8, fontSize:11, color:"var(--text-muted)", marginBottom:18, lineHeight:1.5 }}>
            <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} style={{ marginTop:2 }} />
            <span>Admin agrees to the applicable MAP65 Terms of Service</span>
          </label>
          <button className="m-btn" onClick={createOrg} disabled={creating}>{creating ? <Spinner/> : "Create & Send Invite"}</button>
        </Sheet>
      )}
    </>
  );
}

function MProfileSheet({ user, onClose, onLogout }) {
  return (
    <Sheet title="Account" onClose={onClose}>
      <div style={{ textAlign:"center", marginBottom:20 }}>
        <div className="m-avatar" style={{ width:56, height:56, fontSize:20, margin:"0 auto 12px" }}>{(user.email||"?")[0].toUpperCase()}</div>
        <div style={{ fontSize:15, fontWeight:600 }}>{user.email}</div>
        <div style={{ marginTop:8 }}><RoleTag role={user.role} /></div>
      </div>
      <button className="m-btn m-btn-danger" onClick={onLogout}>Sign Out</button>
    </Sheet>
  );
}

export default function MobileApp() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("videos");
  const [companies, setCompanies] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [activeCompanyId, setActiveCompanyId] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const appUrl = window.location.origin;

  useEffect(() => {
    setOnSessionExpired(() => setSessionExpired(true));
    return () => setOnSessionExpired(null);
  }, []);

  useEffect(() => {
    async function restore() {
      const token = localStorage.getItem("sb_token");
      if (!token) { setSessionLoading(false); return; }
      try {
        const myUserId = getUserIdFromToken(token);
        const profiles = await supabase(`profiles?id=eq.${myUserId}&select=*,companies(*)`);
        if (profiles.length) {
          setUser(profiles[0]);
          setActiveCompanyId(profiles[0].company_id);
          setCompanies(await supabase("companies?select=*&order=name"));
        } else {
          localStorage.removeItem("sb_token");
        }
      } catch(e) {
        localStorage.removeItem("sb_token");
      } finally {
        setSessionLoading(false);
      }
    }
    restore();
  }, []);

  function addToast(msg, type="info") {
    const id = ++toastId;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), type === "error" ? 6000 : 3000);
  }
  function removeToast(id) { setToasts(t => t.filter(x => x.id !== id)); }

  async function handleLogin(profile) {
    setUser(profile);
    setActiveCompanyId(profile.company_id);
    try { setCompanies(await supabase("companies?select=*&order=name")); } catch(_) {}
  }

  function handleLogout() {
    localStorage.removeItem("sb_token");
    localStorage.removeItem("sb_refresh_token");
    setUser(null); setTab("videos"); setActiveCompanyId(null); setSessionExpired(false); setShowProfile(false);
  }

  const isAnnotator = user?.role === "ANNOTATOR";
  const canManageUsers = user && canDo(user.role,"inviteUsers");
  const canViewStats = user && ["ORGADMIN","ANNOTATOR"].includes(user.role);

  const tabs = [
    { id:"videos", icon:"🎬", label:"Videos", show:true },
    { id:"users", icon:"👥", label:"Users", show:canManageUsers },
    { id:"stats", icon:"📊", label:"Stats", show:canViewStats },
    { id:"orgs", icon:"🏢", label:"Orgs", show:isAnnotator },
  ].filter(t => t.show);

  if (sessionLoading) {
    return (
      <>
        <style>{CSS}</style>
        <div className="m-loading-screen">
          <img src="/logo.png" alt="MAP65" style={{ width:140, opacity:0.85 }} />
          <Spinner />
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <style>{CSS}</style>
        <MAuthScreen onLogin={handleLogin} addToast={addToast} />
        <MToast toasts={toasts} remove={removeToast} />
      </>
    );
  }

  const titles = { videos:"Videos", users:"Users", stats:"Stats", orgs:"Organizations" };

  return (
    <>
      <style>{CSS}</style>
      <div className="m-app">
        <div className="m-topbar">
          <img src="/logo.png" alt="MAP65" className="m-logo" />
          <div className="m-topbar-title">{titles[tab]}</div>
          <div className="m-avatar" onClick={() => setShowProfile(true)}>{(user.email||"?")[0].toUpperCase()}</div>
        </div>

        {isAnnotator && (
          <div style={{ padding:"10px 16px 0" }}>
            <select value={activeCompanyId || ""} onChange={e => setActiveCompanyId(e.target.value || null)}
              style={{ width:"100%", background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:"var(--r)", color:"var(--text)", padding:"10px", fontFamily:"var(--font-head)", fontSize:12, fontWeight:600 }}>
              <option value="">All Organizations</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        <div className="m-content">
          {tab === "videos" && <MVideosTab user={user} companies={companies} activeCompanyId={activeCompanyId} addToast={addToast} />}
          {tab === "users" && canManageUsers && <MUsersTab user={user} companies={companies} activeCompanyId={activeCompanyId} addToast={addToast} appUrl={appUrl} />}
          {tab === "stats" && canViewStats && <MStatsTab user={user} companies={companies} addToast={addToast} />}
          {tab === "orgs" && isAnnotator && <MOrgsTab companies={companies} setCompanies={setCompanies} addToast={addToast} appUrl={appUrl} />}

          <div className="m-footer">
            © 2026 MAP65, Inc. · <a href="/terms.html">Terms</a> · v{APP_VERSION}
          </div>
        </div>

        <div className="m-bottomnav">
          {tabs.map(t => (
            <button key={t.id} className={`m-navbtn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              <span className="m-navicon">{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        <MToast toasts={toasts} remove={removeToast} />
        {showProfile && <MProfileSheet user={user} onClose={() => setShowProfile(false)} onLogout={handleLogout} />}
        {sessionExpired && (
          <div className="m-sheet-overlay">
            <div className="m-sheet" style={{ textAlign:"center" }}>
              <div style={{ fontSize:40, marginBottom:10 }}>🔒</div>
              <div className="m-sheet-title">Session Expired</div>
              <p style={{ fontSize:13, color:"var(--text-secondary)", marginBottom:20 }}>Please sign in again to continue.</p>
              <button className="m-btn" onClick={handleLogout}>Sign In Again</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
