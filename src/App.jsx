import { useState, useEffect, useRef } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const PUBLIC_ORG_ID = "00000000-0000-0000-0000-000000000001";

async function supabase(path, options = {}) {
  const token = localStorage.getItem("sb_token");
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
    throw new Error(err.message || res.statusText);
  }
  return res.status === 204 ? null : res.json();
}

async function authFetch(path, body, method = "POST") {
  const token = localStorage.getItem("sb_token");
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

// Invite a user via Supabase Auth (requires service role in prod; uses anon+admin here)
async function inviteUser(email, redirectTo) {
  const token = localStorage.getItem("sb_token");
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
    // Show detailed error including logs from edge function
    const detail = data.detail ? ` — ${JSON.stringify(data.detail)}` : "";
    const logs = data.logs ? `\nLogs: ${data.logs.join(" | ")}` : "";
    throw new Error(`${data.error || "Invite failed"}${detail}${logs}`);
  }
  return data;
}

const SPECIALTIES = ["Colorectal","General & Hepatobiliary","Gynecology","Thoracic","Urology"];
const PROCEDURES = {
  Thoracic: ["RUL Lobectomy","RML Lobectomy","RLL Lobectomy","LUL Lobectomy","LLL Lobectomy","Segmentectomy","Other"],
  Colorectal: ["Other"],
  "General & Hepatobiliary": ["Other"],
  Gynecology: ["Other"],
  Urology: ["Other"],
};

const VIEW_RESTRICTIONS = [
  { value: "none",     label: "Unrestricted" },
  { value: "once_org", label: "Once per user (org members)" },
  { value: "once_all", label: "Once per user (everyone)" },
];

const STATUS_LABELS = {
  RAW: "Native",
  IN_PROCESSING: "Annotation in Process",
  ANNOTATED: "Annotation Complete",
};

const ROLES = ["VIEWER","EDITOR","ORGADMIN","ANNOTATOR"];
const ROLE_COLORS = {
  VIEWER:    { bg: "rgba(74,100,128,0.3)",    color: "var(--text-muted)",  border: "rgba(74,100,128,0.4)" },
  EDITOR:    { bg: "rgba(20,80,160,0.25)",    color: "var(--blue-pale)",   border: "rgba(20,80,160,0.4)" },
  ORGADMIN:  { bg: "rgba(240,160,48,0.15)",   color: "var(--raw)",         border: "rgba(240,160,48,0.35)" },
  ANNOTATOR: { bg: "rgba(56,200,120,0.15)",   color: "var(--annotated)",   border: "rgba(56,200,120,0.3)" },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --navy-900:#060e1e; --navy-800:#0a1628; --navy-700:#0f2040; --navy-600:#142850;
    --blue-primary:#1450a0; --blue-mid:#2860b4; --blue-light:#5090c8; --blue-pale:#78a0c8;
    --white:#ffffff; --text:#e8eef8; --text-secondary:#8aa4c8; --text-muted:#4a6480;
    --border:rgba(20,80,160,0.25); --border-bright:rgba(88,144,200,0.4);
    --surface:rgba(10,22,40,0.95); --surface2:rgba(15,32,64,0.8);
    --raw:#f0a030; --processing:#5090c8; --annotated:#38c878; --danger:#e05060; --share:#a060e0;
    --font-head:'Rajdhani',sans-serif; --font-body:'Source Sans 3',sans-serif;
    --r:6px; --r-lg:12px;
    --shadow:0 8px 40px rgba(0,0,0,0.5),0 0 0 1px rgba(20,80,160,0.15);
    --shadow-glow:0 0 30px rgba(20,80,160,0.3);
  }
  body { background:var(--navy-900); color:var(--text); font-family:var(--font-body); font-size:14px; line-height:1.5; min-height:100vh; }
  body::before { content:''; position:fixed; inset:0; z-index:-1;
    background: radial-gradient(ellipse 80% 60% at 10% 0%,rgba(20,80,160,0.18) 0%,transparent 60%),
      radial-gradient(ellipse 60% 40% at 90% 100%,rgba(10,30,80,0.3) 0%,transparent 50%),
      repeating-linear-gradient(0deg,transparent,transparent 80px,rgba(20,80,160,0.03) 80px,rgba(20,80,160,0.03) 81px),
      repeating-linear-gradient(90deg,transparent,transparent 80px,rgba(20,80,160,0.03) 80px,rgba(20,80,160,0.03) 81px);
    pointer-events:none; }
  ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-track{background:var(--navy-800)} ::-webkit-scrollbar-thumb{background:var(--blue-primary);border-radius:3px}
  .app{min-height:100vh;display:flex;flex-direction:column}

  /* AUTH */
  .auth-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .auth-wrap{display:grid;grid-template-columns:1fr 1fr;width:100%;max-width:900px;min-height:540px;border-radius:var(--r-lg);overflow:hidden;box-shadow:var(--shadow),var(--shadow-glow);border:1px solid var(--border-bright)}
  .auth-left{background:linear-gradient(135deg,var(--navy-700) 0%,var(--navy-600) 40%,var(--blue-primary) 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px;position:relative;overflow:hidden}
  .auth-left::before{content:'';position:absolute;inset:-50%;background:repeating-conic-gradient(rgba(255,255,255,0.03) 0deg,transparent 1deg,transparent 45deg);animation:rotate 60s linear infinite}
  @keyframes rotate{to{transform:rotate(360deg)}}
  .auth-left-content{position:relative;z-index:1;text-align:center}
  .auth-logo-img{width:200px;margin-bottom:32px;filter:brightness(1.1)}
  .auth-tagline{font-family:var(--font-head);font-size:15px;font-weight:500;color:var(--blue-pale);letter-spacing:2px;text-transform:uppercase}
  .auth-divider{width:40px;height:2px;background:linear-gradient(90deg,transparent,var(--blue-light),transparent);margin:16px auto}
  .auth-desc{font-size:13px;color:var(--text-secondary);line-height:1.7;max-width:240px}
  .auth-right{background:var(--surface);backdrop-filter:blur(20px);padding:48px;display:flex;flex-direction:column;justify-content:center}
  .auth-title{font-family:var(--font-head);font-size:28px;font-weight:700;color:var(--white);margin-bottom:4px}
  .auth-sub{color:var(--text-secondary);font-size:13px;margin-bottom:32px}
  .auth-form{display:flex;flex-direction:column;gap:14px}

  /* FORM */
  .field{display:flex;flex-direction:column;gap:6px}
  .field label{font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.5px;font-weight:600;font-family:var(--font-head)}
  .field input,.field select,.field textarea{background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);color:var(--text);font-family:var(--font-body);font-size:14px;padding:10px 14px;outline:none;transition:border-color .2s,box-shadow .2s;width:100%}
  .field input:focus,.field select:focus,.field textarea:focus{border-color:var(--blue-light);box-shadow:0 0 0 3px rgba(80,144,200,0.15)}
  .field textarea{resize:vertical;min-height:80px}
  .field select option{background:var(--navy-700)}

  /* BUTTONS */
  .btn{display:inline-flex;align-items:center;gap:8px;border:none;border-radius:var(--r);cursor:pointer;font-family:var(--font-head);font-size:14px;font-weight:600;padding:10px 20px;transition:all .2s;white-space:nowrap;letter-spacing:.5px;text-transform:uppercase}
  .btn-primary{background:linear-gradient(135deg,var(--blue-primary),var(--blue-mid));color:var(--white);box-shadow:0 4px 16px rgba(20,80,160,0.4)}
  .btn-primary:hover{background:linear-gradient(135deg,var(--blue-mid),var(--blue-light));transform:translateY(-1px)}
  .btn-ghost{background:transparent;color:var(--text-secondary);border:1px solid var(--border)}
  .btn-ghost:hover{border-color:var(--blue-light);color:var(--blue-light)}
  .btn-danger{background:transparent;color:var(--danger);border:1px solid var(--danger)}
  .btn-danger:hover{background:var(--danger);color:var(--white)}
  .btn-sm{padding:6px 14px;font-size:12px}
  .btn:disabled{opacity:.4;cursor:not-allowed;transform:none!important}

  /* HEADER */
  .header{height:64px;background:rgba(6,14,30,0.95);backdrop-filter:blur(20px);border-bottom:1px solid var(--border-bright);display:flex;align-items:center;padding:0 32px;gap:8px;position:sticky;top:0;z-index:100}
  .header::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--blue-primary),var(--blue-light),var(--blue-primary),transparent)}
  .header-logo{height:36px;margin-right:24px}
  .header-divider{width:1px;height:24px;background:var(--border);margin:0 8px}
  .nav-tab{background:none;border:none;cursor:pointer;font-family:var(--font-head);font-size:13px;font-weight:600;color:var(--text-muted);padding:8px 16px;border-radius:var(--r);transition:all .2s;letter-spacing:1px;text-transform:uppercase;position:relative}
  .nav-tab::after{content:'';position:absolute;bottom:2px;left:16px;right:16px;height:2px;background:var(--blue-light);border-radius:1px;transform:scaleX(0);transition:transform .2s}
  .nav-tab:hover{color:var(--text)}
  .nav-tab.active{color:var(--blue-light)}
  .nav-tab.active::after{transform:scaleX(1)}
  .header-right{margin-left:auto;display:flex;align-items:center;gap:12px}
  .user-pill{display:flex;align-items:center;gap:10px;background:var(--surface2);border:1px solid var(--border);border-radius:30px;padding:5px 16px 5px 6px}
  .user-avatar{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--blue-primary),var(--blue-light));display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;font-family:var(--font-head);color:white;border:1px solid var(--blue-light)}
  .user-email{font-size:12px;color:var(--text-secondary)}
  .role-badge{font-size:9px;padding:2px 8px;border-radius:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;font-family:var(--font-head)}

  /* ORG SWITCHER */
  .org-switcher{display:flex;align-items:center;gap:8px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);padding:4px 4px 4px 12px}
  .org-switcher-label{font-size:11px;color:var(--text-muted);font-family:var(--font-head);text-transform:uppercase;letter-spacing:1px;white-space:nowrap}
  .org-switcher select{background:var(--navy-800);border:1px solid var(--border);border-radius:var(--r);color:var(--text);font-family:var(--font-head);font-size:12px;font-weight:600;padding:4px 10px;outline:none;cursor:pointer;max-width:180px}

  /* MAIN */
  .main{flex:1;padding:32px;max-width:1400px;margin:0 auto;width:100%}
  .page-header{display:flex;align-items:center;gap:16px;margin-bottom:24px;flex-wrap:wrap}
  .page-title{font-family:var(--font-head);font-size:26px;font-weight:700;color:var(--white);letter-spacing:1px;text-transform:uppercase}
  .page-title span{color:var(--blue-light)}

  /* STATUS */
  .status-badge{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:4px 12px;border-radius:4px;font-family:var(--font-head);white-space:nowrap}
  .status-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
  .status-RAW{background:rgba(240,160,48,0.12);color:var(--raw);border:1px solid rgba(240,160,48,0.3)}
  .status-RAW .status-dot{background:var(--raw);box-shadow:0 0 6px var(--raw)}
  .status-IN_PROCESSING{background:rgba(80,144,200,0.12);color:var(--processing);border:1px solid rgba(80,144,200,0.3)}
  .status-IN_PROCESSING .status-dot{background:var(--processing);animation:pulse 1.5s infinite}
  .status-ANNOTATED{background:rgba(56,200,120,0.12);color:var(--annotated);border:1px solid rgba(56,200,120,0.3)}
  .status-ANNOTATED .status-dot{background:var(--annotated);box-shadow:0 0 6px var(--annotated)}
  @keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 6px var(--processing)}50%{opacity:.4;box-shadow:none}}
  .share-tag{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;padding:2px 8px;border-radius:4px;font-family:var(--font-head);margin-left:6px}
  .share-tag-public{background:rgba(56,200,120,0.12);color:var(--annotated);border:1px solid rgba(56,200,120,0.3)}

  /* TABLE */
  .table-wrap{background:var(--surface);backdrop-filter:blur(20px);border:1px solid var(--border-bright);border-radius:var(--r-lg);overflow:hidden;box-shadow:var(--shadow)}
  .toolbar{display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid var(--border);background:var(--surface2);flex-wrap:wrap}
  .search-wrap{position:relative}
  .search-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:13px}
  .search-input{background:var(--navy-800);border:1px solid var(--border);border-radius:var(--r);color:var(--text);font-family:var(--font-body);font-size:13px;padding:8px 14px 8px 34px;outline:none;width:240px;transition:border-color .2s}
  .search-input:focus{border-color:var(--blue-light)}
  .filter-select{background:var(--navy-800);border:1px solid var(--border);border-radius:var(--r);color:var(--text-secondary);font-family:var(--font-head);font-size:12px;font-weight:600;padding:8px 14px;outline:none;cursor:pointer;text-transform:uppercase;letter-spacing:.5px}
  table{width:100%;border-collapse:collapse}
  thead{background:linear-gradient(180deg,var(--navy-700),var(--navy-800))}
  th{text-align:left;padding:12px 16px;font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;font-family:var(--font-head);border-bottom:1px solid var(--border-bright)}
  td{padding:12px 16px;font-size:13px;border-bottom:1px solid rgba(20,80,160,0.1);vertical-align:middle}
  tr:last-child td{border-bottom:none}
  tr:hover td{background:rgba(20,80,160,0.06)}
  .video-name{font-weight:600;color:var(--white);font-size:14px;display:flex;align-items:center;flex-wrap:wrap;gap:4px}
  .video-desc{font-size:12px;color:var(--text-secondary);margin-top:2px;max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .actions{display:flex;gap:5px;flex-wrap:wrap}

  /* MODAL */
  .modal-overlay{position:fixed;inset:0;z-index:200;background:rgba(2,6,16,0.85);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px;animation:fadeIn .15s ease}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  .modal{background:var(--navy-800);border:1px solid var(--border-bright);border-radius:var(--r-lg);padding:36px;width:100%;max-width:560px;max-height:92vh;overflow-y:auto;animation:slideUp .2s ease;box-shadow:var(--shadow),var(--shadow-glow)}
  @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
  .modal-title{font-family:var(--font-head);font-size:22px;font-weight:700;color:var(--white);margin-bottom:6px;letter-spacing:1px;text-transform:uppercase}
  .modal-subtitle{color:var(--text-muted);font-size:12px;margin-bottom:24px}
  .modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:28px;padding-top:20px;border-top:1px solid var(--border);flex-wrap:wrap}
  .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .form-grid .full{grid-column:1/-1}

  /* UPLOAD PROGRESS */
  .upload-progress{margin-top:16px}
  .upload-progress-label{display:flex;justify-content:space-between;font-size:12px;color:var(--text-secondary);margin-bottom:8px;font-family:var(--font-head)}
  .upload-progress-label span:last-child{color:var(--blue-light);font-weight:600}
  .progress-track{width:100%;height:8px;background:var(--navy-700);border-radius:4px;overflow:hidden;border:1px solid var(--border)}
  .progress-bar{height:100%;border-radius:4px;background:linear-gradient(90deg,var(--blue-primary),var(--blue-light));transition:width .3s ease;position:relative;overflow:hidden}
  .progress-bar::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent);animation:shimmer 1.5s infinite}
  @keyframes shimmer{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
  .upload-eta{font-size:11px;color:var(--text-muted);margin-top:6px;text-align:center}

  /* CONFIRM */
  .confirm-modal{max-width:420px}
  .confirm-body{color:var(--text-secondary);font-size:14px;line-height:1.6}
  .confirm-warning{background:rgba(224,80,96,0.1);border:1px solid rgba(224,80,96,0.3);border-radius:var(--r);padding:12px 16px;font-size:13px;color:var(--danger);margin-top:12px}

  /* SHARE */
  .share-section{margin-bottom:20px}
  .share-section-title{font-family:var(--font-head);font-size:13px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px}
  .share-toggle{display:flex;align-items:center;justify-content:space-between;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);padding:12px 16px}
  .share-toggle-label{font-size:14px;color:var(--text)}
  .share-toggle-sub{font-size:12px;color:var(--text-muted);margin-top:2px}
  .toggle-switch{position:relative;width:44px;height:24px;cursor:pointer;flex-shrink:0}
  .toggle-track{position:absolute;inset:0;background:var(--navy-600);border-radius:12px;transition:background .2s;border:1px solid var(--border)}
  .toggle-track.on{background:var(--blue-primary);border-color:var(--blue-light)}
  .toggle-thumb{position:absolute;top:3px;left:3px;width:16px;height:16px;background:white;border-radius:50%;transition:transform .2s}
  .toggle-thumb.on{transform:translateX(20px)}
  .org-list{display:flex;flex-direction:column;gap:8px;max-height:200px;overflow-y:auto}
  .org-row{display:flex;align-items:center;justify-content:space-between;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);padding:10px 14px}
  .org-row-name{font-size:14px;color:var(--text)}
  .org-row-granted{font-size:11px;color:var(--annotated);font-family:var(--font-head);text-transform:uppercase}

  /* USERS TAB */
  .users-table-wrap{background:var(--surface);border:1px solid var(--border-bright);border-radius:var(--r-lg);overflow:hidden;box-shadow:var(--shadow)}
  .invite-box{background:var(--surface2);border:1px solid var(--border-bright);border-radius:var(--r-lg);padding:24px;margin-bottom:24px}
  .invite-box-title{font-family:var(--font-head);font-size:16px;font-weight:700;color:var(--white);margin-bottom:16px;letter-spacing:.5px;text-transform:uppercase}
  .invite-grid{display:grid;grid-template-columns:1fr 1fr 160px auto;gap:12px;align-items:end}
  .pending-badge{display:inline-block;font-size:10px;text-transform:uppercase;letter-spacing:1px;background:rgba(240,160,48,0.15);color:var(--raw);padding:2px 8px;border-radius:4px;border:1px solid rgba(240,160,48,0.3);font-family:var(--font-head);font-weight:700}
  .accepted-badge{display:inline-block;font-size:10px;text-transform:uppercase;letter-spacing:1px;background:rgba(56,200,120,0.12);color:var(--annotated);padding:2px 8px;border-radius:4px;border:1px solid rgba(56,200,120,0.3);font-family:var(--font-head);font-weight:700}

  /* EMPTY */
  .empty{text-align:center;padding:80px 24px;color:var(--text-muted)}
  .empty-icon{font-size:52px;margin-bottom:20px;opacity:.6}
  .empty h3{font-family:var(--font-head);font-size:20px;font-weight:700;color:var(--text-secondary);margin-bottom:8px;letter-spacing:1px;text-transform:uppercase}
  .empty p{font-size:13px}

  /* COMPANY CARDS */
  .company-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
  .company-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:24px;transition:all .2s;position:relative;overflow:hidden}
  .company-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--blue-primary),var(--blue-light));transform:scaleX(0);transform-origin:left;transition:transform .3s}
  .company-card:hover{border-color:var(--border-bright);box-shadow:var(--shadow-glow)}
  .company-card:hover::before{transform:scaleX(1)}
  .company-card h3{font-family:var(--font-head);font-size:18px;font-weight:700;color:var(--white);margin-bottom:4px}
  .company-card .meta{font-size:12px;color:var(--text-muted);margin-bottom:16px;font-family:monospace}
  .suspended{opacity:.45}
  .suspended-tag{display:inline-block;font-size:9px;text-transform:uppercase;letter-spacing:1px;background:rgba(224,80,96,0.15);color:var(--danger);padding:2px 8px;border-radius:4px;margin-left:10px;border:1px solid rgba(224,80,96,0.3);font-family:var(--font-head);font-weight:700}
  .public-org-tag{display:inline-block;font-size:9px;text-transform:uppercase;letter-spacing:1px;background:rgba(80,144,200,0.15);color:var(--blue-light);padding:2px 8px;border-radius:4px;margin-left:10px;border:1px solid rgba(80,144,200,0.3);font-family:var(--font-head);font-weight:700}

  /* TOAST */
  .toast-wrap{position:fixed;bottom:28px;right:28px;z-index:999;display:flex;flex-direction:column;gap:10px}
  .toast{background:var(--navy-700);border:1px solid var(--border-bright);border-radius:var(--r);padding:14px 20px;font-size:13px;max-width:340px;cursor:pointer;animation:slideIn .25s ease;display:flex;align-items:center;gap:12px;box-shadow:var(--shadow)}
  @keyframes slideIn{from{transform:translateX(48px);opacity:0}to{transform:translateX(0);opacity:1}}
  .toast.success{border-color:var(--annotated)} .toast.error{border-color:var(--danger)} .toast.info{border-color:var(--blue-light)}

  /* VIDEO DETAIL */
  .video-player{background:#000;border-radius:var(--r);width:100%;max-height:300px;object-fit:contain;margin-bottom:24px;border:1px solid var(--border)}
  .detail-grid{display:grid;grid-template-columns:150px 1fr;gap:10px 16px;margin-bottom:8px}
  .detail-label{font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;font-family:var(--font-head);font-weight:600;padding-top:2px}
  .detail-value{font-size:14px;color:var(--text)}

  /* ACTION BUTTONS */
  .action-btn{display:inline-flex;align-items:center;gap:5px;border-radius:var(--r);cursor:pointer;border:1px solid;font-family:var(--font-head);font-size:11px;font-weight:700;padding:5px 10px;transition:all .2s;white-space:nowrap;text-transform:uppercase;letter-spacing:.5px;text-decoration:none;background:transparent}
  .action-view{color:var(--blue-pale);border-color:var(--border)} .action-view:hover{border-color:var(--blue-pale);background:rgba(120,160,200,0.1)}
  .action-submit{color:var(--raw);border-color:rgba(240,160,48,0.3);background:rgba(240,160,48,0.08)} .action-submit:hover{background:rgba(240,160,48,0.18)}
  .action-annotate{color:var(--annotated);border-color:rgba(56,200,120,0.3);background:rgba(56,200,120,0.08)} .action-annotate:hover{background:rgba(56,200,120,0.18)}
  .action-download{color:var(--text-secondary);border-color:var(--border)} .action-download:hover{border-color:var(--text-secondary);color:var(--text)}
  .action-share{color:var(--share);border-color:rgba(160,96,224,0.3);background:rgba(160,96,224,0.08)} .action-share:hover{background:rgba(160,96,224,0.18)}
  .action-remove{color:var(--text-muted);border-color:var(--border)} .action-remove:hover{color:var(--raw);border-color:rgba(240,160,48,0.4)}
  .action-delete{color:var(--danger);border-color:rgba(224,80,96,0.3);background:rgba(224,80,96,0.06)} .action-delete:hover{background:rgba(224,80,96,0.18)}

  /* STATS */
  .stats-bar{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px}
  .stat-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:20px 24px;display:flex;align-items:center;gap:16px}
  .stat-icon{font-size:28px;opacity:.8}
  .stat-number{font-family:var(--font-head);font-size:32px;font-weight:700;color:var(--white);line-height:1}
  .stat-label{font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-top:2px;font-family:var(--font-head)}

  /* INFO BOX */
  .info-box{background:rgba(20,80,160,0.08);border:1px solid var(--border-bright);border-radius:var(--r);padding:12px 16px;font-size:13px;color:var(--text-secondary);margin-bottom:16px;line-height:1.6}

  /* MISC */
  .divider{height:1px;background:var(--border);margin:20px 0}
  .text-muted{color:var(--text-muted)} .text-sm{font-size:12px}
  .flex{display:flex} .items-center{align-items:center} .gap-2{gap:8px} .gap-3{gap:12px}
  .ml-auto{margin-left:auto} .mt-2{margin-top:8px} .mt-4{margin-top:16px} .mb-4{margin-bottom:16px} .w-full{width:100%}
  .spinner{width:18px;height:18px;border:2px solid var(--border);border-top-color:var(--blue-light);border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0}
  @keyframes spin{to{transform:rotate(360deg)}}

  /* STATS TAB */
  .stats-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin-bottom:24px}
  .stats-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:24px}
  .stats-card-title{font-family:var(--font-head);font-size:13px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;margin-bottom:16px}
  .stats-big{font-family:var(--font-head);font-size:40px;font-weight:700;color:var(--white);line-height:1}
  .stats-sub{font-size:12px;color:var(--text-muted);margin-top:4px}
  .view-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);font-size:13px}
  .view-row:last-child{border-bottom:none}
  .view-email{color:var(--text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .view-meta{color:var(--text-muted);font-size:11px;font-family:monospace;white-space:nowrap}
  .external-tag{display:inline-block;font-size:9px;text-transform:uppercase;letter-spacing:1px;background:rgba(160,96,224,0.15);color:var(--share);padding:2px 6px;border-radius:4px;border:1px solid rgba(160,96,224,0.3);font-family:var(--font-head);font-weight:700;margin-left:6px}
  .verified-tag{display:inline-block;font-size:9px;text-transform:uppercase;letter-spacing:1px;background:rgba(56,200,120,0.12);color:var(--annotated);padding:2px 6px;border-radius:4px;border:1px solid rgba(56,200,120,0.3);font-family:var(--font-head);font-weight:700;margin-left:4px}

  /* LINK MODAL */
  .link-box{background:var(--navy-700);border:1px solid var(--border-bright);border-radius:var(--r);padding:14px 16px;font-family:monospace;font-size:12px;color:var(--blue-light);word-break:break-all;margin:16px 0;cursor:pointer;transition:background .2s}
  .link-box:hover{background:var(--navy-600)}
  .link-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);font-size:13px}
  .link-row:last-child{border-bottom:none}

  /* EXTERNAL VIEW PAGE */
  .external-page{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .external-card{background:var(--surface);border:1px solid var(--border-bright);border-radius:var(--r-lg);padding:40px;width:100%;max-width:560px;box-shadow:var(--shadow),var(--shadow-glow)}
  .external-title{font-family:var(--font-head);font-size:22px;font-weight:700;color:var(--white);margin-bottom:8px;letter-spacing:.5px}
  .external-sub{color:var(--text-secondary);font-size:13px;margin-bottom:24px}

  /* VIEW RESTRICTION BADGE */
  .restriction-badge{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;padding:2px 8px;border-radius:4px;font-family:var(--font-head);margin-left:6px}
  .restriction-once{background:rgba(240,160,48,0.12);color:var(--raw);border:1px solid rgba(240,160,48,0.3)}

  @media(max-width:768px){
    .auth-wrap{grid-template-columns:1fr} .auth-left{display:none}
    .stats-bar{grid-template-columns:1fr} .header{padding:0 16px}
    .main{padding:20px 16px} .form-grid{grid-template-columns:1fr} .form-grid .full{grid-column:1}
    .invite-grid{grid-template-columns:1fr}
  }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function canDo(role, action) {
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

function isPublicOrg(id) { return id === PUBLIC_ORG_ID; }

let toastId = 0;

// ── Small components ──────────────────────────────────────────────────────────
function Toast({ toasts, remove }) {
  const icons = { success:"✓", error:"✕", info:"ℹ" };
  return (
    <div className="toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`} onClick={() => remove(t.id)}>
          <span>{icons[t.type]}</span>{t.msg}
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" />{STATUS_LABELS[status] || status}
    </span>
  );
}

function RoleBadge({ role }) {
  const c = ROLE_COLORS[role] || ROLE_COLORS.VIEWER;
  return (
    <span className="role-badge" style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {role}
    </span>
  );
}

function Toggle({ on, onToggle }) {
  return (
    <div className="toggle-switch" onClick={onToggle}>
      <div className={`toggle-track ${on ? "on" : ""}`}>
        <div className={`toggle-thumb ${on ? "on" : ""}`} />
      </div>
    </div>
  );
}

function Spinner() { return <div className="spinner" />; }

function UploadProgress({ percent, fileName }) {
  return (
    <div className="upload-progress">
      <div className="upload-progress-label">
        <span>Uploading {fileName}</span>
        <span>{percent === 0 ? "Starting…" : percent === 100 ? "Processing…" : `${percent}% complete`}</span>
      </div>
      <div className="progress-track">
        <div className="progress-bar" style={{ width: `${percent}%` }} />
      </div>
      <div className="upload-eta">
        {percent < 100 ? "Large files may take several minutes — please keep this window open" : "Finalizing upload…"}
      </div>
    </div>
  );
}

function uploadFileWithProgress(url, file, token, apiKey, onProgress) {
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

function ConfirmModal({ title, body, warning, confirmLabel="Confirm", confirmClass="btn-danger", onConfirm, onClose, loading }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal confirm-modal">
        <div className="modal-title">{title}</div>
        <p className="confirm-body">{body}</p>
        {warning && <div className="confirm-warning">⚠ {warning}</div>}
        <div className="modal-actions">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className={`btn ${confirmClass} btn-sm`} onClick={onConfirm} disabled={loading}>
            {loading ? <Spinner /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Share modal ───────────────────────────────────────────────────────────────
function ShareModal({ video, user, companies, onClose, onUpdate, addToast }) {
  const [isPublic, setIsPublic] = useState(video.is_public || false);
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase(`video_access?video_id=eq.${video.id}&select=*`)
      .then(data => setGrants(data.map(g => g.company_id)))
      .catch(e => addToast(e.message, "error"))
      .finally(() => setLoading(false));
  }, []);

  async function togglePublic() {
    const newVal = !isPublic;
    setIsPublic(newVal);
    try {
      await supabase(`videos?id=eq.${video.id}`, { method:"PATCH", body:JSON.stringify({ is_public:newVal }) });
      onUpdate({ ...video, is_public:newVal });
      addToast(newVal ? "Video is now public" : "Video set to private", "success");
    } catch(e) { addToast(e.message,"error"); setIsPublic(!newVal); }
  }

  async function toggleGrant(companyId) {
    const has = grants.includes(companyId);
    try {
      if (has) {
        await supabase(`video_access?video_id=eq.${video.id}&company_id=eq.${companyId}`, { method:"DELETE", prefer:"" });
        setGrants(g => g.filter(id => id !== companyId));
        addToast("Access removed","info");
      } else {
        await supabase("video_access", { method:"POST", body:JSON.stringify({ video_id:video.id, company_id:companyId, granted_by:user.id }) });
        setGrants(g => [...g, companyId]);
        addToast("Access granted","success");
      }
    } catch(e) { addToast(e.message,"error"); }
  }

  const others = companies.filter(c => c.id !== video.company_id && !c.suspended);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:500 }}>
        <div className="modal-title">Share Video</div>
        <p className="modal-subtitle">{video.name}</p>
        <div className="share-section">
          <div className="share-section-title">Public Access</div>
          <div className="share-toggle">
            <div>
              <div className="share-toggle-label">Make video public</div>
              <div className="share-toggle-sub">All MAP65 organizations can view this video</div>
            </div>
            <Toggle on={isPublic} onToggle={togglePublic} />
          </div>
        </div>
        <div className="share-section">
          <div className="share-section-title">Share with Organizations</div>
          {loading ? <div style={{ padding:20, display:"flex", justifyContent:"center" }}><Spinner /></div> : (
            <div className="org-list">
              {others.length === 0 && <p style={{ color:"var(--text-muted)", fontSize:13, padding:"12px 0" }}>No other organizations available.</p>}
              {others.map(c => {
                const granted = grants.includes(c.id);
                return (
                  <div key={c.id} className="org-row">
                    <div className="org-row-name">{c.name}</div>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      {granted && <span className="org-row-granted">✓ Granted</span>}
                      <button className={`btn btn-sm ${granted ? "btn-danger" : "btn-ghost"}`} style={{ fontSize:11, padding:"4px 12px" }} onClick={() => toggleGrant(c.id)}>
                        {granted ? "Revoke" : "Grant Access"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary btn-sm" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ── Auth screen ───────────────────────────────────────────────────────────────
function AuthScreen({ onLogin, addToast }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("login");
  // For invite acceptance
  const [inviteToken, setInviteToken] = useState(null);
  const [inviteName, setInviteName] = useState("");

  useEffect(() => {
    // Check for invite token in URL hash or query params
    const hash = window.location.hash;
    const search = window.location.search;

    // Try hash first (e.g. #access_token=xxx&type=invite)
    if (hash.includes("access_token") && hash.includes("type=invite")) {
      const params = new URLSearchParams(hash.replace("#",""));
      const token = params.get("access_token");
      const type = params.get("type");
      if (token && type === "invite") {
        setInviteToken(token); setMode("accept"); return;
      }
    }

    // Try query params (e.g. ?access_token=xxx&type=invite)
    if (search.includes("access_token") && search.includes("type=invite")) {
      const params = new URLSearchParams(search);
      const token = params.get("access_token");
      const type = params.get("type");
      if (token && type === "invite") {
        setInviteToken(token); setMode("accept"); return;
      }
    }

    // Check for password reset token
    if (hash.includes("access_token") && hash.includes("type=recovery")) {
      const params = new URLSearchParams(hash.replace("#",""));
      const token = params.get("access_token");
      if (token) { setInviteToken(token); setMode("reset"); return; }
    }
    if (search.includes("access_token") && search.includes("type=recovery")) {
      const params = new URLSearchParams(search);
      const token = params.get("access_token");
      if (token) { setInviteToken(token); setMode("reset"); return; }
    }

    // Check for error in URL (e.g. expired token)
    if (hash.includes("error=") || search.includes("error=")) {
      const params = new URLSearchParams(hash.replace("#","") || search);
      const error = params.get("error_description") || params.get("error");
      if (error) setMode("login");
    }
  }, []);

  async function handleSubmit() {
    if (mode !== "accept" && !email) { addToast("Please fill in all fields","error"); return; }
    if (!password) { addToast("Please enter a password","error"); return; }
    setLoading(true);
    try {
      if (mode === "login") {
        const data = await authFetch("token?grant_type=password", { email, password });
        localStorage.setItem("sb_token", data.access_token);
        const profiles = await supabase(`profiles?email=eq.${encodeURIComponent(email)}&select=*,companies(*)`);
        if (!profiles.length) throw new Error("Profile not found");
        onLogin({ ...profiles[0], token:data.access_token });
      } else if (mode === "register") {
        // Self-register — goes to Public org automatically via DB trigger
        await authFetch("signup", { email, password });
        setMode("confirm");
      } else if (mode === "accept") {
        // Accept an invite — update the user's name via profile
        localStorage.setItem("sb_token", inviteToken);
        // Update password
        await authFetch("user", { password }, "PUT");
        // Update name in profile if provided
        if (inviteName.trim()) {
          const me = await supabase(`profiles?select=*`);
          if (me.length) {
            await supabase(`profiles?id=eq.${me[0].id}`, { method:"PATCH", body:JSON.stringify({ name:inviteName.trim() }) });
          }
        }
        // Fetch full profile
        const profiles = await supabase(`profiles?select=*,companies(*)`);
        if (!profiles.length) throw new Error("Profile not found");
        window.location.hash = "";
        onLogin({ ...profiles[0], token:inviteToken });
      }
      } else if (mode === "forgot") {
        // Send password reset email via Supabase
        const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
          method: "POST",
          headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ email, redirect_to: window.location.origin }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error_description || data.msg || "Failed to send reset email");
        }
        setMode("confirm_reset");
      } else if (mode === "reset") {
        // Set new password using the recovery token
        localStorage.setItem("sb_token", inviteToken);
        await authFetch("user", { password }, "PUT");
        localStorage.removeItem("sb_token");
        window.location.hash = "";
        addToast("Password updated! Please sign in.", "success");
        setMode("login");
      }
    } catch(e) { addToast(e.message,"error"); }
    finally { setLoading(false); }
  }

  const titles = { login:"Sign In", register:"Create Account", accept:"Complete Your Account", confirm:"Check Your Email", forgot:"Reset Password", reset:"Set New Password" };
  const subs = { login:"Access your video library", register:"Join as a public viewer", accept:"Set your password to activate your account", confirm:"", forgot:"Enter your email and we'll send a reset link", reset:"Enter your new password" };

  function AuthLeftPanel() {
    return (
      <div className="auth-left">
        <div className="auth-left-content">
          <img src="/logo.png" alt="MAP65" className="auth-logo-img" />
          <div className="auth-divider" />
          <p className="auth-tagline">Video Management Platform</p>
          <div className="auth-divider" />
          <p className="auth-desc">Upload, store, annotate, and share surgical videos</p>
        </div>
      </div>
    );
  }

  if (mode === "confirm") {
    return (
      <div className="auth-screen">
        <div className="auth-wrap">
          <AuthLeftPanel />
          <div className="auth-right">
            <div className="auth-title">Check Your Email</div>
            <p className="auth-sub" style={{ marginBottom:24 }}>We sent a confirmation link to <strong style={{ color:"var(--blue-light)" }}>{email}</strong></p>
            <div className="info-box" style={{ marginBottom:20 }}>
              📧 Click the link in the email to verify your account, then come back here to sign in. Check your spam folder if you don't see it within a few minutes.
            </div>
            <button className="btn btn-ghost w-full" onClick={() => setMode("login")} style={{ justifyContent:"center" }}>
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "confirm_reset") {
    return (
      <div className="auth-screen">
        <div className="auth-wrap">
          <AuthLeftPanel />
          <div className="auth-right">
            <div className="auth-title">Check Your Email</div>
            <p className="auth-sub" style={{ marginBottom:24 }}>We sent a password reset link to <strong style={{ color:"var(--blue-light)" }}>{email}</strong></p>
            <div className="info-box" style={{ marginBottom:20 }}>
              📧 Click the link in the email to reset your password. Check your spam folder if you don't see it within a few minutes.
            </div>
            <button className="btn btn-ghost w-full" onClick={() => setMode("login")} style={{ justifyContent:"center" }}>
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-wrap">
        <div className="auth-left">
          <div className="auth-left-content">
            <img src="/logo.png" alt="MAP65" className="auth-logo-img" />
            <div className="auth-divider" />
            <p className="auth-tagline">Video Management Platform</p>
            <div className="auth-divider" />
            <p className="auth-desc">Upload, store, annotate, and share surgical videos</p>
          </div>
        </div>
        <div className="auth-right">
          <div className="auth-title">{titles[mode]}</div>
          <p className="auth-sub">{subs[mode]}</p>
          <div className="auth-form">
            {mode === "accept" && (
              <div className="field">
                <label>Your Name (optional)</label>
                <input type="text" value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Dr. Jane Smith" />
              </div>
            )}
            {(mode === "login" || mode === "register" || mode === "forgot") && (
              <div className="field">
                <label>Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@organization.com" onKeyDown={e => e.key === "Enter" && handleSubmit()} />
              </div>
            )}
            {mode !== "forgot" && (
              <div className="field">
                <label>{mode === "accept" || mode === "reset" ? "New Password" : "Password"}</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === "Enter" && handleSubmit()} />
              </div>
            )}
            {mode === "register" && (
              <div className="info-box">
                🔒 Self-registered accounts are assigned <strong>Viewer</strong> access to the Public library. To get full access, contact your organization administrator for an invitation.
              </div>
            )}
            <button className="btn btn-primary w-full" onClick={handleSubmit} disabled={loading} style={{ marginTop:8, justifyContent:"center" }}>
              {loading ? <Spinner /> : mode === "login" ? "Sign In" : mode === "register" ? "Create Account" : mode === "forgot" ? "Send Reset Link" : mode === "reset" ? "Set New Password" : "Activate Account"}
            </button>
            {mode === "login" && (
              <>
                <div className="divider" />
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <p className="text-sm text-muted">
                    No account?{" "}
                    <button style={{ background:"none", border:"none", color:"var(--blue-light)", cursor:"pointer", fontFamily:"var(--font-head)", fontSize:"13px", fontWeight:600 }}
                      onClick={() => setMode("register")}>Register</button>
                  </p>
                  <button style={{ background:"none", border:"none", color:"var(--text-muted)", cursor:"pointer", fontFamily:"var(--font-head)", fontSize:"12px" }}
                    onClick={() => setMode("forgot")}>Forgot password?</button>
                </div>
              </>
            )}
            {mode === "register" && (
              <>
                <div className="divider" />
                <p className="text-sm text-muted" style={{ textAlign:"center" }}>
                  Already have an account?{" "}
                  <button style={{ background:"none", border:"none", color:"var(--blue-light)", cursor:"pointer", fontFamily:"var(--font-head)", fontSize:"13px", fontWeight:600 }}
                    onClick={() => setMode("login")}>Sign In</button>
                </p>
              </>
            )}
            {mode === "forgot" && (
              <>
                <div className="divider" />
                <p className="text-sm text-muted" style={{ textAlign:"center" }}>
                  <button style={{ background:"none", border:"none", color:"var(--blue-light)", cursor:"pointer", fontFamily:"var(--font-head)", fontSize:"13px", fontWeight:600 }}
                    onClick={() => setMode("login")}>← Back to Sign In</button>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Upload modal ──────────────────────────────────────────────────────────────
function UploadModal({ user, companies, activeCompanyId, onClose, onSave, addToast }) {
  const [form, setForm] = useState({
    name:"", creation_date:new Date().toISOString().slice(0,10),
    description:"", specialty:SPECIALTIES[0], activity:PROCEDURES[SPECIALTIES[0]][0],
    comments:"", view_restriction:"none",
    company_id:activeCompanyId || user.company_id || companies[0]?.id, file:null,
  });
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const fileRef = useRef();

  function set(k,v) { setForm(f => ({ ...f, [k]:v })); }
  function setSpecialty(s) { setForm(f => ({ ...f, specialty:s, activity:PROCEDURES[s][0] })); }

  async function handleSave() {
    if (!form.name || !form.creation_date) { addToast("Name and date are required","error"); return; }
    setUploading(true); setUploadPercent(0);
    try {
      let file_url = null;
      if (form.file) {
        const ext = form.file.name.split(".").pop();
        const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        await uploadFileWithProgress(
          `${SUPABASE_URL}/storage/v1/object/videos/${path}`,
          form.file, localStorage.getItem("sb_token"), SUPABASE_ANON_KEY, setUploadPercent
        );
        file_url = `${SUPABASE_URL}/storage/v1/object/public/videos/${path}`;
      }
      const [video] = await supabase("videos", { method:"POST", body:JSON.stringify({
        name:form.name, creation_date:form.creation_date, description:form.description,
        specialty:form.specialty, activity:form.activity, comments:form.comments,
        view_restriction:form.view_restriction,
        company_id:form.company_id, status:"RAW", file_url, uploaded_by:user.id,
      })});
      addToast("Video uploaded successfully","success");
      onSave(video); onClose();
    } catch(e) { addToast(e.message,"error"); setUploading(false); }
  }

  const procedures = PROCEDURES[form.specialty] || ["Other"];
  const isAnnotator = user.role === "ANNOTATOR";

  return (
    <div className="modal-overlay" onClick={e => !uploading && e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Upload Video</div>
        <p className="modal-subtitle">Add a new surgical video to the library</p>
        {!uploading ? (
          <>
            <div className="form-grid">
              <div className="field full"><label>Video Name *</label><input value={form.name} onChange={e => set("name",e.target.value)} placeholder="e.g. RUL Lobectomy — Case 42" /></div>
              <div className="field"><label>Creation Date *</label><input type="date" value={form.creation_date} onChange={e => set("creation_date",e.target.value)} /></div>
              <div className="field"><label>Specialty</label>
                <select value={form.specialty} onChange={e => setSpecialty(e.target.value)}>
                  {SPECIALTIES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="field full"><label>Procedure</label>
                <select value={form.activity} onChange={e => set("activity",e.target.value)}>
                  {procedures.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="field full"><label>Description</label><textarea value={form.description} onChange={e => set("description",e.target.value)} placeholder="Describe what is shown in the video…" /></div>
              <div className="field full"><label>Comments</label>
                <textarea value={form.comments} onChange={e => set("comments",e.target.value)}
                  placeholder="Any additional notes or observations such as variant anatomy, complications, or other commentary useful for teaching/training"
                  rows={3} />
              </div>
              <div className="field full"><label>View Restriction</label>
                <select value={form.view_restriction} onChange={e => set("view_restriction",e.target.value)}>
                  {VIEW_RESTRICTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              {isAnnotator && (
                <div className="field full"><label>Organization</label>
                  <select value={form.company_id} onChange={e => set("company_id",e.target.value)}>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div className="field full">
                <label>Video File (MP4 recommended — files up to 5GB supported)</label>
                <input ref={fileRef} type="file" accept="video/*" onChange={e => set("file",e.target.files[0])}
                  style={{ padding:"8px 0", border:"none", background:"none", color:"var(--text-secondary)" }} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>Upload Video</button>
            </div>
          </>
        ) : (
          <UploadProgress percent={uploadPercent} fileName={form.file?.name || "video"} />
        )}
      </div>
    </div>
  );
}

// ── One-time link modal ──────────────────────────────────────────────────────
function LinkModal({ video, user, onClose, addToast }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [expireDays, setExpireDays] = useState(7);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => { fetchLinks(); }, []);

  async function fetchLinks() {
    setLoading(true);
    try {
      const data = await supabase(`video_links?video_id=eq.${video.id}&select=*&order=created_at.desc`);
      setLinks(data);
    } catch(e) { addToast(e.message,"error"); }
    finally { setLoading(false); }
  }

  async function createLink() {
    if (!email.trim()) { addToast("Please enter an email address","error"); return; }
    setCreating(true);
    try {
      const expiresAt = new Date(Date.now() + expireDays * 86400000).toISOString();
      const [link] = await supabase("video_links", { method:"POST", body:JSON.stringify({
        video_id: video.id,
        sent_to_email: email.trim(),
        created_by: user.id,
        expires_at: expiresAt,
      })});
      setLinks(l => [link, ...l]);
      setEmail("");
      addToast("Link created","success");
    } catch(e) { addToast(e.message,"error"); }
    finally { setCreating(false); }
  }

  async function revokeLink(id) {
    try {
      await supabase(`video_links?id=eq.${id}`, { method:"DELETE", prefer:"" });
      setLinks(l => l.filter(x => x.id !== id));
      addToast("Link revoked","info");
    } catch(e) { addToast(e.message,"error"); }
  }

  function getViewUrl(token) {
    return `${window.location.origin}/?view=${token}`;
  }

  function copyLink(link) {
    navigator.clipboard.writeText(getViewUrl(link.token));
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const activeLinks = links.filter(l => !l.viewed && new Date(l.expires_at) > new Date());
  const usedLinks = links.filter(l => l.viewed || new Date(l.expires_at) <= new Date());

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:560 }}>
        <div className="modal-title">One-Time View Links</div>
        <p className="modal-subtitle">{video.name}</p>

        <div className="form-grid" style={{ marginBottom:16 }}>
          <div className="field full"><label>Send To Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="recipient@hospital.com" onKeyDown={e => e.key === "Enter" && createLink()} />
          </div>
          <div className="field"><label>Expires After (days)</label>
            <input type="number" min="1" max="90" value={expireDays} onChange={e => setExpireDays(parseInt(e.target.value)||7)} />
          </div>
          <div className="field" style={{ justifyContent:"flex-end" }}>
            <label style={{ visibility:"hidden" }}>Create</label>
            <button className="btn btn-primary btn-sm" onClick={createLink} disabled={creating} style={{ height:42 }}>
              {creating ? <Spinner /> : "Create Link"}
            </button>
          </div>
        </div>

        {loading ? <div style={{ padding:20, display:"flex", justifyContent:"center" }}><Spinner /></div> : (
          <>
            {activeLinks.length > 0 && (
              <div className="share-section">
                <div className="share-section-title">Active Links ({activeLinks.length})</div>
                {activeLinks.map(l => (
                  <div key={l.id} className="link-row">
                    <div>
                      <div style={{ color:"var(--text)", fontSize:13 }}>{l.sent_to_email}</div>
                      <div style={{ fontSize:11, color:"var(--text-muted)" }}>
                        Expires {new Date(l.expires_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button className="action-btn action-view" onClick={() => copyLink(l)}>
                        {copiedId === l.id ? "✓ Copied" : "Copy Link"}
                      </button>
                      <button className="action-btn action-delete" onClick={() => revokeLink(l.id)}>Revoke</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {usedLinks.length > 0 && (
              <div className="share-section">
                <div className="share-section-title">Used / Expired ({usedLinks.length})</div>
                {usedLinks.map(l => (
                  <div key={l.id} className="link-row">
                    <div>
                      <div style={{ color:"var(--text-muted)", fontSize:13 }}>{l.sent_to_email}</div>
                      <div style={{ fontSize:11, color:"var(--text-muted)" }}>
                        {l.viewed ? `Viewed ${new Date(l.viewed_at).toLocaleDateString()} by ${l.viewer_email || "unknown"}` : "Expired"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {links.length === 0 && (
              <p style={{ color:"var(--text-muted)", fontSize:13, padding:"12px 0" }}>No links created yet.</p>
            )}
          </>
        )}

        <div className="modal-actions">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Video detail modal ────────────────────────────────────────────────────────
function VideoDetailModal({ video, user, onClose, onStatusChange, addToast }) {
  const [loading, setLoading] = useState(false);
  const [hasViewed, setHasViewed] = useState(false);
  const [checkingView, setCheckingView] = useState(true);
  const [showLinks, setShowLinks] = useState(false);

  useEffect(() => { checkViewStatus(); }, []);

  async function checkViewStatus() {
    setCheckingView(true);
    try {
      if (video.view_restriction === "none") { setHasViewed(false); setCheckingView(false); return; }
      const views = await supabase(`video_views?video_id=eq.${video.id}&viewer_id=eq.${user.id}&select=id`);
      setHasViewed(views.length > 0);
    } catch(e) { /* allow viewing if check fails */ }
    finally { setCheckingView(false); }
  }

  async function recordView() {
    try {
      await supabase("video_views", { method:"POST", body:JSON.stringify({
        video_id: video.id,
        viewer_id: user.id,
        viewer_email: user.email,
        viewer_org_id: user.company_id,
        is_external: false,
        email_verified: true,
      })});
    } catch(e) { /* silent fail - don't block viewing */ }
  }

  async function submitForAnnotation() {
    setLoading(true);
    try {
      await supabase(`videos?id=eq.${video.id}`, { method:"PATCH", body:JSON.stringify({ status:"IN_PROCESSING" }) });
      addToast("Submitted for annotation","success");
      onStatusChange(video.id,"IN_PROCESSING"); onClose();
    } catch(e) { addToast(e.message,"error"); }
    finally { setLoading(false); }
  }

  async function markAnnotated() {
    setLoading(true);
    try {
      await supabase(`videos?id=eq.${video.id}`, { method:"PATCH", body:JSON.stringify({ status:"ANNOTATED" }) });
      addToast("Annotation complete","success");
      onStatusChange(video.id,"ANNOTATED"); onClose();
    } catch(e) { addToast(e.message,"error"); }
    finally { setLoading(false); }
  }

  return (
    <>
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:620 }}>
        <div className="modal-title">{video.name}</div>
        <div style={{ marginBottom:20, display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          <StatusBadge status={video.status} />
          {video.is_public && <span className="share-tag share-tag-public">🌐 Public</span>}
          {video.view_restriction !== "none" && <span className="restriction-badge restriction-once">👁 One View</span>}
        </div>
        {checkingView ? (
          <div style={{ padding:40, display:"flex", justifyContent:"center" }}><Spinner /></div>
        ) : hasViewed ? (
          <div className="info-box" style={{ textAlign:"center", padding:"24px" }}>
            👁 You have already viewed this video. Access is restricted to one view per user.
          </div>
        ) : video.file_url ? (
          <video className="video-player" controls src={video.file_url} onPlay={recordView} />
        ) : null}
        <div className="detail-grid">
          <span className="detail-label">Organization</span><span className="detail-value">{video.companies?.name || "—"}</span>
          <span className="detail-label">Date</span><span className="detail-value">{video.creation_date}</span>
          <span className="detail-label">Specialty</span><span className="detail-value">{video.specialty || "—"}</span>
          <span className="detail-label">Procedure</span><span className="detail-value">{video.activity || "—"}</span>
          <span className="detail-label">View Restriction</span><span className="detail-value">{VIEW_RESTRICTIONS.find(r => r.value === video.view_restriction)?.label || "Unrestricted"}</span>
          <span className="detail-label">Description</span><span className="detail-value">{video.description || "—"}</span>
          <span className="detail-label">Comments</span><span className="detail-value">{video.comments || "—"}</span>
        </div>
        <div className="modal-actions">
          {video.status === "RAW" && canDo(user.role,"upload") && video.company_id === user.company_id && (
            <button className="btn btn-primary btn-sm" onClick={submitForAnnotation} disabled={loading}>{loading ? <Spinner /> : "▶ Submit for Annotation"}</button>
          )}
          {video.status === "IN_PROCESSING" && canDo(user.role,"annotate") && (
            <button className="btn btn-sm" style={{ background:"rgba(56,200,120,0.15)", color:"var(--annotated)", border:"1px solid rgba(56,200,120,0.4)", borderRadius:"var(--r)", cursor:"pointer", fontFamily:"var(--font-head)", fontSize:"12px", fontWeight:700, padding:"6px 14px", textTransform:"uppercase" }}
              onClick={markAnnotated} disabled={loading}>{loading ? <Spinner /> : "✓ Mark Annotation Complete"}</button>
          )}
          {canDo(user.role,"download") && video.file_url && (
            <a className="btn btn-ghost btn-sm" href={video.file_url} download target="_blank" rel="noreferrer">⬇ Download</a>
          )}
          {canDo(user.role,"share") && video.company_id === user.company_id && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowLinks(true)}>🔗 One-Time Links</button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
    {showLinks && <LinkModal video={video} user={user} onClose={() => setShowLinks(false)} addToast={addToast} />}
    </>
  );
}

// ── Company modal (with optional superuser invite) ────────────────────────────
function CompanyModal({ company, onClose, onSave, addToast, appUrl }) {
  const [name, setName] = useState(company?.name || "");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [loading, setLoading] = useState(false);
  const isNew = !company;

  async function handleSave() {
    if (!name.trim()) { addToast("Organization name required","error"); return; }
    if (isNew && !adminEmail.trim()) { addToast("Admin email is required for new organizations","error"); return; }
    setLoading(true);
    try {
      let companyId;
      if (company) {
        await supabase(`companies?id=eq.${company.id}`, { method:"PATCH", body:JSON.stringify({ name }) });
        addToast("Organization updated","success");
        onClose(); return;
      } else {
        const [c] = await supabase("companies", { method:"POST", body:JSON.stringify({ name }) });
        companyId = c.id;
        onSave(c);
      }

      // Create invitation record
      await supabase("invitations", { method:"POST", body:JSON.stringify({
        email: adminEmail.trim(),
        name: adminName.trim() || null,
        company_id: companyId,
        role: "ORGADMIN",
        invited_by: user?.id || null,
      })});

      // Send Supabase invite email
      await inviteUser(adminEmail.trim(), appUrl);
      addToast(`Organization created and invite sent to ${adminEmail}`,"success");
      onClose();
    } catch(e) { addToast(e.message,"error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:480 }}>
        <div className="modal-title">{company ? "Edit Organization" : "New Organization"}</div>
        <p className="modal-subtitle">{isNew ? "Create a new organization and invite its administrator" : "Update organization details"}</p>
        <div className="form-grid">
          <div className="field full"><label>Organization Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Johns Hopkins Medicine" onKeyDown={e => !isNew && e.key === "Enter" && handleSave()} />
          </div>
          {isNew && (
            <>
              <div className="divider" style={{ gridColumn:"1/-1", margin:"4px 0" }} />
              <p style={{ gridColumn:"1/-1", fontSize:12, color:"var(--text-muted)", marginBottom:4 }}>
                The administrator will receive an email invitation to create their account with ORGADMIN access.
              </p>
              <div className="field"><label>Admin Name (optional)</label>
                <input value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="Dr. Jane Smith" />
              </div>
              <div className="field"><label>Admin Email *</label>
                <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="admin@organization.com" />
              </div>
            </>
          )}
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>{isNew ? "Cancel" : "Close"}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? <Spinner /> : isNew ? "Create & Send Invite" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Users tab ─────────────────────────────────────────────────────────────────
function UsersTab({ user, companies, addToast, activeCompanyId, appUrl }) {
  const [users, setUsers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("VIEWER");
  // For annotators, default to their own company or first available company
  const defaultCompanyId = activeCompanyId || user.company_id || (companies[0]?.id);
  const [inviteCompanyId, setInviteCompanyId] = useState(defaultCompanyId);
  const [sending, setSending] = useState(false);

  // Always resolve to a valid company ID
  const targetCompanyId = user.role === "ANNOTATOR"
    ? (inviteCompanyId || defaultCompanyId)
    : user.company_id;

  useEffect(() => {
    if (activeCompanyId && user.role === "ANNOTATOR") {
      setInviteCompanyId(activeCompanyId);
    }
    fetchData();
  }, [activeCompanyId]);

  async function fetchData() {
    setLoading(true);
    try {
      const companyFilter = user.role === "ANNOTATOR"
        ? (activeCompanyId ? `&company_id=eq.${activeCompanyId}` : "")
        : `&company_id=eq.${user.company_id}`;
      const [u, i] = await Promise.all([
        supabase(`profiles?select=*,companies(name)&order=created_at.desc${companyFilter}`),
        supabase(`invitations?select=*,companies(name)&order=created_at.desc${activeCompanyId && user.role === "ANNOTATOR" ? `&company_id=eq.${activeCompanyId}` : user.role !== "ANNOTATOR" ? `&company_id=eq.${user.company_id}` : ""}`),
      ]);
      setUsers(u); setInvitations(i);
    } catch(e) { addToast(e.message,"error"); }
    finally { setLoading(false); }
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) { addToast("Email is required","error"); return; }
    if (!targetCompanyId) { addToast("Please select an organization first","error"); return; }
    setSending(true);
    try {
      // Check if invitation already exists
      const existing = await supabase(`invitations?email=eq.${encodeURIComponent(inviteEmail.trim())}&company_id=eq.${targetCompanyId}&accepted=eq.false&select=id`);
      if (existing.length) { addToast("An invitation already exists for this email","error"); setSending(false); return; }

      const finalRole = isPublicOrg(targetCompanyId) ? "VIEWER" : effectiveRole;
      await supabase("invitations", { method:"POST", body:JSON.stringify({
        email: inviteEmail.trim(),
        name: inviteName.trim() || null,
        company_id: targetCompanyId,
        role: finalRole,
        invited_by: user.id,
      })});
      await inviteUser(inviteEmail.trim(), appUrl);
      addToast(`Invitation sent to ${inviteEmail}`,"success");
      setInviteEmail(""); setInviteName("");
      fetchData();
    } catch(e) { addToast(e.message,"error"); }
    finally { setSending(false); }
  }

  const [movingUser, setMovingUser] = useState(null);
  const [moveToCompanyId, setMoveToCompanyId] = useState("");
  const [moveToRole, setMoveToRole] = useState("VIEWER");
  const [moveLoading, setMoveLoading] = useState(false);

  async function changeRole(profileId, newRole) {
    try {
      await supabase(`profiles?id=eq.${profileId}`, { method:"PATCH", body:JSON.stringify({ role:newRole }) });
      setUsers(us => us.map(u => u.id === profileId ? { ...u, role:newRole } : u));
      addToast("Role updated","success");
    } catch(e) { addToast(e.message,"error"); }
  }

  async function moveUser() {
    if (!moveToCompanyId) { addToast("Please select an organization","error"); return; }
    setMoveLoading(true);
    try {
      await supabase(`profiles?id=eq.${movingUser.id}`, {
        method:"PATCH",
        body:JSON.stringify({ company_id:moveToCompanyId, role:moveToRole })
      });
      setUsers(us => us.map(u => u.id === movingUser.id
        ? { ...u, company_id:moveToCompanyId, role:moveToRole, companies:{ name: companies.find(c => c.id === moveToCompanyId)?.name } }
        : u
      ));
      addToast("User moved successfully","success");
      setMovingUser(null);
    } catch(e) { addToast(e.message,"error"); }
    finally { setMoveLoading(false); }
  }

  async function revokeInvite(id) {
    try {
      await supabase(`invitations?id=eq.${id}`, { method:"DELETE", prefer:"" });
      setInvitations(is => is.filter(i => i.id !== id));
      addToast("Invitation revoked","info");
    } catch(e) { addToast(e.message,"error"); }
  }

  // Users can only invite at their own level or below
  // ANNOTATOR can invite any role
  // ORGADMIN can invite up to ORGADMIN (not ANNOTATOR)
  // Others can only invite VIEWER
  const availableRoles = user.role === "ANNOTATOR"
    ? ["VIEWER","EDITOR","ORGADMIN","ANNOTATOR"]
    : user.role === "ORGADMIN"
    ? ["VIEWER","EDITOR","ORGADMIN"]
    : ["VIEWER"];
  // Ensure current inviteRole is valid for this user
  const effectiveRole = availableRoles.includes(inviteRole) ? inviteRole : "VIEWER";
  const isPublic = isPublicOrg(targetCompanyId);

  return (
    <div>
      <div className="page-header">
        <div className="page-title">User <span>Management</span></div>
      </div>

      {/* Invite box */}
      <div className="invite-box">
        <div className="invite-box-title">Invite New User</div>
        {isPublic && (
          <div className="info-box" style={{ marginBottom:16 }}>
            ℹ Users in the <strong>Public</strong> organization are limited to Viewer access only.
          </div>
        )}
        <div className="invite-grid">
          <div className="field">
            <label>Name (optional)</label>
            <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Dr. Jane Smith" />
          </div>
          <div className="field">
            <label>Email Address *</label>
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="user@organization.com" onKeyDown={e => e.key === "Enter" && sendInvite()} />
          </div>
          <div className="field">
            <label>Role</label>
            <select value={isPublic ? "VIEWER" : effectiveRole} onChange={e => setInviteRole(e.target.value)} disabled={isPublic}>
              {availableRoles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {user.role === "ANNOTATOR" && (
            <div className="field">
              <label>Organization</label>
              <select value={inviteCompanyId} onChange={e => setInviteCompanyId(e.target.value)}>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div className="field" style={{ justifyContent:"flex-end" }}>
            <label style={{ visibility:"hidden" }}>Send</label>
            <button className="btn btn-primary btn-sm" onClick={sendInvite} disabled={sending} style={{ height:42 }}>
              {sending ? <Spinner /> : "Send Invite"}
            </button>
          </div>
        </div>
      </div>

      {/* Pending invitations */}
      {invitations.filter(i => !i.accepted).length > 0 && (
        <div style={{ marginBottom:24 }}>
          <div style={{ fontFamily:"var(--font-head)", fontSize:14, fontWeight:700, color:"var(--text-secondary)", textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>
            Pending Invitations
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Email</th><th>Name</th><th>Role</th><th>Organization</th><th>Sent</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {invitations.filter(i => !i.accepted).map(inv => (
                  <tr key={inv.id}>
                    <td style={{ color:"var(--text)" }}>{inv.email}</td>
                    <td style={{ color:"var(--text-secondary)" }}>{inv.name || "—"}</td>
                    <td><RoleBadge role={inv.role} /></td>
                    <td style={{ color:"var(--text-secondary)" }}>{inv.companies?.name || "—"}</td>
                    <td style={{ color:"var(--text-muted)", fontSize:12, fontFamily:"monospace" }}>{inv.created_at?.slice(0,10)}</td>
                    <td>
                      <button className="action-btn action-delete" onClick={() => revokeInvite(inv.id)}>Revoke</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active users */}
      <div style={{ fontFamily:"var(--font-head)", fontSize:14, fontWeight:700, color:"var(--text-secondary)", textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>
        Active Users
      </div>
      <div className="table-wrap">
        {loading ? (
          <div style={{ padding:60, display:"flex", justifyContent:"center" }}><Spinner /></div>
        ) : users.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">👥</div>
            <h3>No Users Yet</h3>
            <p>Invite users above to get started.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr><th>Email</th><th>Name</th><th>Role</th><th>Organization</th><th>Joined</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ color:"var(--text)" }}>{u.email}</td>
                  <td style={{ color:"var(--text-secondary)" }}>{u.name || "—"}</td>
                  <td><RoleBadge role={u.role} /></td>
                  <td style={{ color:"var(--text-secondary)" }}>{u.companies?.name || "—"}</td>
                  <td style={{ color:"var(--text-muted)", fontSize:12, fontFamily:"monospace" }}>{u.created_at?.slice(0,10)}</td>
                  <td>
                    {u.id === user.id ? (
                      <span style={{ fontSize:12, color:"var(--text-muted)" }}>You</span>
                    ) : isPublicOrg(u.company_id) ? (
                      <button className="action-btn action-share" onClick={() => { setMovingUser(u); setMoveToCompanyId(user.role === "ANNOTATOR" ? companies.find(c => !isPublicOrg(c.id) && !c.suspended)?.id || "" : user.company_id); setMoveToRole("VIEWER"); }}>
                        Move to Org
                      </button>
                    ) : (
                      <select className="filter-select" style={{ padding:"4px 10px", fontSize:11 }}
                        value={u.role}
                        onChange={e => changeRole(u.id, e.target.value)}>
                        {availableRoles.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Move User Modal */}
      {movingUser && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setMovingUser(null)}>
          <div className="modal" style={{ maxWidth:440 }}>
            <div className="modal-title">Move User to Organization</div>
            <p className="modal-subtitle">{movingUser.email}</p>
            <div className="info-box" style={{ marginBottom:20 }}>
              This will move the user out of the Public library and into a real organization with full access based on their assigned role.
            </div>
            <div className="form-grid">
              <div className="field full">
                <label>Organization *</label>
                <select value={moveToCompanyId} onChange={e => setMoveToCompanyId(e.target.value)}>
                  <option value="">Select organization…</option>
                  {(user.role === "ANNOTATOR"
                    ? companies.filter(c => !isPublicOrg(c.id) && !c.suspended)
                    : companies.filter(c => c.id === user.company_id)
                  ).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field full">
                <label>Assign Role</label>
                <select value={moveToRole} onChange={e => setMoveToRole(e.target.value)}>
                  {availableRoles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setMovingUser(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={moveUser} disabled={moveLoading}>
                {moveLoading ? <Spinner /> : "Move User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Videos tab ────────────────────────────────────────────────────────────────
function VideosTab({ user, companies, activeCompanyId, addToast }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [specialtyFilter, setSpecialtyFilter] = useState("ALL");
  const [showUpload, setShowUpload] = useState(false);
  const [selected, setSelected] = useState(null);
  const [sharing, setSharing] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { fetchVideos(); }, [activeCompanyId]);

  async function fetchVideos() {
    setLoading(true);
    try {
      let q = "videos?select=*,companies(name)&hidden=eq.false&order=created_at.desc";
      // ANNOTATOR: filter by selected org if one is chosen in the switcher
      // All other roles: let RLS handle visibility (own company + shared + public)
      // This ensures shared videos are visible without extra filtering
      if (user.role === "ANNOTATOR" && activeCompanyId) {
        q += `&company_id=eq.${activeCompanyId}`;
      }
      setVideos(await supabase(q));
    } catch(e) { addToast(e.message,"error"); }
    finally { setLoading(false); }
  }

  function handleStatusChange(id, status) { setVideos(vs => vs.map(v => v.id === id ? { ...v, status } : v)); }
  function handleUpdate(updated) { setVideos(vs => vs.map(v => v.id === updated.id ? { ...v, ...updated } : v)); }

  async function handleRemove(video) {
    setActionLoading(true);
    try {
      await supabase(`videos?id=eq.${video.id}`, { method:"PATCH", body:JSON.stringify({ hidden:true }) });
      setVideos(vs => vs.filter(v => v.id !== video.id));
      addToast("Video removed from your list","info");
    } catch(e) { addToast(e.message,"error"); }
    finally { setActionLoading(false); setConfirming(null); }
  }

  async function handleDelete(video) {
    setActionLoading(true);
    try {
      if (video.file_url) {
        const path = video.file_url.split("/videos/")[1];
        if (path) await fetch(`${SUPABASE_URL}/storage/v1/object/videos/${path}`, {
          method:"DELETE",
          headers: { apikey:SUPABASE_ANON_KEY, Authorization:`Bearer ${localStorage.getItem("sb_token")}` },
        });
      }
      await supabase(`videos?id=eq.${video.id}`, { method:"DELETE", prefer:"" });
      setVideos(vs => vs.filter(v => v.id !== video.id));
      addToast("Video permanently deleted","success");
    } catch(e) { addToast(e.message,"error"); }
    finally { setActionLoading(false); setConfirming(null); }
  }

  const isOwner = v => v.company_id === user.company_id || (user.role === "ANNOTATOR" && v.company_id === activeCompanyId);

  const filtered = videos.filter(v => {
    const s = search.toLowerCase();
    return (!s || v.name.toLowerCase().includes(s) || (v.description||"").toLowerCase().includes(s) || (v.specialty||"").toLowerCase().includes(s) || (v.activity||"").toLowerCase().includes(s))
      && (statusFilter === "ALL" || v.status === statusFilter)
      && (specialtyFilter === "ALL" || v.specialty === specialtyFilter);
  });

  const counts = {
    RAW:           videos.filter(v => v.status === "RAW").length,
    IN_PROCESSING: videos.filter(v => v.status === "IN_PROCESSING").length,
    ANNOTATED:     videos.filter(v => v.status === "ANNOTATED").length,
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Video <span>Library</span></div>
        {canDo(user.role,"upload") && (
          <button className="btn btn-primary btn-sm ml-auto" onClick={() => setShowUpload(true)}>+ Upload Video</button>
        )}
      </div>

      <div className="stats-bar">
        <div className="stat-card"><div className="stat-icon">🎬</div><div><div className="stat-number" style={{ color:"var(--raw)" }}>{counts.RAW}</div><div className="stat-label">Native</div></div></div>
        <div className="stat-card"><div className="stat-icon">⚙️</div><div><div className="stat-number" style={{ color:"var(--processing)" }}>{counts.IN_PROCESSING}</div><div className="stat-label">Annotation in Process</div></div></div>
        <div className="stat-card"><div className="stat-icon">✅</div><div><div className="stat-number" style={{ color:"var(--annotated)" }}>{counts.ANNOTATED}</div><div className="stat-label">Annotation Complete</div></div></div>
      </div>

      <div className="table-wrap">
        <div className="toolbar">
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input className="search-input" placeholder="Search videos…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="ALL">All Status</option>
            <option value="RAW">Native</option>
            <option value="IN_PROCESSING">Annotation in Process</option>
            <option value="ANNOTATED">Annotation Complete</option>
          </select>
          <select className="filter-select" value={specialtyFilter} onChange={e => setSpecialtyFilter(e.target.value)}>
            <option value="ALL">All Specialties</option>
            {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm ml-auto" onClick={fetchVideos}>↻ Refresh</button>
        </div>

        {loading ? (
          <div style={{ padding:60, display:"flex", justifyContent:"center" }}><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🎬</div>
            <h3>No Videos Found</h3>
            <p>{canDo(user.role,"upload") ? "Upload your first video to get started." : "No videos are available for your account."}</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr><th>Video</th><th>Status</th><th>Specialty</th><th>Procedure</th><th>Organization</th><th>Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <tr key={v.id}>
                  <td>
                    <div className="video-name">
                      {v.name}
                      {v.is_public && <span className="share-tag share-tag-public">🌐 Public</span>}
                    </div>
                    <div className="video-desc">{v.description}</div>
                  </td>
                  <td><StatusBadge status={v.status} /></td>
                  <td style={{ color:"var(--text-secondary)" }}>{v.specialty||"—"}</td>
                  <td style={{ color:"var(--text-secondary)" }}>{v.activity||"—"}</td>
                  <td style={{ color:"var(--text-secondary)" }}>{v.companies?.name||"—"}</td>
                  <td style={{ color:"var(--text-muted)", fontFamily:"monospace", fontSize:12 }}>{v.creation_date}</td>
                  <td>
                    <div className="actions">
                      <button className="action-btn action-view" onClick={() => setSelected(v)}>▶ View</button>
                      {v.status === "RAW" && canDo(user.role,"upload") && isOwner(v) && (
                        <button className="action-btn action-submit" onClick={() => setSelected(v)}>Submit</button>
                      )}
                      {v.status === "IN_PROCESSING" && canDo(user.role,"annotate") && (
                        <button className="action-btn action-annotate" onClick={() => setSelected(v)}>Annotate</button>
                      )}
                      {canDo(user.role,"download") && v.file_url && (
                        <a className="action-btn action-download" href={v.file_url} download>⬇</a>
                      )}
                      {canDo(user.role,"share") && isOwner(v) && (
                        <button className="action-btn action-share" onClick={() => setSharing(v)}>⤴ Share</button>
                      )}
                      <button className="action-btn action-remove" onClick={() => setConfirming({ type:"remove", video:v })} title="Remove from list">✕</button>
                      {canDo(user.role,"delete") && isOwner(v) && (
                        <button className="action-btn action-delete" onClick={() => setConfirming({ type:"delete", video:v })} title="Permanently delete">🗑</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showUpload && <UploadModal user={user} companies={companies} activeCompanyId={activeCompanyId} onClose={() => setShowUpload(false)} onSave={v => setVideos(p => [v,...p])} addToast={addToast} />}
      {selected && <VideoDetailModal video={selected} user={user} onClose={() => setSelected(null)} onStatusChange={handleStatusChange} addToast={addToast} />}
      {sharing && <ShareModal video={sharing} user={user} companies={companies} onClose={() => setSharing(null)} onUpdate={handleUpdate} addToast={addToast} />}

      {confirming?.type === "remove" && (
        <ConfirmModal title="Remove Video" body={`Remove "${confirming.video.name}" from your list? The video still exists for other users.`}
          confirmLabel="Remove" confirmClass="btn-ghost"
          onConfirm={() => handleRemove(confirming.video)} onClose={() => setConfirming(null)} loading={actionLoading} />
      )}
      {confirming?.type === "delete" && (
        <ConfirmModal title="Delete Video" body={`Permanently delete "${confirming.video.name}"?`}
          warning="This will delete the video file and all associated data. This cannot be undone."
          confirmLabel="Delete Permanently" confirmClass="btn-danger"
          onConfirm={() => handleDelete(confirming.video)} onClose={() => setConfirming(null)} loading={actionLoading} />
      )}
    </div>
  );
}

// ── Organizations tab ─────────────────────────────────────────────────────────
function OrgsTab({ companies, setCompanies, addToast, appUrl }) {
  const [showModal, setShowModal] = useState(false);
  const [edit, setEdit] = useState(null);

  async function toggleSuspend(c) {
    if (isPublicOrg(c.id)) { addToast("The Public organization cannot be suspended","error"); return; }
    try {
      await supabase(`companies?id=eq.${c.id}`, { method:"PATCH", body:JSON.stringify({ suspended:!c.suspended }) });
      setCompanies(cs => cs.map(x => x.id === c.id ? { ...x, suspended:!x.suspended } : x));
      addToast(`Organization ${!c.suspended ? "suspended" : "reactivated"}`,"success");
    } catch(e) { addToast(e.message,"error"); }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Organizations</div>
        <button className="btn btn-primary btn-sm ml-auto" onClick={() => { setEdit(null); setShowModal(true); }}>+ New Organization</button>
      </div>
      <div className="company-grid">
        {companies.map(c => (
          <div key={c.id} className={`company-card ${c.suspended ? "suspended" : ""}`}>
            <h3>
              {c.name}
              {isPublicOrg(c.id) && <span className="public-org-tag">Public</span>}
              {c.suspended && <span className="suspended-tag">Suspended</span>}
            </h3>
            <div className="meta">{c.id?.slice(0,12)}…</div>
            <div className="flex gap-2">
              {!isPublicOrg(c.id) && (
                <>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setEdit(c); setShowModal(true); }}>Edit</button>
                  <button className={`btn btn-sm ${c.suspended ? "btn-ghost" : "btn-danger"}`} onClick={() => toggleSuspend(c)}>
                    {c.suspended ? "Reactivate" : "Suspend"}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {companies.length === 0 && (
          <div className="empty" style={{ gridColumn:"1/-1" }}>
            <div className="empty-icon">🏢</div><h3>No Organizations</h3>
            <p>Create your first organization to get started.</p>
          </div>
        )}
      </div>
      {showModal && (
        <CompanyModal company={edit} onClose={() => setShowModal(false)}
          onSave={c => setCompanies(p => [...p, c])} addToast={addToast} appUrl={appUrl} />
      )}
    </div>
  );
}

// ── External view page ───────────────────────────────────────────────────────
function ExternalViewPage({ token, addToast }) {
  const [link, setLink] = useState(null);
  const [video, setVideo] = useState(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [watched, setWatched] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { fetchLink(); }, []);

  async function fetchLink() {
    try {
      const links = await supabase(`video_links?token=eq.${token}&select=*,videos(*,companies(name))`);
      if (!links.length) { setError("This link is invalid or does not exist."); return; }
      const l = links[0];
      if (l.viewed) { setError("This link has already been used."); return; }
      if (new Date(l.expires_at) < new Date()) { setError("This link has expired."); return; }
      setLink(l);
      setVideo(l.videos);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleSubmitEmail() {
    if (!email.trim()) { addToast("Please enter your email","error"); return; }
    setSubmitted(true);
  }

  async function handleVideoPlay() {
    if (watched) return;
    setWatched(true);
    try {
      // Mark link as viewed
      await supabase(`video_links?id=eq.${link.id}`, {
        method:"PATCH",
        body:JSON.stringify({ viewed:true, viewed_at:new Date().toISOString(), viewer_email:email }),
      });
      // Record view
      await supabase("video_views", { method:"POST", body:JSON.stringify({
        video_id: video.id,
        viewer_email: email,
        link_id: link.id,
        is_external: true,
        email_verified: email.toLowerCase() === link.sent_to_email.toLowerCase(),
      })});
    } catch(e) { /* silent */ }
  }

  if (loading) return (
    <div className="external-page">
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16 }}>
        <img src="/logo.png" alt="MAP65" style={{ width:160 }} />
        <Spinner />
      </div>
    </div>
  );

  if (error) return (
    <div className="external-page">
      <div className="external-card" style={{ textAlign:"center" }}>
        <img src="/logo.png" alt="MAP65" style={{ width:160, marginBottom:24 }} />
        <div className="external-title">Link Unavailable</div>
        <p style={{ color:"var(--text-secondary)", marginTop:8 }}>{error}</p>
      </div>
    </div>
  );

  return (
    <div className="external-page">
      <div className="external-card">
        <img src="/logo.png" alt="MAP65" style={{ width:140, marginBottom:24 }} />
        <div className="external-title">{video?.name}</div>
        <p className="external-sub">{video?.companies?.name} — {video?.specialty} / {video?.activity}</p>

        {!submitted ? (
          <>
            <div className="info-box">Please enter your email address to access this video. This link is for one-time use only.</div>
            <div className="field" style={{ marginBottom:16 }}>
              <label>Your Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com" onKeyDown={e => e.key === "Enter" && handleSubmitEmail()} />
            </div>
            <button className="btn btn-primary w-full" onClick={handleSubmitEmail} style={{ justifyContent:"center" }}>
              Access Video
            </button>
          </>
        ) : (
          <>
            {video?.file_url ? (
              <video
                style={{ width:"100%", borderRadius:"var(--r)", background:"#000", marginBottom:16 }}
                controls
                src={video.file_url}
                onPlay={handleVideoPlay}
              />
            ) : (
              <div className="info-box">No video file is attached to this record.</div>
            )}
            {watched && (
              <div className="info-box" style={{ textAlign:"center" }}>
                ✓ Your view has been recorded. This link is now expired.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Stats tab ─────────────────────────────────────────────────────────────────
function StatsTab({ user, companies, addToast }) {
  const [myVideosStats, setMyVideosStats] = useState([]);
  const [orgViewedStats, setOrgViewedStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCompanyId, setActiveCompanyId] = useState(
    user.role === "ANNOTATOR" ? "" : user.company_id
  );

  useEffect(() => { fetchStats(); }, [activeCompanyId]);

  async function fetchStats() {
    setLoading(true);
    try {
      const companyId = activeCompanyId || user.company_id;

      // Videos owned by this org and their views
      const videos = await supabase(
        `videos?company_id=eq.${companyId}&select=id,name,specialty,activity,status,view_restriction,created_at`
      );

      if (videos.length) {
        const videoIds = videos.map(v => `"${v.id}"`).join(",");
        const views = await supabase(
          `video_views?video_id=in.(${videoIds})&select=*&order=viewed_at.desc`
        );
        const viewsByVideo = {};
        views.forEach(v => {
          if (!viewsByVideo[v.video_id]) viewsByVideo[v.video_id] = [];
          viewsByVideo[v.video_id].push(v);
        });
        setMyVideosStats(videos.map(v => ({ ...v, views: viewsByVideo[v.id] || [] })));
      } else {
        setMyVideosStats([]);
      }

      // Views by members of this org
      const orgViews = await supabase(
        `video_views?viewer_org_id=eq.${companyId}&select=*,videos(name,specialty,activity)&order=viewed_at.desc&limit=50`
      );
      setOrgViewedStats(orgViews);
    } catch(e) { addToast(e.message,"error"); }
    finally { setLoading(false); }
  }

  const totalViews = myVideosStats.reduce((sum, v) => sum + v.views.length, 0);
  const totalVideos = myVideosStats.length;
  const externalViews = myVideosStats.reduce((sum, v) => sum + v.views.filter(x => x.is_external).length, 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Viewing <span>Statistics</span></div>
        {user.role === "ANNOTATOR" && (
          <select className="filter-select ml-auto" value={activeCompanyId} onChange={e => setActiveCompanyId(e.target.value)}>
            {companies.filter(c => !isPublicOrg(c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {/* Summary cards */}
      <div className="stats-bar" style={{ gridTemplateColumns:"repeat(3,1fr)", marginBottom:24 }}>
        <div className="stat-card"><div className="stat-icon">🎬</div><div><div className="stat-number">{totalVideos}</div><div className="stat-label">Videos Owned</div></div></div>
        <div className="stat-card"><div className="stat-icon">👁</div><div><div className="stat-number">{totalViews}</div><div className="stat-label">Total Views</div></div></div>
        <div className="stat-card"><div className="stat-icon">🔗</div><div><div className="stat-number">{externalViews}</div><div className="stat-label">External Views</div></div></div>
      </div>

      {loading ? (
        <div style={{ padding:60, display:"flex", justifyContent:"center" }}><Spinner /></div>
      ) : (
        <>
          {/* My org's videos and who viewed them */}
          <div style={{ fontFamily:"var(--font-head)", fontSize:16, fontWeight:700, color:"var(--white)", textTransform:"uppercase", letterSpacing:1, marginBottom:16 }}>
            My Organization's Videos
          </div>
          {myVideosStats.length === 0 ? (
            <div className="empty" style={{ padding:40 }}>
              <div className="empty-icon">🎬</div>
              <h3>No Videos Yet</h3>
              <p>Upload videos to see statistics here.</p>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:16, marginBottom:32 }}>
              {myVideosStats.map(v => (
                <div key={v.id} className="table-wrap">
                  <div style={{ padding:"14px 20px", background:"var(--surface2)", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, color:"var(--white)", fontSize:14 }}>{v.name}</div>
                      <div style={{ fontSize:12, color:"var(--text-muted)" }}>{v.specialty} / {v.activity}</div>
                    </div>
                    <div style={{ display:"flex", gap:12, fontSize:12, color:"var(--text-secondary)" }}>
                      <span>{v.views.length} view{v.views.length !== 1 ? "s" : ""}</span>
                      {v.views.filter(x => x.is_external).length > 0 && (
                        <span style={{ color:"var(--share)" }}>{v.views.filter(x => x.is_external).length} external</span>
                      )}
                    </div>
                  </div>
                  {v.views.length === 0 ? (
                    <div style={{ padding:"16px 20px", color:"var(--text-muted)", fontSize:13 }}>No views yet.</div>
                  ) : (
                    <div style={{ padding:"0 20px" }}>
                      {v.views.slice(0, 10).map(vw => (
                        <div key={vw.id} className="view-row">
                          <div className="view-email">
                            {vw.viewer_email || "Anonymous"}
                            {vw.is_external && <span className="external-tag">External</span>}
                            {vw.email_verified && <span className="verified-tag">✓ Verified</span>}
                          </div>
                          <div className="view-meta">{new Date(vw.viewed_at).toLocaleDateString()}</div>
                        </div>
                      ))}
                      {v.views.length > 10 && (
                        <div style={{ padding:"10px 0", fontSize:12, color:"var(--text-muted)" }}>
                          +{v.views.length - 10} more views
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* What this org has watched */}
          <div style={{ fontFamily:"var(--font-head)", fontSize:16, fontWeight:700, color:"var(--white)", textTransform:"uppercase", letterSpacing:1, marginBottom:16 }}>
            Viewed by This Organization
          </div>
          {orgViewedStats.length === 0 ? (
            <div className="empty" style={{ padding:40 }}>
              <div className="empty-icon">👁</div>
              <h3>No Views Yet</h3>
              <p>Views by organization members will appear here.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Video</th><th>Specialty</th><th>Viewer</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {orgViewedStats.map(vw => (
                    <tr key={vw.id}>
                      <td style={{ color:"var(--text)", fontWeight:500 }}>{vw.videos?.name || "—"}</td>
                      <td style={{ color:"var(--text-secondary)", fontSize:12 }}>{vw.videos?.specialty || "—"}</td>
                      <td style={{ color:"var(--text-secondary)" }}>{vw.viewer_email || "—"}</td>
                      <td style={{ color:"var(--text-muted)", fontFamily:"monospace", fontSize:12 }}>{new Date(vw.viewed_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── App root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("videos");
  const [companies, setCompanies] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [activeCompanyId, setActiveCompanyId] = useState(null);

  const appUrl = window.location.origin;

  // Check for one-time view token in URL
  const urlParams = new URLSearchParams(window.location.search);
  const viewToken = urlParams.get("view");

  function addToast(msg, type="info") {
    const id = ++toastId;
    setToasts(t => [...t, { id, msg, type }]);
    // Errors stay for 30 seconds, others for 5 seconds
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), type === "error" ? 30000 : 5000);
  }
  function removeToast(id) { setToasts(t => t.filter(x => x.id !== id)); }

  async function handleLogin(profile) {
    setUser(profile);
    setActiveCompanyId(profile.company_id);
    try { setCompanies(await supabase("companies?select=*&order=name")); } catch(_) {}
  }

  function handleLogout() {
    localStorage.removeItem("sb_token");
    setUser(null); setTab("videos"); setActiveCompanyId(null);
  }

  const isAnnotator = user?.role === "ANNOTATOR";
  const canManageUsers = user && canDo(user.role, "inviteUsers");
  const canViewStats = user && ["ORGADMIN","ANNOTATOR"].includes(user.role);

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {viewToken ? (
          <ExternalViewPage token={viewToken} addToast={addToast} />
        ) : !user ? (
          <AuthScreen onLogin={handleLogin} addToast={addToast} />
        ) : (
          <>
            <header className="header">
              <img src="/logo.png" alt="MAP65" className="header-logo" />
              <div className="header-divider" />
              <button className={`nav-tab ${tab === "videos" ? "active" : ""}`} onClick={() => setTab("videos")}>Videos</button>
              {canManageUsers && (
                <button className={`nav-tab ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>Users</button>
              )}
              {canViewStats && (
                <button className={`nav-tab ${tab === "stats" ? "active" : ""}`} onClick={() => setTab("stats")}>Stats</button>
              )}
              {isAnnotator && (
                <button className={`nav-tab ${tab === "orgs" ? "active" : ""}`} onClick={() => setTab("orgs")}>Organizations</button>
              )}
              <div className="header-right">
                {isAnnotator && companies.length > 0 && (
                  <div className="org-switcher">
                    <span className="org-switcher-label">Org:</span>
                    <select value={activeCompanyId || ""} onChange={e => setActiveCompanyId(e.target.value || null)}>
                      <option value="">All Organizations</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="user-pill">
                  <div className="user-avatar">{(user.email||"?")[0].toUpperCase()}</div>
                  <span className="user-email">{user.email}</span>
                  <RoleBadge role={user.role} />
                </div>
                <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Sign Out</button>
              </div>
            </header>
            <main className="main">
              {tab === "videos" && <VideosTab user={user} companies={companies} activeCompanyId={activeCompanyId} addToast={addToast} />}
              {tab === "users" && canManageUsers && <UsersTab user={user} companies={companies} addToast={addToast} activeCompanyId={activeCompanyId} appUrl={appUrl} />}
              {tab === "stats" && canViewStats && <StatsTab user={user} companies={companies} addToast={addToast} />}
              {tab === "orgs" && isAnnotator && <OrgsTab companies={companies} setCompanies={setCompanies} addToast={addToast} appUrl={appUrl} />}
            </main>
          </>
        )}
        <Toast toasts={toasts} remove={removeToast} />
      </div>
    </>
  );
}