import { useState, useEffect, useRef } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

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

async function authFetch(path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Auth error");
  return data;
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --navy-900: #060e1e;
    --navy-800: #0a1628;
    --navy-700: #0f2040;
    --navy-600: #142850;
    --navy-500: #1a3464;
    --blue-primary: #1450a0;
    --blue-mid: #2860b4;
    --blue-light: #5090c8;
    --blue-pale: #78a0c8;
    --blue-ghost: rgba(20,80,160,0.12);
    --blue-glow: rgba(20,80,160,0.35);
    --white: #ffffff;
    --text: #e8eef8;
    --text-secondary: #8aa4c8;
    --text-muted: #4a6480;
    --border: rgba(20,80,160,0.25);
    --border-bright: rgba(88,144,200,0.4);
    --surface: rgba(10,22,40,0.95);
    --surface2: rgba(15,32,64,0.8);
    --surface3: rgba(20,40,80,0.6);
    --raw: #f0a030;
    --processing: #5090c8;
    --annotated: #38c878;
    --danger: #e05060;
    --font-head: 'Rajdhani', sans-serif;
    --font-body: 'Source Sans 3', sans-serif;
    --r: 6px;
    --r-lg: 12px;
    --shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(20,80,160,0.15);
    --shadow-glow: 0 0 30px rgba(20,80,160,0.3);
  }

  body {
    background: var(--navy-900);
    color: var(--text);
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.5;
    min-height: 100vh;
  }

  body::before {
    content: '';
    position: fixed; inset: 0; z-index: -1;
    background:
      radial-gradient(ellipse 80% 60% at 10% 0%, rgba(20,80,160,0.18) 0%, transparent 60%),
      radial-gradient(ellipse 60% 40% at 90% 100%, rgba(10,30,80,0.3) 0%, transparent 50%),
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 80px,
        rgba(20,80,160,0.03) 80px,
        rgba(20,80,160,0.03) 81px
      ),
      repeating-linear-gradient(
        90deg,
        transparent,
        transparent 80px,
        rgba(20,80,160,0.03) 80px,
        rgba(20,80,160,0.03) 81px
      );
    pointer-events: none;
  }

  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: var(--navy-800); }
  ::-webkit-scrollbar-thumb { background: var(--blue-primary); border-radius: 3px; }

  .app { min-height: 100vh; display: flex; flex-direction: column; }

  /* ── AUTH ── */
  .auth-screen {
    min-height: 100vh; display: flex; align-items: center;
    justify-content: center; padding: 24px; position: relative;
  }
  .auth-wrap {
    display: grid; grid-template-columns: 1fr 1fr;
    width: 100%; max-width: 900px; min-height: 540px;
    border-radius: var(--r-lg); overflow: hidden;
    box-shadow: var(--shadow), var(--shadow-glow);
    border: 1px solid var(--border-bright);
  }
  .auth-left {
    background: linear-gradient(135deg, var(--navy-700) 0%, var(--navy-600) 40%, var(--blue-primary) 100%);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 48px; position: relative; overflow: hidden;
  }
  .auth-left::before {
    content: '';
    position: absolute; inset: -50%;
    background: repeating-conic-gradient(rgba(255,255,255,0.03) 0deg, transparent 1deg, transparent 45deg);
    animation: rotate 60s linear infinite;
  }
  @keyframes rotate { to { transform: rotate(360deg); } }
  .auth-left-content { position: relative; z-index: 1; text-align: center; }
  .auth-logo-img { width: 200px; margin-bottom: 32px; filter: brightness(1.1); }
  .auth-tagline {
    font-family: var(--font-head); font-size: 15px; font-weight: 500;
    color: var(--blue-pale); letter-spacing: 2px; text-transform: uppercase;
  }
  .auth-divider {
    width: 40px; height: 2px;
    background: linear-gradient(90deg, transparent, var(--blue-light), transparent);
    margin: 16px auto;
  }
  .auth-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.7; max-width: 240px; }

  .auth-right {
    background: var(--surface);
    backdrop-filter: blur(20px);
    padding: 48px; display: flex; flex-direction: column; justify-content: center;
  }
  .auth-title {
    font-family: var(--font-head); font-size: 28px; font-weight: 700;
    color: var(--white); margin-bottom: 4px; letter-spacing: 0.5px;
  }
  .auth-sub { color: var(--text-secondary); font-size: 13px; margin-bottom: 32px; }
  .auth-form { display: flex; flex-direction: column; gap: 14px; }

  /* ── FORM ── */
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field label {
    font-size: 10px; color: var(--text-muted); text-transform: uppercase;
    letter-spacing: 1.5px; font-weight: 600; font-family: var(--font-head);
  }
  .field input, .field select, .field textarea {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--r); color: var(--text);
    font-family: var(--font-body); font-size: 14px;
    padding: 10px 14px; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    width: 100%;
  }
  .field input:focus, .field select:focus, .field textarea:focus {
    border-color: var(--blue-light);
    box-shadow: 0 0 0 3px rgba(80,144,200,0.15);
  }
  .field textarea { resize: vertical; min-height: 80px; }
  .field select option { background: var(--navy-700); }

  /* ── BUTTONS ── */
  .btn {
    display: inline-flex; align-items: center; gap: 8px;
    border: none; border-radius: var(--r); cursor: pointer;
    font-family: var(--font-head); font-size: 14px; font-weight: 600;
    padding: 10px 20px; transition: all 0.2s; white-space: nowrap;
    letter-spacing: 0.5px; text-transform: uppercase;
  }
  .btn-primary {
    background: linear-gradient(135deg, var(--blue-primary), var(--blue-mid));
    color: var(--white);
    box-shadow: 0 4px 16px rgba(20,80,160,0.4);
  }
  .btn-primary:hover {
    background: linear-gradient(135deg, var(--blue-mid), var(--blue-light));
    box-shadow: 0 4px 24px rgba(20,80,160,0.6);
    transform: translateY(-1px);
  }
  .btn-ghost {
    background: transparent; color: var(--text-secondary);
    border: 1px solid var(--border);
  }
  .btn-ghost:hover { border-color: var(--blue-light); color: var(--blue-light); }
  .btn-danger { background: transparent; color: var(--danger); border: 1px solid var(--danger); }
  .btn-danger:hover { background: var(--danger); color: var(--white); }
  .btn-sm { padding: 6px 14px; font-size: 12px; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none !important; }

  /* ── HEADER ── */
  .header {
    height: 64px;
    background: rgba(6,14,30,0.95);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border-bright);
    display: flex; align-items: center; padding: 0 32px; gap: 8px;
    position: sticky; top: 0; z-index: 100;
  }
  .header::after {
    content: '';
    position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, var(--blue-primary), var(--blue-light), var(--blue-primary), transparent);
  }
  .header-logo { height: 36px; margin-right: 24px; }
  .header-divider { width: 1px; height: 24px; background: var(--border); margin: 0 8px; }
  .nav-tab {
    background: none; border: none; cursor: pointer;
    font-family: var(--font-head); font-size: 13px; font-weight: 600;
    color: var(--text-muted); padding: 8px 16px; border-radius: var(--r);
    transition: all 0.2s; letter-spacing: 1px; text-transform: uppercase;
    position: relative;
  }
  .nav-tab::after {
    content: ''; position: absolute; bottom: 2px; left: 16px; right: 16px;
    height: 2px; background: var(--blue-light); border-radius: 1px;
    transform: scaleX(0); transition: transform 0.2s;
  }
  .nav-tab:hover { color: var(--text); }
  .nav-tab.active { color: var(--blue-light); }
  .nav-tab.active::after { transform: scaleX(1); }
  .header-right { margin-left: auto; display: flex; align-items: center; gap: 12px; }
  .user-pill {
    display: flex; align-items: center; gap: 10px;
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 30px; padding: 5px 16px 5px 6px;
  }
  .user-avatar {
    width: 30px; height: 30px; border-radius: 50%;
    background: linear-gradient(135deg, var(--blue-primary), var(--blue-light));
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700; font-family: var(--font-head);
    color: white; border: 1px solid var(--blue-light);
  }
  .user-email { font-size: 12px; color: var(--text-secondary); }
  .role-badge {
    font-size: 9px; padding: 2px 8px; border-radius: 10px;
    font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
    font-family: var(--font-head);
  }
  .role-VIEWER    { background: rgba(74,100,128,0.3); color: var(--text-muted); border: 1px solid rgba(74,100,128,0.4); }
  .role-EDITOR    { background: rgba(20,80,160,0.25); color: var(--blue-pale); border: 1px solid rgba(20,80,160,0.4); }
  .role-ANNOTATOR { background: rgba(56,200,120,0.15); color: var(--annotated); border: 1px solid rgba(56,200,120,0.3); }

  /* ── MAIN ── */
  .main { flex: 1; padding: 32px; max-width: 1400px; margin: 0 auto; width: 100%; }
  .page-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
  .page-title {
    font-family: var(--font-head); font-size: 26px; font-weight: 700;
    color: var(--white); letter-spacing: 1px; text-transform: uppercase;
  }
  .page-title span { color: var(--blue-light); }

  /* ── STATUS BADGES ── */
  .status-badge {
    display: inline-flex; align-items: center; gap: 6px; font-size: 11px;
    font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
    padding: 4px 12px; border-radius: 4px; font-family: var(--font-head);
  }
  .status-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .status-RAW { background: rgba(240,160,48,0.12); color: var(--raw); border: 1px solid rgba(240,160,48,0.3); }
  .status-RAW .status-dot { background: var(--raw); box-shadow: 0 0 6px var(--raw); }
  .status-IN_PROCESSING { background: rgba(80,144,200,0.12); color: var(--processing); border: 1px solid rgba(80,144,200,0.3); }
  .status-IN_PROCESSING .status-dot { background: var(--processing); animation: pulse 1.5s infinite; }
  .status-ANNOTATED { background: rgba(56,200,120,0.12); color: var(--annotated); border: 1px solid rgba(56,200,120,0.3); }
  .status-ANNOTATED .status-dot { background: var(--annotated); box-shadow: 0 0 6px var(--annotated); }
  @keyframes pulse { 0%,100% { opacity:1; box-shadow: 0 0 6px var(--processing); } 50% { opacity:0.4; box-shadow: none; } }

  /* ── TABLE ── */
  .table-wrap {
    background: var(--surface);
    backdrop-filter: blur(20px);
    border: 1px solid var(--border-bright);
    border-radius: var(--r-lg); overflow: hidden;
    box-shadow: var(--shadow);
  }
  .toolbar {
    display: flex; align-items: center; gap: 12px;
    padding: 16px 20px; border-bottom: 1px solid var(--border);
    background: var(--surface2);
  }
  .search-wrap { position: relative; }
  .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 13px; }
  .search-input {
    background: var(--navy-800); border: 1px solid var(--border);
    border-radius: var(--r); color: var(--text);
    font-family: var(--font-body); font-size: 13px;
    padding: 8px 14px 8px 34px; outline: none; width: 260px;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .search-input:focus { border-color: var(--blue-light); box-shadow: 0 0 0 3px rgba(80,144,200,0.1); }
  .filter-select {
    background: var(--navy-800); border: 1px solid var(--border);
    border-radius: var(--r); color: var(--text-secondary);
    font-family: var(--font-head); font-size: 12px; font-weight: 600;
    padding: 8px 14px; outline: none; cursor: pointer; text-transform: uppercase; letter-spacing: 0.5px;
  }
  .filter-select:focus { border-color: var(--blue-light); }

  table { width: 100%; border-collapse: collapse; }
  thead { background: linear-gradient(180deg, var(--navy-700), var(--navy-800)); }
  th {
    text-align: left; padding: 12px 16px;
    font-size: 10px; color: var(--text-muted); text-transform: uppercase;
    letter-spacing: 1.5px; font-weight: 700; font-family: var(--font-head);
    border-bottom: 1px solid var(--border-bright);
  }
  td {
    padding: 14px 16px; font-size: 13px;
    border-bottom: 1px solid rgba(20,80,160,0.1);
    vertical-align: middle;
  }
  tr:last-child td { border-bottom: none; }
  tr:hover td {
    background: rgba(20,80,160,0.06);
  }
  .video-name { font-weight: 600; color: var(--white); font-size: 14px; }
  .video-desc { font-size: 12px; color: var(--text-secondary); margin-top: 2px; max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .actions { display: flex; gap: 6px; flex-wrap: wrap; }

  /* ── MODAL ── */
  .modal-overlay {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(2,6,16,0.85);
    backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center; padding: 24px;
    animation: fadeIn 0.15s ease;
  }
  @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
  .modal {
    background: var(--navy-800);
    border: 1px solid var(--border-bright);
    border-radius: var(--r-lg); padding: 36px;
    width: 100%; max-width: 540px; max-height: 92vh; overflow-y: auto;
    animation: slideUp 0.2s ease;
    box-shadow: var(--shadow), var(--shadow-glow);
  }
  @keyframes slideUp { from { transform: translateY(20px); opacity:0; } to { transform: translateY(0); opacity:1; } }
  .modal-title {
    font-family: var(--font-head); font-size: 22px; font-weight: 700;
    color: var(--white); margin-bottom: 8px; letter-spacing: 1px; text-transform: uppercase;
  }
  .modal-subtitle { color: var(--text-muted); font-size: 12px; margin-bottom: 24px; }
  .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 28px; padding-top: 20px; border-top: 1px solid var(--border); }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .form-grid .full { grid-column: 1/-1; }

  /* ── EMPTY ── */
  .empty { text-align: center; padding: 80px 24px; color: var(--text-muted); }
  .empty-icon { font-size: 52px; margin-bottom: 20px; opacity: 0.6; }
  .empty h3 { font-family: var(--font-head); font-size: 20px; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px; letter-spacing: 1px; text-transform: uppercase; }
  .empty p { font-size: 13px; color: var(--text-muted); }

  /* ── COMPANY CARDS ── */
  .company-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
  .company-card {
    background: var(--surface);
    backdrop-filter: blur(20px);
    border: 1px solid var(--border);
    border-radius: var(--r-lg); padding: 24px;
    transition: all 0.2s; position: relative; overflow: hidden;
  }
  .company-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
    background: linear-gradient(90deg, var(--blue-primary), var(--blue-light));
    transform: scaleX(0); transform-origin: left; transition: transform 0.3s;
  }
  .company-card:hover { border-color: var(--border-bright); box-shadow: var(--shadow-glow); }
  .company-card:hover::before { transform: scaleX(1); }
  .company-card h3 {
    font-family: var(--font-head); font-size: 18px; font-weight: 700;
    color: var(--white); margin-bottom: 4px; letter-spacing: 0.5px;
  }
  .company-card .meta { font-size: 12px; color: var(--text-muted); margin-bottom: 20px; font-family: monospace; }
  .suspended { opacity: 0.45; }
  .suspended-tag {
    display: inline-block; font-size: 9px; text-transform: uppercase;
    letter-spacing: 1px; background: rgba(224,80,96,0.15);
    color: var(--danger); padding: 2px 8px; border-radius: 4px;
    margin-left: 10px; border: 1px solid rgba(224,80,96,0.3);
    font-family: var(--font-head); font-weight: 700;
  }

  /* ── TOAST ── */
  .toast-wrap { position: fixed; bottom: 28px; right: 28px; z-index: 999; display: flex; flex-direction: column; gap: 10px; }
  .toast {
    background: var(--navy-700);
    border: 1px solid var(--border-bright);
    border-radius: var(--r); padding: 14px 20px;
    font-size: 13px; max-width: 340px; cursor: pointer;
    animation: slideIn 0.25s ease;
    display: flex; align-items: center; gap: 12px;
    box-shadow: var(--shadow);
    font-family: var(--font-body);
  }
  @keyframes slideIn { from { transform: translateX(48px); opacity:0; } to { transform: translateX(0); opacity:1; } }
  .toast.success { border-color: var(--annotated); }
  .toast.error   { border-color: var(--danger); }
  .toast.info    { border-color: var(--blue-light); }
  .toast-icon { font-size: 16px; flex-shrink: 0; }

  /* ── VIDEO PLAYER ── */
  .video-player {
    background: #000; border-radius: var(--r); width: 100%;
    max-height: 300px; object-fit: contain; margin-bottom: 24px;
    border: 1px solid var(--border);
  }
  .detail-grid { display: grid; grid-template-columns: 140px 1fr; gap: 10px 16px; margin-bottom: 8px; }
  .detail-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; font-family: var(--font-head); font-weight: 600; padding-top: 2px; }
  .detail-value { font-size: 14px; color: var(--text); }

  /* ── MISC ── */
  .divider { height: 1px; background: var(--border); margin: 20px 0; }
  .text-muted { color: var(--text-muted); }
  .text-sm { font-size: 12px; }
  .flex { display: flex; }
  .items-center { align-items: center; }
  .gap-2 { gap: 8px; }
  .gap-3 { gap: 12px; }
  .ml-auto { margin-left: auto; }
  .mt-4 { margin-top: 16px; }
  .mb-4 { margin-bottom: 16px; }
  .w-full { width: 100%; }
  .info-box {
    background: rgba(20,80,160,0.1); border: 1px solid var(--border-bright);
    border-radius: var(--r); padding: 14px 18px; font-size: 13px;
    color: var(--text-secondary); margin-bottom: 20px; line-height: 1.6;
  }
  .spinner {
    width: 18px; height: 18px; border: 2px solid var(--border);
    border-top-color: var(--blue-light); border-radius: 50%;
    animation: spin 0.7s linear infinite; flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .action-btn {
    display: inline-flex; align-items: center; gap: 6px;
    border-radius: var(--r); cursor: pointer; border: 1px solid;
    font-family: var(--font-head); font-size: 11px; font-weight: 700;
    padding: 5px 12px; transition: all 0.2s; white-space: nowrap;
    text-transform: uppercase; letter-spacing: 0.5px; text-decoration: none;
  }
  .action-view   { color: var(--blue-pale);  border-color: var(--border);           background: transparent; }
  .action-view:hover { border-color: var(--blue-pale); background: rgba(120,160,200,0.1); }
  .action-submit { color: var(--raw);        border-color: rgba(240,160,48,0.3);    background: rgba(240,160,48,0.08); }
  .action-submit:hover { background: rgba(240,160,48,0.18); }
  .action-annotate { color: var(--annotated); border-color: rgba(56,200,120,0.3);  background: rgba(56,200,120,0.08); }
  .action-annotate:hover { background: rgba(56,200,120,0.18); }
  .action-download { color: var(--text-secondary); border-color: var(--border);    background: transparent; }
  .action-download:hover { border-color: var(--text-secondary); color: var(--text); }

  /* ── STATS BAR ── */
  .stats-bar {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;
  }
  .stat-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r-lg); padding: 20px 24px;
    display: flex; align-items: center; gap: 16px;
    backdrop-filter: blur(20px);
  }
  .stat-icon { font-size: 28px; opacity: 0.8; }
  .stat-number { font-family: var(--font-head); font-size: 32px; font-weight: 700; color: var(--white); line-height: 1; }
  .stat-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; font-family: var(--font-head); }

  @media (max-width: 768px) {
    .auth-wrap { grid-template-columns: 1fr; }
    .auth-left { display: none; }
    .stats-bar { grid-template-columns: 1fr; }
    .header { padding: 0 16px; gap: 4px; }
    .main { padding: 20px 16px; }
    .form-grid { grid-template-columns: 1fr; }
    .form-grid .full { grid-column: 1; }
  }
`;

const STATES = ["RAW", "IN_PROCESSING", "ANNOTATED"];
const ACTIVITIES = ["Training", "Match", "Practice", "Drill", "Scrimmage", "Warmup", "Other"];

function canDo(role, action) {
  const perms = {
    upload: ["EDITOR", "ANNOTATOR"],
    download: ["EDITOR", "ANNOTATOR"],
    annotate: ["ANNOTATOR"],
    manageCompanies: ["ANNOTATOR"],
    crossCompany: ["ANNOTATOR"],
  };
  return (perms[action] || []).includes(role);
}

let toastId = 0;

function Toast({ toasts, remove }) {
  const icons = { success: "✓", error: "✕", info: "ℹ" };
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`} onClick={() => remove(t.id)}>
          <span className="toast-icon">{icons[t.type]}</span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  const labels = { RAW: "Raw", IN_PROCESSING: "In Processing", ANNOTATED: "Annotated" };
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" />
      {labels[status] || status}
    </span>
  );
}

function Spinner() { return <div className="spinner" />; }

// ── AUTH ──────────────────────────────────────────────────────────────────────
function AuthScreen({ onLogin, addToast }) {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("login");

  async function handleSubmit() {
    if (!email || !password || (mode === "register" && !company)) {
      addToast("Please fill in all fields", "error"); return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        const data = await authFetch("token?grant_type=password", { email, password });
        localStorage.setItem("sb_token", data.access_token);
        const profiles = await supabase(`profiles?email=eq.${encodeURIComponent(email)}&select=*,companies(*)`);
        if (!profiles.length) throw new Error("Profile not found");
        onLogin({ ...profiles[0], token: data.access_token });
      } else {
        const authData = await authFetch("signup", { email, password });
        localStorage.setItem("sb_token", authData.access_token || "");
        let cos = await supabase(`companies?name=eq.${encodeURIComponent(company)}&select=id`);
        let companyId;
        if (cos.length) { companyId = cos[0].id; }
        else {
          const [newCo] = await supabase("companies", { method: "POST", body: JSON.stringify({ name: company }) });
          companyId = newCo.id;
        }
        await supabase("profiles", {
          method: "POST",
          body: JSON.stringify({ id: authData.user?.id, email, company_id: companyId, role: "VIEWER" }),
        });
        addToast("Account created! Please sign in.", "success");
        setMode("login");
      }
    } catch (e) { addToast(e.message, "error"); }
    finally { setLoading(false); }
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
            <p className="auth-desc">Upload, manage, and annotate training and match footage across your organization.</p>
          </div>
        </div>
        <div className="auth-right">
          <div className="auth-title">{mode === "login" ? "Sign In" : "Create Account"}</div>
          <p className="auth-sub">{mode === "login" ? "Access your video library" : "Join the MAP65 platform"}</p>
          <div className="auth-form">
            <div className="field">
              <label>Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@organization.com" onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
            </div>
            {mode === "register" && (
              <div className="field">
                <label>Organization / Company</label>
                <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Your organization name" />
              </div>
            )}
            <div className="field">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
            </div>
            <button className="btn btn-primary w-full" onClick={handleSubmit} disabled={loading} style={{ marginTop: 8, justifyContent: "center" }}>
              {loading ? <Spinner /> : mode === "login" ? "Sign In" : "Create Account"}
            </button>
            <div className="divider" />
            <p className="text-sm text-muted" style={{ textAlign: "center" }}>
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              <button style={{ background: "none", border: "none", color: "var(--blue-light)", cursor: "pointer", fontFamily: "var(--font-head)", fontSize: "13px", fontWeight: 600 }}
                onClick={() => setMode(mode === "login" ? "register" : "login")}>
                {mode === "login" ? "Register" : "Sign In"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── UPLOAD MODAL ──────────────────────────────────────────────────────────────
function UploadModal({ user, companies, onClose, onSave, addToast }) {
  const [form, setForm] = useState({
    name: "", creation_date: new Date().toISOString().slice(0, 10),
    description: "", activity: ACTIVITIES[0], comments: "",
    company_id: user.company_id, file: null,
  });
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.name || !form.creation_date) { addToast("Name and date are required", "error"); return; }
    setLoading(true);
    try {
      let file_url = null;
      if (form.file) {
        const ext = form.file.name.split(".").pop();
        const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/videos/${path}`, {
          method: "POST",
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${localStorage.getItem("sb_token")}`, "Content-Type": form.file.type },
          body: form.file,
        });
        if (!uploadRes.ok) throw new Error("File upload failed — check storage bucket permissions");
        file_url = `${SUPABASE_URL}/storage/v1/object/public/videos/${path}`;
      }
      const [video] = await supabase("videos", {
        method: "POST",
        body: JSON.stringify({ name: form.name, creation_date: form.creation_date, description: form.description, activity: form.activity, comments: form.comments, company_id: form.company_id, status: "RAW", file_url, uploaded_by: user.id }),
      });
      addToast("Video uploaded successfully", "success");
      onSave(video); onClose();
    } catch (e) { addToast(e.message, "error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Upload Video</div>
        <p className="modal-subtitle">Add a new video to the library</p>
        <div className="form-grid">
          <div className="field full"><label>Video Name *</label><input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Match vs Opponent — Q3 2025" /></div>
          <div className="field"><label>Creation Date *</label><input type="date" value={form.creation_date} onChange={(e) => set("creation_date", e.target.value)} /></div>
          <div className="field"><label>Activity Type</label>
            <select value={form.activity} onChange={(e) => set("activity", e.target.value)}>
              {ACTIVITIES.map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div className="field full"><label>Description</label><textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Describe what is shown in the video…" /></div>
          <div className="field full"><label>Comments</label><textarea value={form.comments} onChange={(e) => set("comments", e.target.value)} placeholder="Any additional notes or observations…" rows={2} style={{ minHeight: 60 }} /></div>
          {user.role === "ANNOTATOR" && (
            <div className="field full"><label>Organization</label>
              <select value={form.company_id} onChange={(e) => set("company_id", e.target.value)}>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div className="field full">
            <label>Video File (MP4, MOV, etc.)</label>
            <input ref={fileRef} type="file" accept="video/*" onChange={(e) => set("file", e.target.files[0])} style={{ padding: "8px 0", border: "none", background: "none", color: "var(--text-secondary)" }} />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>{loading ? <><Spinner /> Uploading…</> : "Upload Video"}</button>
        </div>
      </div>
    </div>
  );
}

// ── VIDEO DETAIL MODAL ────────────────────────────────────────────────────────
function VideoDetailModal({ video, user, onClose, onStatusChange, addToast }) {
  const [loading, setLoading] = useState(false);

  async function submitForAnnotation() {
    setLoading(true);
    try {
      await supabase(`videos?id=eq.${video.id}`, { method: "PATCH", body: JSON.stringify({ status: "IN_PROCESSING" }) });
      addToast("Submitted for annotation", "success");
      onStatusChange(video.id, "IN_PROCESSING"); onClose();
    } catch (e) { addToast(e.message, "error"); }
    finally { setLoading(false); }
  }

  async function markAnnotated() {
    setLoading(true);
    try {
      await supabase(`videos?id=eq.${video.id}`, { method: "PATCH", body: JSON.stringify({ status: "ANNOTATED" }) });
      addToast("Video marked as annotated", "success");
      onStatusChange(video.id, "ANNOTATED"); onClose();
    } catch (e) { addToast(e.message, "error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="modal-title">{video.name}</div>
        <div style={{ marginBottom: 20 }}><StatusBadge status={video.status} /></div>
        {video.file_url && <video className="video-player" controls src={video.file_url} />}
        <div className="detail-grid">
          <span className="detail-label">Organization</span><span className="detail-value">{video.companies?.name || "—"}</span>
          <span className="detail-label">Creation Date</span><span className="detail-value">{video.creation_date}</span>
          <span className="detail-label">Activity</span><span className="detail-value">{video.activity}</span>
          <span className="detail-label">Description</span><span className="detail-value">{video.description || "—"}</span>
          <span className="detail-label">Comments</span><span className="detail-value">{video.comments || "—"}</span>
        </div>
        <div className="modal-actions">
          {video.status === "RAW" && canDo(user.role, "upload") && (
            <button className="btn btn-primary btn-sm" onClick={submitForAnnotation} disabled={loading}>
              {loading ? <Spinner /> : "▶ Submit for Annotation"}
            </button>
          )}
          {video.status === "IN_PROCESSING" && canDo(user.role, "annotate") && (
            <button className="btn btn-sm" style={{ background: "rgba(56,200,120,0.15)", color: "var(--annotated)", border: "1px solid rgba(56,200,120,0.4)", borderRadius: "var(--r)", cursor: "pointer", fontFamily: "var(--font-head)", fontSize: "12px", fontWeight: 700, padding: "6px 14px", textTransform: "uppercase", letterSpacing: "0.5px" }}
              onClick={markAnnotated} disabled={loading}>{loading ? <Spinner /> : "✓ Mark Annotated"}</button>
          )}
          {canDo(user.role, "download") && video.file_url && (
            <a className="btn btn-ghost btn-sm" href={video.file_url} download target="_blank" rel="noreferrer">⬇ Download</a>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── COMPANY MODAL ─────────────────────────────────────────────────────────────
function CompanyModal({ company, onClose, onSave, addToast }) {
  const [name, setName] = useState(company?.name || "");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!name.trim()) { addToast("Organization name required", "error"); return; }
    setLoading(true);
    try {
      if (company) {
        await supabase(`companies?id=eq.${company.id}`, { method: "PATCH", body: JSON.stringify({ name }) });
        addToast("Organization updated", "success");
      } else {
        const [c] = await supabase("companies", { method: "POST", body: JSON.stringify({ name }) });
        addToast("Organization created", "success");
        onSave(c);
      }
      onClose();
    } catch (e) { addToast(e.message, "error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-title">{company ? "Edit Organization" : "New Organization"}</div>
        <p className="modal-subtitle">{company ? "Update organization details" : "Add a new organization to the platform"}</p>
        <div className="field">
          <label>Organization Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Atlanta United FC" onKeyDown={(e) => e.key === "Enter" && handleSave()} />
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>{loading ? <Spinner /> : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

// ── VIDEOS TAB ────────────────────────────────────────────────────────────────
function VideosTab({ user, companies, addToast }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showUpload, setShowUpload] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => { fetchVideos(); }, []);

  async function fetchVideos() {
    setLoading(true);
    try {
      let q = "videos?select=*,companies(name)&order=created_at.desc";
      if (!canDo(user.role, "crossCompany")) q += `&company_id=eq.${user.company_id}`;
      setVideos(await supabase(q));
    } catch (e) { addToast(e.message, "error"); }
    finally { setLoading(false); }
  }

  function handleStatusChange(id, status) {
    setVideos((vs) => vs.map((v) => v.id === id ? { ...v, status } : v));
  }

  const filtered = videos.filter((v) => {
    const s = search.toLowerCase();
    return (!s || v.name.toLowerCase().includes(s) || (v.description || "").toLowerCase().includes(s))
      && (statusFilter === "ALL" || v.status === statusFilter);
  });

  const counts = { RAW: videos.filter(v => v.status === "RAW").length, IN_PROCESSING: videos.filter(v => v.status === "IN_PROCESSING").length, ANNOTATED: videos.filter(v => v.status === "ANNOTATED").length };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Video <span>Library</span></div>
        {canDo(user.role, "upload") && (
          <button className="btn btn-primary btn-sm ml-auto" onClick={() => setShowUpload(true)}>+ Upload Video</button>
        )}
      </div>

      <div className="stats-bar">
        <div className="stat-card">
          <div className="stat-icon">🎬</div>
          <div><div className="stat-number" style={{ color: "var(--raw)" }}>{counts.RAW}</div><div className="stat-label">Raw</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⚙️</div>
          <div><div className="stat-number" style={{ color: "var(--processing)" }}>{counts.IN_PROCESSING}</div><div className="stat-label">In Processing</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div><div className="stat-number" style={{ color: "var(--annotated)" }}>{counts.ANNOTATED}</div><div className="stat-label">Annotated</div></div>
        </div>
      </div>

      <div className="table-wrap">
        <div className="toolbar">
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input className="search-input" placeholder="Search videos…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All Status</option>
            {STATES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm ml-auto" onClick={fetchVideos}>↻ Refresh</button>
        </div>

        {loading ? (
          <div style={{ padding: 60, display: "flex", justifyContent: "center" }}><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🎬</div>
            <h3>No Videos Found</h3>
            <p>{canDo(user.role, "upload") ? "Upload your first video to get started." : "No videos are available for your account."}</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr><th>Video</th><th>Status</th><th>Activity</th><th>Organization</th><th>Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id}>
                  <td><div className="video-name">{v.name}</div><div className="video-desc">{v.description}</div></td>
                  <td><StatusBadge status={v.status} /></td>
                  <td style={{ color: "var(--text-secondary)" }}>{v.activity}</td>
                  <td style={{ color: "var(--text-secondary)" }}>{v.companies?.name || "—"}</td>
                  <td style={{ color: "var(--text-muted)", fontFamily: "monospace", fontSize: 12 }}>{v.creation_date}</td>
                  <td>
                    <div className="actions">
                      <button className="action-btn action-view" onClick={() => setSelected(v)}>▶ View</button>
                      {v.status === "RAW" && canDo(user.role, "upload") && (
                        <button className="action-btn action-submit" onClick={() => setSelected(v)}>Submit</button>
                      )}
                      {v.status === "IN_PROCESSING" && canDo(user.role, "annotate") && (
                        <button className="action-btn action-annotate" onClick={() => setSelected(v)}>Annotate</button>
                      )}
                      {canDo(user.role, "download") && v.file_url && (
                        <a className="action-btn action-download" href={v.file_url} download>⬇ Download</a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showUpload && <UploadModal user={user} companies={companies} onClose={() => setShowUpload(false)} onSave={(v) => setVideos((p) => [v, ...p])} addToast={addToast} />}
      {selected && <VideoDetailModal video={selected} user={user} onClose={() => setSelected(null)} onStatusChange={handleStatusChange} addToast={addToast} />}
    </div>
  );
}

// ── COMPANIES TAB ─────────────────────────────────────────────────────────────
function CompaniesTab({ companies, setCompanies, addToast }) {
  const [showModal, setShowModal] = useState(false);
  const [edit, setEdit] = useState(null);

  async function toggleSuspend(c) {
    try {
      await supabase(`companies?id=eq.${c.id}`, { method: "PATCH", body: JSON.stringify({ suspended: !c.suspended }) });
      setCompanies((cs) => cs.map((x) => x.id === c.id ? { ...x, suspended: !x.suspended } : x));
      addToast(`Organization ${!c.suspended ? "suspended" : "reactivated"}`, "success");
    } catch (e) { addToast(e.message, "error"); }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Organizations</div>
        <button className="btn btn-primary btn-sm ml-auto" onClick={() => { setEdit(null); setShowModal(true); }}>+ New Organization</button>
      </div>
      <div className="company-grid">
        {companies.map((c) => (
          <div key={c.id} className={`company-card ${c.suspended ? "suspended" : ""}`}>
            <h3>{c.name}{c.suspended && <span className="suspended-tag">Suspended</span>}</h3>
            <div className="meta">{c.id?.slice(0, 12)}…</div>
            <div className="flex gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => { setEdit(c); setShowModal(true); }}>Edit</button>
              <button className={`btn btn-sm ${c.suspended ? "btn-ghost" : "btn-danger"}`} onClick={() => toggleSuspend(c)}>
                {c.suspended ? "Reactivate" : "Suspend"}
              </button>
            </div>
          </div>
        ))}
        {companies.length === 0 && (
          <div className="empty" style={{ gridColumn: "1/-1" }}>
            <div className="empty-icon">🏢</div>
            <h3>No Organizations</h3>
            <p>Create your first organization to get started.</p>
          </div>
        )}
      </div>
      {showModal && <CompanyModal company={edit} onClose={() => setShowModal(false)} onSave={(c) => setCompanies((p) => [...p, c])} addToast={addToast} />}
    </div>
  );
}

// ── APP ROOT ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("videos");
  const [companies, setCompanies] = useState([]);
  const [toasts, setToasts] = useState([]);

  function addToast(msg, type = "info") {
    const id = ++toastId;
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }
  function removeToast(id) { setToasts((t) => t.filter((x) => x.id !== id)); }

  async function handleLogin(profile) {
    setUser(profile);
    try { setCompanies(await supabase("companies?select=*&order=name")); } catch (_) {}
  }

  function handleLogout() {
    localStorage.removeItem("sb_token");
    setUser(null); setTab("videos");
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {!user ? (
          <AuthScreen onLogin={handleLogin} addToast={addToast} />
        ) : (
          <>
            <header className="header">
              <img src="/logo.png" alt="MAP65" className="header-logo" />
              <div className="header-divider" />
              <button className={`nav-tab ${tab === "videos" ? "active" : ""}`} onClick={() => setTab("videos")}>Videos</button>
              {user.role === "ANNOTATOR" && (
                <button className={`nav-tab ${tab === "companies" ? "active" : ""}`} onClick={() => setTab("companies")}>Organizations</button>
              )}
              <div className="header-right">
                <div className="user-pill">
                  <div className="user-avatar">{(user.email || "?")[0].toUpperCase()}</div>
                  <span className="user-email">{user.email}</span>
                  <span className={`role-badge role-${user.role}`}>{user.role}</span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Sign Out</button>
              </div>
            </header>
            <main className="main">
              {tab === "videos" && <VideosTab user={user} companies={companies} addToast={addToast} />}
              {tab === "companies" && user.role === "ANNOTATOR" && <CompaniesTab companies={companies} setCompanies={setCompanies} addToast={addToast} />}
            </main>
          </>
        )}
        <Toast toasts={toasts} remove={removeToast} />
      </div>
    </>
  );
}
