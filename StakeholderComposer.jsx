/**
 * StakeholderComposer.jsx  — Vercel + Supabase edition
 *
 * Changes from the standalone version:
 *  - callClaude()   → proxied through /api/generate  (API key lives in Vercel env)
 *  - jiraSearch()   → proxied through /api/jira       (avoids CORS in production)
 *  - Supabase       → save/load sprint update history
 *  - Settings modal → Jira credentials only (no Anthropic key entry)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  supabaseReady,
  saveUpdate,
  loadUpdates,
  loadUpdateById,
  deleteUpdate,
} from './lib/supabase';

// ─────────────────────────────────────────────────────────────────
// CSS (injected once via useEffect)
// ─────────────────────────────────────────────────────────────────
const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; background: #f5f5f3; color: #1a1a18; font-size: 14px; }

  .suc-root { min-height: 100vh; background: #f5f5f3; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 14px; color: #1a1a18; }

  /* Topbar */
  .suc-topbar { background:#fff; border-bottom:1px solid rgba(0,0,0,.1); padding:0 1.5rem; display:flex; align-items:center; height:52px; gap:12px; position:sticky; top:0; z-index:100; }
  .suc-topbar-title { font-size:15px; font-weight:600; }
  .suc-topbar-div { width:1px; height:18px; background:rgba(0,0,0,.12); }
  .suc-topbar-sub { font-size:12px; color:#888780; }
  .suc-tab-group { display:flex; margin-left:auto; height:100%; }
  .suc-tab { background:none; border:none; border-bottom:2px solid transparent; padding:0 16px; font-size:13px; font-family:inherit; color:#888780; cursor:pointer; height:100%; transition:all .15s; }
  .suc-tab.active { color:#1a1a18; border-bottom-color:#1a1a18; font-weight:500; }
  .suc-tab:hover:not(.active) { color:#444; }
  .suc-btn-settings { background:none; border:1px solid rgba(0,0,0,.18); border-radius:7px; padding:5px 12px; font-size:12px; color:#5f5e5a; cursor:pointer; font-family:inherit; display:flex; align-items:center; gap:5px; margin-left:8px; }
  .suc-btn-settings:hover { background:#f5f5f3; }
  .suc-api-pill { display:inline-flex; align-items:center; gap:4px; font-size:11px; padding:2px 8px; border-radius:20px; }
  .suc-api-pill.ok { background:#E1F5EE; color:#0F6E56; }
  .suc-api-pill.missing { background:#FCEBEB; color:#A32D2D; }
  .suc-api-dot { width:6px; height:6px; border-radius:50%; display:inline-block; }
  .suc-api-pill.ok .suc-api-dot { background:#1D9E75; }
  .suc-api-pill.missing .suc-api-dot { background:#E24B4A; }

  /* Modal */
  .suc-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:200; display:flex; align-items:center; justify-content:center; }
  .suc-modal { background:#fff; border-radius:14px; padding:1.5rem; width:520px; max-width:95vw; box-shadow:0 8px 32px rgba(0,0,0,.18); }
  .suc-modal-title { font-size:16px; font-weight:600; margin-bottom:4px; }
  .suc-modal-sub { font-size:12px; color:#888780; margin-bottom:1.25rem; }
  .suc-modal-section { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:#888780; margin:1rem 0 8px; }
  .suc-modal-field { display:flex; flex-direction:column; gap:4px; margin-bottom:10px; }
  .suc-modal-field label { font-size:12px; color:#5f5e5a; }
  .suc-modal-field input { border:1px solid rgba(0,0,0,.15); border-radius:7px; padding:8px 10px; font-size:13px; font-family:inherit; color:#1a1a18; background:#fafaf8; outline:none; }
  .suc-modal-field input:focus { border-color:rgba(0,0,0,.35); background:#fff; }
  .suc-modal-hint { font-size:11px; color:#888780; margin-top:2px; }
  .suc-modal-hint a { color:#185FA5; text-decoration:none; }
  .suc-modal-hint a:hover { text-decoration:underline; }
  .suc-modal-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:1.25rem; }
  .suc-server-badge { display:inline-flex; align-items:center; gap:6px; background:#E1F5EE; border-radius:8px; padding:8px 12px; font-size:12px; color:#0F6E56; margin-bottom:1rem; }

  /* Page */
  .suc-page { padding:1.25rem 1.5rem; max-width:960px; margin:0 auto; }

  /* Sync banner */
  .suc-sync-banner { background:#fff; border:1px solid rgba(0,0,0,.1); border-radius:12px; padding:14px 16px; margin-bottom:12px; }
  .suc-sync-row { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
  .suc-sync-logo { width:30px; height:30px; background:#E6F1FB; border-radius:7px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .suc-sync-info { flex:1; min-width:140px; }
  .suc-sync-title { font-size:13px; font-weight:500; }
  .suc-sync-desc { font-size:12px; color:#888780; }
  .suc-sync-fields { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
  .suc-sync-fields label { font-size:12px; color:#888780; white-space:nowrap; }
  .suc-sync-input { border:1px solid rgba(0,0,0,.15); border-radius:6px; padding:5px 8px; font-size:13px; font-family:inherit; color:#1a1a18; background:#fafaf8; outline:none; }
  .suc-sync-input:focus { border-color:rgba(0,0,0,.35); }
  .suc-sync-progress { height:3px; background:#E6F1FB; border-radius:2px; margin-top:10px; overflow:hidden; }
  .suc-sync-bar { height:100%; background:#185FA5; border-radius:2px; transition:width .5s ease; }

  /* Card */
  .suc-card { background:#fff; border:1px solid rgba(0,0,0,.1); border-radius:12px; margin-bottom:12px; overflow:hidden; }
  .suc-card-header { padding:12px 16px; display:flex; align-items:center; gap:10px; cursor:pointer; user-select:none; }
  .suc-card-header:hover { background:#fafaf8; }
  .suc-card-eyebrow { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#888780; }
  .suc-card-title { font-size:14px; font-weight:500; display:flex; align-items:center; gap:6px; }
  .suc-card-chip { font-size:11px; font-weight:500; padding:1px 8px; border-radius:20px; background:#E1F5EE; color:#0F6E56; }
  .suc-card-toggle { margin-left:auto; color:#c8c6bf; font-size:18px; line-height:1; transition:transform .2s; }
  .suc-card-toggle.open { transform:rotate(180deg); }
  .suc-card-body { padding:4px 16px 16px; border-top:1px solid rgba(0,0,0,.07); }

  /* Form */
  .suc-form-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px; }
  .suc-span2 { grid-column:span 2; }
  .suc-field { display:flex; flex-direction:column; gap:4px; }
  .suc-field.synced input, .suc-field.synced textarea, .suc-field.synced select { border-color:rgba(29,158,117,.4) !important; background:#f2fbf7 !important; }
  .suc-flabel { font-size:11px; font-weight:700; color:#888780; text-transform:uppercase; letter-spacing:.05em; }
  .suc-flag { font-size:9px; font-weight:500; padding:1px 5px; border-radius:4px; margin-left:4px; vertical-align:middle; }
  .suc-flag-risk { background:#FCEBEB; color:#A32D2D; }
  .suc-flag-co { background:#FAEEDA; color:#854F0B; }
  .suc-flag-sc { background:#FCEBEB; color:#A32D2D; }
  .suc-flag-dep { background:#E6F1FB; color:#185FA5; }
  .suc-flag-esc { background:#FCEBEB; color:#A32D2D; }
  .suc-input, .suc-select, .suc-textarea { border:1px solid rgba(0,0,0,.13); border-radius:7px; padding:7px 10px; font-size:13px; font-family:inherit; color:#1a1a18; background:#fafaf8; outline:none; transition:border-color .15s, background .15s; width:100%; }
  .suc-input:focus, .suc-select:focus, .suc-textarea:focus { border-color:#1a1a18; background:#fff; }
  .suc-textarea { resize:vertical; min-height:78px; line-height:1.65; }
  .suc-select { cursor:pointer; -webkit-appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 10px center; padding-right:28px; }

  /* Actions */
  .suc-actions-bar { display:flex; align-items:center; gap:8px; padding-top:14px; flex-wrap:wrap; }
  .suc-gen-status { font-size:12px; color:#888780; margin-left:auto; }
  .suc-gen-status.running { color:#185FA5; }
  .suc-gen-status.done { color:#1D9E75; }

  /* Output grid */
  .suc-output-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(340px, 1fr)); gap:12px; }
  .suc-panel { background:#fff; border:1px solid rgba(0,0,0,.1); border-radius:12px; overflow:hidden; display:flex; flex-direction:column; }
  .suc-panel-head { padding:11px 14px; display:flex; align-items:center; gap:8px; border-bottom:1px solid rgba(0,0,0,.07); }
  .suc-badge { font-size:11px; font-weight:600; padding:2px 10px; border-radius:20px; }
  .suc-b-exec { background:#EEEDFE; color:#534AB7; }
  .suc-b-eng  { background:#E1F5EE; color:#0F6E56; }
  .suc-b-sales{ background:#FAEEDA; color:#854F0B; }
  .suc-b-cs   { background:#E6F1FB; color:#185FA5; }
  .suc-p-exec { border-top:2.5px solid #7F77DD; }
  .suc-p-eng  { border-top:2.5px solid #1D9E75; }
  .suc-p-sales{ border-top:2.5px solid #EF9F27; }
  .suc-p-cs   { border-top:2.5px solid #378ADD; }
  .suc-panel-aud { font-size:11px; color:#b4b2a9; margin-left:auto; }
  .suc-panel-body { flex:1; padding:12px 14px; }
  .suc-out-textarea { width:100%; min-height:260px; border:none; background:transparent; font-size:13px; font-family:inherit; color:#1a1a18; resize:vertical; line-height:1.8; outline:none; }
  .suc-panel-foot { padding:8px 14px; border-top:1px solid rgba(0,0,0,.07); display:flex; align-items:center; gap:6px; }

  /* Skeleton */
  .suc-sk { height:12px; background:#ebebea; border-radius:4px; margin-bottom:10px; animation:suc-pulse 1.4s ease-in-out infinite; }
  @keyframes suc-pulse { 0%,100%{opacity:1}50%{opacity:.3} }

  /* Empty state */
  .suc-empty { text-align:center; padding:4rem 1rem; color:#b4b2a9; }
  .suc-empty strong { display:block; font-size:15px; color:#888780; margin-bottom:6px; font-weight:500; }
  .suc-empty p { font-size:13px; }

  /* Buttons */
  .suc-btn-primary { background:#1a1a18; color:#fff; border:none; border-radius:8px; padding:9px 22px; font-size:13.5px; font-weight:600; cursor:pointer; font-family:inherit; transition:opacity .15s; }
  .suc-btn-primary:hover { opacity:.82; }
  .suc-btn-primary:disabled { opacity:.35; cursor:not-allowed; }
  .suc-btn-secondary { background:transparent; border:1px solid rgba(0,0,0,.2); border-radius:8px; padding:9px 14px; font-size:13.5px; color:#5f5e5a; cursor:pointer; font-family:inherit; }
  .suc-btn-secondary:hover { background:#f5f5f3; }
  .suc-btn-jira { background:#185FA5; color:#fff; border:none; border-radius:8px; padding:7px 16px; font-size:13px; font-weight:500; cursor:pointer; font-family:inherit; white-space:nowrap; transition:opacity .15s; }
  .suc-btn-jira:hover { opacity:.85; }
  .suc-btn-jira:disabled { opacity:.4; cursor:not-allowed; }
  .suc-btn-sm { background:transparent; border:1px solid rgba(0,0,0,.16); border-radius:6px; padding:4px 10px; font-size:12px; color:#5f5e5a; cursor:pointer; font-family:inherit; }
  .suc-btn-sm:hover { background:#f5f5f3; }
  .suc-btn-sm:disabled { opacity:.35; cursor:not-allowed; }
  .suc-btn-danger { background:transparent; border:1px solid rgba(220,38,38,.25); border-radius:6px; padding:4px 10px; font-size:12px; color:#dc2626; cursor:pointer; font-family:inherit; }
  .suc-btn-danger:hover { background:#fef2f2; }
  .suc-copied { font-size:12px; color:#1D9E75; }

  /* Sync status */
  .suc-sync-st { font-size:12px; color:#888780; }
  .suc-sync-st.syncing { color:#185FA5; }
  .suc-sync-st.ok { color:#1D9E75; }
  .suc-sync-st.err { color:#E24B4A; }

  /* Save bar */
  .suc-save-bar { display:flex; align-items:center; gap:8px; background:#fff; border:1px solid rgba(0,0,0,.1); border-radius:10px; padding:10px 14px; margin-bottom:14px; }
  .suc-save-bar input { flex:1; border:1px solid rgba(0,0,0,.13); border-radius:6px; padding:6px 10px; font-size:13px; font-family:inherit; background:#fafaf8; outline:none; min-width:0; }
  .suc-save-bar input:focus { border-color:#1a1a18; }
  .suc-save-st { font-size:12px; }
  .suc-save-st.ok { color:#1D9E75; }
  .suc-save-st.err { color:#E24B4A; }
  .suc-save-st.saving { color:#185FA5; }

  /* History list */
  .suc-hist-list { display:flex; flex-direction:column; gap:8px; }
  .suc-hist-item { background:#fff; border:1px solid rgba(0,0,0,.1); border-radius:10px; padding:12px 14px; display:flex; align-items:center; gap:10px; }
  .suc-hist-item:hover { border-color:rgba(0,0,0,.2); }
  .suc-hist-info { flex:1; min-width:0; }
  .suc-hist-title { font-size:13px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .suc-hist-meta { font-size:11px; color:#888780; margin-top:2px; }
  .suc-hist-none { text-align:center; padding:3rem 1rem; color:#b4b2a9; font-size:13px; }

  @media (max-width:600px) {
    .suc-form-grid { grid-template-columns:1fr; }
    .suc-span2 { grid-column:span 1; }
    .suc-topbar-sub { display:none; }
  }
`;

// ─────────────────────────────────────────────────────────────────
// AI prompts
// ─────────────────────────────────────────────────────────────────
function buildBase(ctx) {
  return `PROJECT CONTEXT:
- Project: ${ctx.projectName}
- Business Area: ${ctx.businessArea}
- Sprint: ${ctx.sprint} | Quarter: ${ctx.quarter}
- Primary Goal: ${ctx.primaryGoal}
- Delivery Confidence: ${ctx.confidence}
- Release Date: ${ctx.releaseDate}
- Strategic Importance: ${ctx.strategicImportance}

SPRINT REALITY:
- Completed: ${ctx.completed}
- Carryover [CARRYOVER]: ${ctx.notCompleted}
- Scope changes [SCOPE CHANGE]: ${ctx.added}
- Blockers [RISK]: ${ctx.blockers}
- Dependencies [DEPENDENCY]: ${ctx.dependencies}
- Decisions: ${ctx.decisions}
- Risks: ${ctx.risks}
- Metrics: ${ctx.metrics}
- Releases: ${ctx.releases}
- Customer impact: ${ctx.customerImpact}
- Internal impact: ${ctx.internalImpact}
- Next sprint: ${ctx.nextSprint}
- Escalations [ESCALATION]: ${ctx.escalations}

MANDATORY ANALYSIS (do silently before writing): What materially changed? What slipped? What threatens delivery? What must leadership know? What can customer-facing teams use?
FLAGS: [SCOPE CHANGE] [CARRYOVER] [RISK] [DEPENDENCY] [ESCALATION]
RULE: Factual only. No invented progress. Interpret and tailor — do not summarize.`.trim();
}

const PERSONA_PROMPTS = {
  exec: (ctx) => `You are a Senior Program Communications Strategist. Write an EXECUTIVE BRIEF for the CEO and senior leadership.
${buildBase(ctx)}
OUTPUT: Exactly 5 bullet points (• prefix), 1–2 sentences each:
• Progress made vs primary goal
• Business impact of what shipped
• Risk level and what threatens timeline/scope
• Delivery confidence — on track for release?
• Next critical milestone leadership must watch
RULES: Zero jargon. Use numbers when available. Flag [ESCALATION] if action needed. Tone: strategic, concise, decisive.`,

  eng: (ctx) => `You are a Senior Program Communications Strategist. Write an ENGINEERING UPDATE for dev and QA teams.
${buildBase(ctx)}
SECTIONS (omit if empty): **Shipped this sprint** | **Technical decisions** | **Blockers & dependencies** [RISK][DEPENDENCY] | **Sprint carryover** [CARRYOVER] | **Scope changes** [SCOPE CHANGE] | **Next sprint priorities**
RULES: Technical terminology fine. Specific system/API names. [ESCALATION] for cross-functional blockers. Tone: precise, technical, actionable.`,

  sales: (ctx) => `You are a Senior Program Communications Strategist. Write a SALES ENABLEMENT UPDATE for sales and account teams.
${buildBase(ctx)}
SECTIONS: **What you can position today** | **Key talking points** (3–5 customer value statements) | **Quick FAQ** (2–3 Q&A) | **Coming soon** (pipeline hooks) | **What to avoid promising**
RULES: Zero technical jargon. [CARRYOVER] = coming soon only. [RISK] = avoid promising. Tone: commercial, clear, practical.`,

  cs: (ctx) => `You are a Senior Program Communications Strategist. Write a CUSTOMER SUCCESS UPDATE for CS and support teams.
${buildBase(ctx)}
SECTIONS: **What changed for customers** | **Reliability & performance improvements** | **Known limitations or workarounds** | **What's coming next** | **Suggested feedback to gather**
RULES: Absolute zero jargon — write as if CS reads this directly to customers. [CARRYOVER] goes under "coming next". Tone: clear, calm, customer-centered.`,
};

// ─────────────────────────────────────────────────────────────────
// API helpers  — all calls now go through /api/ routes
// ─────────────────────────────────────────────────────────────────
async function callClaude(prompt, maxTokens = 1800) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, maxTokens }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Generation error ${res.status}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

async function jiraSearch(domain, email, token, jql, maxResults = 50) {
  const res = await fetch('/api/jira', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ domain, email, token, jql, maxResults }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Jira error ${res.status}`);
  }
  return res.json();
}

function fmtJiraIssues(data) {
  if (!data?.issues?.length) return '(none)';
  return data.issues
    .map((i) => {
      const st = i.fields.status?.name || '?';
      const pr = i.fields.priority?.name || 'Unprioritized';
      const as = i.fields.assignee?.displayName || 'Unassigned';
      return `${i.key} [${st}|${pr}|${as}] ${i.fields.summary}`;
    })
    .join('\n');
}

// ─────────────────────────────────────────────────────────────────
// Default form state
// ─────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  projectName: '', businessArea: '', sprint: '', quarter: '',
  primaryGoal: '', confidence: '', releaseDate: '', strategicImportance: '',
  completed: '', notCompleted: '', added: '', blockers: '', dependencies: '',
  decisions: '', risks: '', metrics: '', releases: '',
  customerImpact: '', internalImpact: '', nextSprint: '', escalations: '',
};

const EMPTY_OUTPUTS = { exec: '', eng: '', sales: '', cs: '' };

// ─────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────
function Skeleton({ widths = [90, 72, 85, 65, 78] }) {
  return (
    <div style={{ padding: '2px 0' }}>
      {widths.map((w, i) => (
        <div key={i} className="suc-sk" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

function OutputPanel({ id, label, badgeClass, panelClass, audience, value, onChange, loading, onRegen, onCopy, copied }) {
  return (
    <div className={`suc-panel ${panelClass}`}>
      <div className="suc-panel-head">
        <span className={`suc-badge ${badgeClass}`}>{label}</span>
        <span className="suc-panel-aud">{audience}</span>
      </div>
      <div className="suc-panel-body">
        {loading ? <Skeleton /> : (
          <textarea
            className="suc-out-textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`${label} output will appear here...`}
          />
        )}
      </div>
      <div className="suc-panel-foot">
        <button className="suc-btn-sm" onClick={onRegen} disabled={loading}>Regenerate</button>
        <button className="suc-btn-sm" style={{ marginLeft: 'auto' }} onClick={onCopy}>Copy</button>
        {copied && <span className="suc-copied">Copied!</span>}
      </div>
    </div>
  );
}

function SettingsModal({ isOpen, onClose, settings, onSave }) {
  const [local, setLocal] = useState(settings);
  useEffect(() => { setLocal(settings); }, [settings, isOpen]);
  const set = (k) => (v) => setLocal((p) => ({ ...p, [k]: v }));

  if (!isOpen) return null;
  return (
    <div className="suc-modal-overlay" onClick={onClose}>
      <div className="suc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="suc-modal-title">Settings</div>
        <div className="suc-modal-sub">Jira credentials are stored in your browser only.</div>

        <div className="suc-server-badge">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L2 4v4c0 3.31 2.56 6.41 6 7 3.44-.59 6-3.69 6-7V4L8 1z" stroke="#0F6E56" strokeWidth="1.3" fill="none"/>
            <path d="M5.5 8l2 2 3-3" stroke="#0F6E56" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          AI generation uses a server-side API key — no key entry required.
        </div>

        <div className="suc-modal-section">Jira (optional — for auto-fill from your board)</div>
        <div className="suc-modal-field">
          <label>Jira Domain</label>
          <input type="text" value={local.jiraDomain} onChange={(e) => set('jiraDomain')(e.target.value)} placeholder="yourcompany.atlassian.net" />
          <div className="suc-modal-hint">Just the domain, e.g. <code>carters.atlassian.net</code></div>
        </div>
        <div className="suc-modal-field">
          <label>Jira Email</label>
          <input type="email" value={local.jiraEmail} onChange={(e) => set('jiraEmail')(e.target.value)} placeholder="you@company.com" />
        </div>
        <div className="suc-modal-field">
          <label>Jira API Token</label>
          <input type="password" value={local.jiraToken} onChange={(e) => set('jiraToken')(e.target.value)} placeholder="Your Jira API token" />
          <div className="suc-modal-hint">
            Generate at <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noreferrer">id.atlassian.com</a> → Security → API Tokens
          </div>
        </div>

        <div className="suc-modal-actions">
          <button className="suc-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="suc-btn-primary" onClick={() => onSave(local)}>Save settings</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────
export default function StakeholderComposer() {

  // Inject CSS once
  useEffect(() => {
    const el = document.createElement('style');
    el.id = 'suc-styles';
    el.textContent = STYLES;
    if (!document.getElementById('suc-styles')) document.head.appendChild(el);
    return () => { const s = document.getElementById('suc-styles'); if (s) s.remove(); };
  }, []);

  // ── State ──
  const [activeTab, setActiveTab]         = useState('input');
  const [showSettings, setShowSettings]   = useState(false);
  const [ctxOpen, setCtxOpen]             = useState(true);
  const [sprintOpen, setSprintOpen]       = useState(true);

  const [settings, setSettings] = useState(() => ({
    jiraDomain: localStorage.getItem('suc_jira_domain') || '',
    jiraEmail:  localStorage.getItem('suc_jira_email')  || '',
    jiraToken:  localStorage.getItem('suc_jira_token')  || '',
  }));

  const [form, setForm]                   = useState(EMPTY_FORM);
  const [jiraProject, setJiraProject]     = useState('ENH');
  const [jiraSprint, setJiraSprint]       = useState('');
  const [syncedFields, setSyncedFields]   = useState([]);
  const [syncStatus, setSyncStatus]       = useState({ msg: '', type: '' });
  const [syncProgress, setSyncProgress]   = useState(0);
  const [jiraSyncing, setJiraSyncing]     = useState(false);

  const [outputs, setOutputs]             = useState(EMPTY_OUTPUTS);
  const [loading, setLoading]             = useState({ exec: false, eng: false, sales: false, cs: false });
  const [genStatus, setGenStatus]         = useState({ msg: '', type: '' });
  const [hasGenerated, setHasGenerated]   = useState(false);
  const [copied, setCopied]               = useState({ exec: false, eng: false, sales: false, cs: false });

  // ── History state ──
  const [saveLabel, setSaveLabel]         = useState('');
  const [saveStatus, setSaveStatus]       = useState({ msg: '', type: '' });
  const [history, setHistory]             = useState([]);
  const [histLoading, setHistLoading]     = useState(false);

  // ── Helpers ──
  const setF = useCallback((key) => (val) => setForm((p) => ({ ...p, [key]: val })), []);

  const saveSettings = useCallback((s) => {
    localStorage.setItem('suc_jira_domain', s.jiraDomain);
    localStorage.setItem('suc_jira_email',  s.jiraEmail);
    localStorage.setItem('suc_jira_token',  s.jiraToken);
    setSettings(s);
    setShowSettings(false);
  }, []);

  const jiraReady = !!(settings.jiraDomain && settings.jiraEmail && settings.jiraToken);

  // ── Load history when History tab is opened ──
  useEffect(() => {
    if (activeTab === 'history' && supabaseReady) {
      setHistLoading(true);
      loadUpdates().then((rows) => {
        setHistory(rows);
        setHistLoading(false);
      }).catch(() => setHistLoading(false));
    }
  }, [activeTab]);

  // ── Jira sync ──
  const syncFromJira = useCallback(async () => {
    if (!jiraReady) {
      alert('Please set your Jira Domain, Email, and API Token in Settings first.');
      setShowSettings(true); return;
    }

    const project = jiraProject.trim().toUpperCase() || 'ENH';
    const sprint  = jiraSprint.trim();
    const sprintClause = sprint ? ` AND sprint = "${sprint}"` : '';
    const domain  = settings.jiraDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');

    setJiraSyncing(true);
    setSyncStatus({ msg: 'Connecting to Jira...', type: 'syncing' });
    setSyncProgress(10);

    try {
      setSyncStatus({ msg: 'Fetching sprint data (4 queries)...', type: 'syncing' });
      setSyncProgress(22);

      const [closedD, activeD, blockedD, backlogD] = await Promise.all([
        jiraSearch(domain, settings.jiraEmail, settings.jiraToken, `project = ${project}${sprintClause} AND status in (Done, Closed, Live) ORDER BY updated DESC`, 50),
        jiraSearch(domain, settings.jiraEmail, settings.jiraToken, `project = ${project}${sprintClause} AND status in ("Dev in Progress","Testing in Staging","Code Review","Acceptance","Ready for Test","Release Ready") ORDER BY updated DESC`, 30),
        jiraSearch(domain, settings.jiraEmail, settings.jiraToken, `project = ${project}${sprintClause} AND status = Blocked ORDER BY updated DESC`, 15),
        jiraSearch(domain, settings.jiraEmail, settings.jiraToken, `project = ${project}${sprintClause} AND status in ("Ready for DEV","Needs Requirements","Refinement Ready","Needs Priority") ORDER BY updated DESC`, 30),
      ]);

      setSyncProgress(55);
      setSyncStatus({ msg: 'Interpreting with Claude...', type: 'syncing' });

      const rawDump = [
        `CLOSED/DONE (${closedD.total} total):\n${fmtJiraIssues(closedD)}`,
        `ACTIVE (${activeD.total}):\n${fmtJiraIssues(activeD)}`,
        `BLOCKED (${blockedD.total}):\n${fmtJiraIssues(blockedD)}`,
        `BACKLOG/READY (${backlogD.total}):\n${fmtJiraIssues(backlogD)}`,
      ].join('\n\n');

      const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const prompt = `You are a Scrum Master reading live Jira data for project ${project}${sprint ? ', ' + sprint : ''}. Today is ${today}.

${rawDump}

Return ONLY a valid JSON object (no markdown, no explanation) with these exact keys:
{"projectName":"string","sprint":"string","quarter":"string","confidence":"High|Medium|Low","completed":"• bullet list with keys","notCompleted":"• bullet list carryover","added":"scope changes","blockers":"blocked issues","dependencies":"dependency patterns","risks":"bug ratio, unprioritized, workload","metrics":"status/type/priority counts","releases":"live vs delayed","customerImpact":"user-visible changes","internalImpact":"team/process impact","nextSprint":"• next priorities","escalations":"production issues and gaps"}`;

      setSyncProgress(75);
      const aiRaw = await callClaude(prompt, 1200);
      setSyncProgress(92);

      let data;
      try {
        const match = aiRaw.match(/\{[\s\S]*\}/);
        data = JSON.parse(match ? match[0] : aiRaw);
      } catch {
        throw new Error('Could not parse AI response as JSON.');
      }

      const textFields = ['projectName','sprint','quarter','completed','notCompleted','added','blockers','dependencies','risks','metrics','releases','customerImpact','internalImpact','nextSprint','escalations'];
      const synced = [];

      setForm((prev) => {
        const next = { ...prev };
        textFields.forEach((k) => {
          if (data[k]) { next[k] = data[k]; synced.push(k); }
        });
        if (data.confidence) next.confidence = data.confidence;
        if (!next.businessArea) next.businessArea = 'Customer Experience';
        if (!next.strategicImportance) next.strategicImportance = 'UX';
        return next;
      });
      setSyncedFields(synced);
      setSyncProgress(100);
      setTimeout(() => setSyncProgress(0), 800);
      setSyncStatus({ msg: `${synced.length} fields synced ✓`, type: 'ok' });
      setTimeout(() => setSyncStatus({ msg: '', type: '' }), 6000);
    } catch (err) {
      setSyncProgress(0);
      setSyncStatus({ msg: `Sync failed: ${err.message}`, type: 'err' });
      setTimeout(() => setSyncStatus({ msg: '', type: '' }), 6000);
    }
    setJiraSyncing(false);
  }, [settings, jiraProject, jiraSprint, jiraReady]);

  // ── Generate one persona ──
  const generateOne = useCallback(async (key, ctx) => {
    setLoading((p) => ({ ...p, [key]: true }));
    try {
      const result = await callClaude(PERSONA_PROMPTS[key](ctx));
      setOutputs((p) => ({ ...p, [key]: result }));
    } catch (e) {
      setOutputs((p) => ({ ...p, [key]: `Error: ${e.message}` }));
    }
    setLoading((p) => ({ ...p, [key]: false }));
  }, []);

  // ── Generate all ──
  const generateAll = useCallback(async () => {
    if (!form.completed && !form.notCompleted) {
      setGenStatus({ msg: 'Fill in "Completed this sprint" first (or sync from Jira).', type: '' });
      setTimeout(() => setGenStatus({ msg: '', type: '' }), 4000);
      return;
    }
    const ctx = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v || '(not specified)'])
    );
    setHasGenerated(true);
    setActiveTab('output');
    setGenStatus({ msg: 'Generating 4 updates...', type: 'running' });
    await Promise.all(['exec', 'eng', 'sales', 'cs'].map((k) => generateOne(k, ctx)));
    setGenStatus({ msg: 'All 4 updates ready — edit freely.', type: 'done' });
    setTimeout(() => setGenStatus({ msg: '', type: '' }), 7000);
  }, [form, generateOne]);

  const regen = useCallback((key) => {
    const ctx = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v || '(not specified)']));
    generateOne(key, ctx);
  }, [form, generateOne]);

  const copyPanel = useCallback((key) => {
    navigator.clipboard.writeText(outputs[key] || '').then(() => {
      setCopied((p) => ({ ...p, [key]: true }));
      setTimeout(() => setCopied((p) => ({ ...p, [key]: false })), 2200);
    });
  }, [outputs]);

  const clearAll = useCallback(() => {
    setForm(EMPTY_FORM);
    setSyncedFields([]);
    setOutputs(EMPTY_OUTPUTS);
    setHasGenerated(false);
    setGenStatus({ msg: '', type: '' });
  }, []);

  // ── Save to Supabase ──
  const handleSave = useCallback(async () => {
    if (!supabaseReady) return;
    setSaveStatus({ msg: 'Saving...', type: 'saving' });
    try {
      await saveUpdate({ formData: form, outputs, label: saveLabel || undefined });
      setSaveStatus({ msg: 'Saved ✓', type: 'ok' });
      setSaveLabel('');
      setTimeout(() => setSaveStatus({ msg: '', type: '' }), 4000);
    } catch (err) {
      setSaveStatus({ msg: `Save failed: ${err.message}`, type: 'err' });
      setTimeout(() => setSaveStatus({ msg: '', type: '' }), 5000);
    }
  }, [form, outputs, saveLabel]);

  // ── Load from history ──
  const handleLoadHistory = useCallback(async (id) => {
    try {
      const row = await loadUpdateById(id);
      if (!row) return;
      setForm(row.form_data || EMPTY_FORM);
      setOutputs(row.outputs || EMPTY_OUTPUTS);
      setHasGenerated(Object.values(row.outputs || {}).some(Boolean));
      setSyncedFields([]);
      setActiveTab('output');
    } catch (err) {
      alert(`Failed to load: ${err.message}`);
    }
  }, []);

  const handleDeleteHistory = useCallback(async (id, e) => {
    e.stopPropagation();
    if (!confirm('Delete this saved update?')) return;
    try {
      await deleteUpdate(id);
      setHistory((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="suc-root">

      {/* Settings modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSave={saveSettings}
      />

      {/* Topbar */}
      <div className="suc-topbar">
        <span className="suc-topbar-title">Stakeholder Update Composer</span>
        <span className="suc-topbar-div" />
        <span className="suc-topbar-sub">4 audience updates from one sprint dump</span>
        <div className="suc-tab-group">
          <button className={`suc-tab${activeTab === 'input' ? ' active' : ''}`} onClick={() => setActiveTab('input')}>Input</button>
          <button className={`suc-tab${activeTab === 'output' ? ' active' : ''}`} onClick={() => setActiveTab('output')}>Outputs</button>
          {supabaseReady && (
            <button className={`suc-tab${activeTab === 'history' ? ' active' : ''}`} onClick={() => setActiveTab('history')}>History</button>
          )}
        </div>
        <button className="suc-btn-settings" onClick={() => setShowSettings(true)}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="2.5" stroke="#5f5e5a" strokeWidth="1.3"/>
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41" stroke="#5f5e5a" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Settings
          <span className={`suc-api-pill ${jiraReady ? 'ok' : 'missing'}`}>
            <span className="suc-api-dot" />
            {jiraReady ? 'Jira connected' : 'Jira not set'}
          </span>
        </button>
      </div>

      {/* ── INPUT TAB ── */}
      {activeTab === 'input' && (
        <div className="suc-page">

          {/* Jira sync banner */}
          <div className="suc-sync-banner">
            <div className="suc-sync-row">
              <div className="suc-sync-logo">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M11.975 2C8.128 2 5 5.128 5 8.975c0 2.516 1.338 4.72 3.337 5.944L11.975 22l3.638-7.081C17.612 13.695 19 11.49 19 8.975 19 5.128 15.822 2 11.975 2zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" fill="#185FA5"/>
                </svg>
              </div>
              <div className="suc-sync-info">
                <div className="suc-sync-title">Auto-fill from Jira</div>
                <div className="suc-sync-desc">Fetches live sprint data and maps it to all form fields</div>
              </div>
              <div className="suc-sync-fields">
                <label>Project</label>
                <input className="suc-sync-input" style={{ width: 72 }} value={jiraProject} onChange={(e) => setJiraProject(e.target.value)} />
                <label>Sprint</label>
                <input className="suc-sync-input" style={{ width: 120 }} value={jiraSprint} onChange={(e) => setJiraSprint(e.target.value)} placeholder="e.g. Sprint 8" />
              </div>
              <button className="suc-btn-jira" onClick={syncFromJira} disabled={jiraSyncing}>
                {jiraSyncing ? 'Syncing...' : 'Sync from Jira'}
              </button>
              {syncStatus.msg && <span className={`suc-sync-st ${syncStatus.type}`}>{syncStatus.msg}</span>}
            </div>
            {syncProgress > 0 && syncProgress < 100 && (
              <div className="suc-sync-progress">
                <div className="suc-sync-bar" style={{ width: `${syncProgress}%` }} />
              </div>
            )}
          </div>

          {/* Section 1: Project context */}
          <div className="suc-card">
            <div className="suc-card-header" onClick={() => setCtxOpen((p) => !p)}>
              <div>
                <div className="suc-card-eyebrow">Section 1</div>
                <div className="suc-card-title">
                  Project context
                  {syncedFields.includes('projectName') && <span className="suc-card-chip">{jiraSprint || jiraProject} synced</span>}
                </div>
              </div>
              <span className={`suc-card-toggle${ctxOpen ? ' open' : ''}`}>⌄</span>
            </div>
            {ctxOpen && (
              <div className="suc-card-body">
                <div className="suc-form-grid">
                  <div className={`suc-field${syncedFields.includes('projectName') ? ' synced' : ''}`}>
                    <label className="suc-flabel">Project / initiative name</label>
                    <input className="suc-input" value={form.projectName} onChange={(e) => setF('projectName')(e.target.value)} placeholder="e.g. Carter's ENH — Sprint 8" />
                  </div>
                  <div className="suc-field">
                    <label className="suc-flabel">Business area</label>
                    <select className="suc-select suc-input" value={form.businessArea} onChange={(e) => setF('businessArea')(e.target.value)}>
                      <option value="">Select area</option>
                      {['Platform','Growth','Internal Tools','Customer Experience','Security','Integrations'].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className={`suc-field${syncedFields.includes('sprint') ? ' synced' : ''}`}>
                    <label className="suc-flabel">Current sprint</label>
                    <input className="suc-input" value={form.sprint} onChange={(e) => setF('sprint')(e.target.value)} placeholder="e.g. Sprint 8" />
                  </div>
                  <div className={`suc-field${syncedFields.includes('quarter') ? ' synced' : ''}`}>
                    <label className="suc-flabel">Quarter</label>
                    <input className="suc-input" value={form.quarter} onChange={(e) => setF('quarter')(e.target.value)} placeholder="e.g. Q2 2026" />
                  </div>
                  <div className="suc-field suc-span2">
                    <label className="suc-flabel">Primary goal this quarter</label>
                    <input className="suc-input" value={form.primaryGoal} onChange={(e) => setF('primaryGoal')(e.target.value)} placeholder="e.g. Ship CMA 10.8 iOS and 26.8.0 web with Reviews Supercharge" />
                  </div>
                  <div className={`suc-field${syncedFields.includes('confidence') ? ' synced' : ''}`}>
                    <label className="suc-flabel">Delivery confidence</label>
                    <select className="suc-select suc-input" value={form.confidence} onChange={(e) => setF('confidence')(e.target.value)}>
                      <option value="">Select</option>
                      <option value="High">High — on track</option>
                      <option value="Medium">Medium — some risk</option>
                      <option value="Low">Low — at risk</option>
                    </select>
                  </div>
                  <div className="suc-field">
                    <label className="suc-flabel">Release date</label>
                    <input className="suc-input" value={form.releaseDate} onChange={(e) => setF('releaseDate')(e.target.value)} placeholder="e.g. May 27, 2026 or TBD" />
                  </div>
                  <div className="suc-field suc-span2">
                    <label className="suc-flabel">Strategic importance</label>
                    <select className="suc-select suc-input" value={form.strategicImportance} onChange={(e) => setF('strategicImportance')(e.target.value)}>
                      <option value="">Select</option>
                      {['Revenue','Retention','Scalability','Compliance','UX','Efficiency'].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Sprint reality */}
          <div className="suc-card">
            <div className="suc-card-header" onClick={() => setSprintOpen((p) => !p)}>
              <div>
                <div className="suc-card-eyebrow">Section 2</div>
                <div className="suc-card-title">
                  Sprint reality
                  {syncedFields.includes('completed') && <span className="suc-card-chip">{syncedFields.length} fields synced</span>}
                </div>
              </div>
              <span className={`suc-card-toggle${sprintOpen ? ' open' : ''}`}>⌄</span>
            </div>
            {sprintOpen && (
              <div className="suc-card-body">
                <div className="suc-form-grid">
                  <div className={`suc-field suc-span2`}>
                    <label className="suc-flabel">Completed this sprint</label>
                    <textarea className="suc-textarea suc-input" value={form.completed} onChange={(e) => setF('completed')(e.target.value)} placeholder="What actually shipped or was resolved..." rows={4} style={syncedFields.includes('completed') ? { borderColor: 'rgba(29,158,117,.4)', background: '#f2fbf7' } : {}} />
                  </div>

                  {[
                    { id: 'notCompleted', label: 'Planned but not completed', flag: { text: '[CARRYOVER]', cls: 'co' }, placeholder: 'What was scoped but moved to next sprint...' },
                    { id: 'added',        label: 'Added after sprint start',  flag: { text: '[SCOPE CHANGE]', cls: 'sc' }, placeholder: 'Unplanned work introduced mid-sprint...' },
                    { id: 'blockers',     label: 'Current blockers',          flag: { text: '[RISK]', cls: 'risk' }, placeholder: 'Technical, business, or resource blockers...' },
                    { id: 'dependencies', label: 'Cross-team dependencies',   flag: { text: '[DEPENDENCY]', cls: 'dep' }, placeholder: 'Teams, owners, or systems we are waiting on...' },
                  ].map(({ id, label, flag, placeholder }) => (
                    <div key={id} className="suc-field">
                      <label className="suc-flabel">{label}<span className={`suc-flag suc-flag-${flag.cls}`}>{flag.text}</span></label>
                      <textarea className="suc-textarea suc-input" value={form[id]} onChange={(e) => setF(id)(e.target.value)} placeholder={placeholder} rows={3} style={syncedFields.includes(id) ? { borderColor: 'rgba(29,158,117,.4)', background: '#f2fbf7' } : {}} />
                    </div>
                  ))}

                  {[
                    { id: 'decisions',      label: 'Decisions made this sprint', span: true,  placeholder: 'Technical decisions, architectural choices...' },
                    { id: 'risks',          label: 'Risks',                       span: false, placeholder: 'Timeline, scope, quality, resourcing risks...' },
                    { id: 'metrics',        label: 'Metrics',                     span: false, placeholder: 'Velocity, burndown, bug count, conversions...' },
                    { id: 'releases',       label: 'Releases',                    span: false, placeholder: 'What shipped, what was delayed...' },
                    { id: 'customerImpact', label: 'Customer impact',             span: false, placeholder: 'What changed for end users...' },
                    { id: 'internalImpact', label: 'Internal impact',             span: false, placeholder: 'Team or process changes, tech debt...' },
                    { id: 'nextSprint',     label: 'Next sprint priorities',      span: false, placeholder: 'Top 3-5 priorities for next sprint...' },
                  ].map(({ id, label, span, placeholder }) => (
                    <div key={id} className={`suc-field${span ? ' suc-span2' : ''}`}>
                      <label className="suc-flabel">{label}</label>
                      <textarea className="suc-textarea suc-input" value={form[id]} onChange={(e) => setF(id)(e.target.value)} placeholder={placeholder} rows={3} style={syncedFields.includes(id) ? { borderColor: 'rgba(29,158,117,.4)', background: '#f2fbf7' } : {}} />
                    </div>
                  ))}

                  <div className="suc-field suc-span2">
                    <label className="suc-flabel">Escalations needed<span className="suc-flag suc-flag-esc">[ESCALATION]</span></label>
                    <textarea className="suc-textarea suc-input" value={form.escalations} onChange={(e) => setF('escalations')(e.target.value)} placeholder="Issues requiring leadership intervention..." rows={3} style={syncedFields.includes('escalations') ? { borderColor: 'rgba(29,158,117,.4)', background: '#f2fbf7' } : {}} />
                  </div>
                </div>

                <div className="suc-actions-bar">
                  <button className="suc-btn-primary" onClick={generateAll}>Generate all 4 updates</button>
                  <button className="suc-btn-secondary" onClick={clearAll}>Clear form</button>
                  {genStatus.msg && <span className={`suc-gen-status ${genStatus.type}`}>{genStatus.msg}</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── OUTPUT TAB ── */}
      {activeTab === 'output' && (
        <div className="suc-page">
          {/* Save bar — only if Supabase is configured */}
          {supabaseReady && hasGenerated && (
            <div className="suc-save-bar">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: '#888780' }}>
                <path d="M13 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V5l-3-3z" stroke="#888780" strokeWidth="1.2" fill="none"/>
                <path d="M10 2v3H6V2M5 9h6M5 11.5h4" stroke="#888780" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <input
                value={saveLabel}
                onChange={(e) => setSaveLabel(e.target.value)}
                placeholder={`Save snapshot — e.g. "${form.sprint || 'Sprint 8'} final"`}
              />
              <button className="suc-btn-sm" onClick={handleSave} disabled={!!saveStatus.msg}>
                Save to history
              </button>
              {saveStatus.msg && <span className={`suc-save-st ${saveStatus.type}`}>{saveStatus.msg}</span>}
            </div>
          )}

          {!hasGenerated ? (
            <div className="suc-empty">
              <div style={{ fontSize: 36, marginBottom: 12 }}>✏️</div>
              <strong>No updates generated yet</strong>
              <p>Fill in the Input tab (or sync from Jira), then click "Generate all 4 updates".</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                {genStatus.msg && <span className={`suc-gen-status ${genStatus.type}`}>{genStatus.msg}</span>}
                <button className="suc-btn-secondary" style={{ marginLeft: 'auto', fontSize: 12, padding: '6px 12px' }} onClick={() => setActiveTab('input')}>← Edit input</button>
              </div>
              <div className="suc-output-grid">
                {[
                  { id: 'exec',  label: 'Exec brief',        badge: 'suc-b-exec',  panel: 'suc-p-exec',  aud: 'CEO · senior leadership' },
                  { id: 'eng',   label: 'Engineering update', badge: 'suc-b-eng',   panel: 'suc-p-eng',   aud: 'Dev team · eng leadership' },
                  { id: 'sales', label: 'Sales enablement',  badge: 'suc-b-sales', panel: 'suc-p-sales', aud: 'Sales · account teams' },
                  { id: 'cs',    label: 'Customer success',  badge: 'suc-b-cs',    panel: 'suc-p-cs',    aud: 'CS · support teams' },
                ].map(({ id, label, badge, panel, aud }) => (
                  <OutputPanel
                    key={id}
                    id={id}
                    label={label}
                    badgeClass={badge}
                    panelClass={panel}
                    audience={aud}
                    value={outputs[id]}
                    onChange={(v) => setOutputs((p) => ({ ...p, [id]: v }))}
                    loading={loading[id]}
                    onRegen={() => regen(id)}
                    onCopy={() => copyPanel(id)}
                    copied={copied[id]}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && supabaseReady && (
        <div className="suc-page">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Saved updates</div>
              <div style={{ fontSize: 12, color: '#888780', marginTop: 2 }}>Click an entry to reload its form data and outputs</div>
            </div>
          </div>

          {histLoading ? (
            <div className="suc-hist-none">Loading...</div>
          ) : history.length === 0 ? (
            <div className="suc-hist-none">No saved updates yet — generate outputs and click "Save to history".</div>
          ) : (
            <div className="suc-hist-list">
              {history.map((row) => (
                <div key={row.id} className="suc-hist-item" style={{ cursor: 'pointer' }} onClick={() => handleLoadHistory(row.id)}>
                  <div className="suc-hist-info">
                    <div className="suc-hist-title">
                      {row.label || `${row.project_name || 'Update'} · ${row.sprint || '—'}`}
                    </div>
                    <div className="suc-hist-meta">
                      {row.project_name} · {row.sprint} · {new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {['exec','eng','sales','cs'].filter(k => row.outputs?.[k]).map(k => (
                      <span key={k} className={`suc-badge suc-b-${k}`} style={{ fontSize: 10, padding: '1px 6px' }}>{k}</span>
                    ))}
                  </div>
                  <button className="suc-btn-danger" onClick={(e) => handleDeleteHistory(row.id, e)}>Delete</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
