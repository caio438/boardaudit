import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] || process.cwd();
const buildId = String(process.env.BUILD_ID || process.argv[3] || Date.now());

function findCodeFile() {
  const candidates = ['Código.js', 'Code.js', 'Code.gs', 'Código.gs'];
  for (const name of candidates) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Arquivo principal do Apps Script não encontrado.');
}

const indexPath = path.join(dir, 'Index.html');
const codePath = findCodeFile();
if (!fs.existsSync(indexPath)) throw new Error('Index.html não encontrado.');

let html = fs.readFileSync(indexPath, 'utf8');
let code = fs.readFileSync(codePath, 'utf8');

const DARK_MARKER = 'MODO NOTURNO FIXO - PRODUCAO';
const BUILD_JS_MARKER = 'AUDIT_BUILD_ATUAL';
const BUILD_CODE_MARKER = 'AUDIT_BUILD_ID_FRONTEND';

const metaViewport = '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
if (!html.includes('meta name="audit-build"')) {
  if (!html.includes(metaViewport)) throw new Error('Meta viewport não encontrada.');
  html = html.replace(metaViewport, `${metaViewport}
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <meta name="audit-build" content="<?= AUDIT_BUILD_ID ?>">
  <meta name="audit-version" content="<?= AUDIT_BUILD_VERSAO ?>">`);
}

const darkCss = `

    /* =========================================================
       ${DARK_MARKER}
    ========================================================= */
    :root {
      color-scheme: dark;
      --bg: #0b1220;
      --surface: #111827;
      --surface-2: #172033;
      --surface-3: #1e293b;
      --text: #e5e7eb;
      --muted: #94a3b8;
      --border: #263244;
      --primary: #2563eb;
      --primary-hover: #1d4ed8;
      --success: #4ade80;
      --warning: #fbbf24;
      --danger: #f87171;
      --shadow: 0 8px 24px rgba(0, 0, 0, .34);
    }

    html, body, .app, .main, .page, .access-gate {
      background: var(--bg) !important;
      color: var(--text) !important;
    }

    body { min-height: 100vh; }
    .access-gate {
      background-image: radial-gradient(circle at top left, rgba(37,99,235,.10), transparent 34%) !important;
    }
    .sidebar { background: #070d18 !important; color: var(--text) !important; }
    .topbar { background: transparent !important; color: var(--text) !important; }

    .topbar h2, .topbar p, .section-title h3, .section-title p,
    .card h1, .card h2, .card h3, .card h4, .card p, .card label, .card strong, .card span,
    details, summary, .access-card h1, .access-card p, .access-card label {
      color: var(--text) !important;
    }

    .topbar p, .section-title p, .muted, .small, small, .audit-transcript-meta, .brand span,
    .access-card > p {
      color: var(--muted) !important;
    }

    .access-card, .card, .card.expansivel, details.card, .automation div, .table-wrap,
    .audit-transcript-list, .loading-box, .modal-conteudo, .material-chip, .audit-sheet,
    .compact-item, .quality-card, .guide-check, .meeting-connection, .journey-lane,
    .task-client-heading, .history-date-heading {
      background: var(--surface) !important;
      color: var(--text) !important;
      border-color: var(--border) !important;
    }

    .card.expansivel > .section-title, details > summary, .client-settings > summary {
      background: transparent !important;
      color: var(--text) !important;
    }

    .audit-meta, .audit-json-panel, .audit-json-panel summary, .material-summary-grid > div,
    .guide-step, th {
      background: var(--surface-2) !important;
      color: var(--text) !important;
      border-color: var(--border) !important;
    }

    input, select, textarea {
      background: var(--surface-2) !important;
      color: var(--text) !important;
      border-color: var(--border) !important;
    }

    input::placeholder, textarea::placeholder { color: #738198 !important; }
    select option { background: var(--surface) !important; color: var(--text) !important; }

    .nav button { color: #cbd5e1 !important; }
    .nav button:hover, .nav button.active {
      background: rgba(37, 99, 235, .18) !important;
      color: #fff !important;
    }

    .btn {
      background: var(--primary) !important;
      color: #fff !important;
      border-color: transparent !important;
    }
    .btn:hover { background: var(--primary-hover) !important; }
    .btn.secondary {
      background: #243044 !important;
      color: var(--text) !important;
      border: 1px solid var(--border) !important;
    }
    .btn.secondary:hover { background: #2f3d54 !important; }

    .status { background: #243044 !important; color: #cbd5e1 !important; }
    .status.success { background: rgba(34,197,94,.14) !important; color: #86efac !important; }
    .status.warning { background: rgba(245,158,11,.14) !important; color: #fcd34d !important; }
    .status.danger { background: rgba(239,68,68,.14) !important; color: #fca5a5 !important; }

    .consumo-barra { background: #263244 !important; }
    .table-wrap, table, tbody, tr, td {
      color: var(--text) !important;
      border-color: var(--border) !important;
    }
    tbody tr:hover td { background: rgba(37,99,235,.06) !important; }

    .material-chip.ok {
      color: #86efac !important;
      border-color: rgba(74,222,128,.4) !important;
      background: rgba(34,197,94,.12) !important;
    }

    .local-error {
      color: #fca5a5 !important;
      background: rgba(127,29,29,.24) !important;
      border-color: rgba(248,113,113,.35) !important;
    }

    .audit-sheet { box-shadow: 0 12px 34px rgba(0,0,0,.34) !important; }
    .audit-sheet hr { border-top-color: #475569 !important; }
    .audit-report .line-success { color: #86efac !important; }
    .audit-report .line-danger { color: #fca5a5 !important; }
    .audit-report .line-tip {
      background: rgba(245,158,11,.12) !important;
      border: 1px solid rgba(245,158,11,.22) !important;
      color: var(--text) !important;
    }

    .audit-json-panel { border-color: var(--border) !important; }
    .audit-json-panel summary { border-bottom: 1px solid var(--border) !important; }
    .audit-report th, .audit-report td {
      border-color: #334155 !important;
      color: var(--text) !important;
    }
    .audit-report th { background: var(--surface-3) !important; }
    .audit-json-code { background: #07101f !important; color: #dbeafe !important; }

    .audit-review-actions {
      background: rgba(17,24,39,.96) !important;
      color: var(--text) !important;
      border-color: var(--border) !important;
    }

    .loading { background: rgba(2,6,23,.72) !important; }
    .toast {
      background: #172033 !important;
      color: #fff !important;
      border: 1px solid var(--border);
    }

    a { color: #60a5fa !important; }
    ::selection { background: rgba(37,99,235,.45); color: #fff; }
`;

if (!html.includes(DARK_MARKER)) {
  if (!html.includes('</style>')) throw new Error('Fechamento </style> não encontrado.');
  html = html.replace('</style>', darkCss + '\n  </style>');
}

if (!html.includes(BUILD_JS_MARKER)) {
  const scriptIndex = html.indexOf('<script');
  if (scriptIndex < 0) throw new Error('Bloco <script> não encontrado.');
  const scriptStart = html.indexOf('>', scriptIndex) + 1;
  const buildJs = `
    const AUDIT_BUILD_ATUAL = String(document.querySelector('meta[name="audit-build"]')?.content || '');
    let auditBuildRecarregando = false;

    function verificarNovaVersaoAudit_() {
      if (auditBuildRecarregando || !AUDIT_BUILD_ATUAL || !window.google || !google.script || !google.script.run) return;
      google.script.run
        .withSuccessHandler(function(build) {
          const idServidor = String((build || {}).id || '');
          if (!idServidor || idServidor === AUDIT_BUILD_ATUAL || auditBuildRecarregando) return;
          auditBuildRecarregando = true;
          const url = new URL(window.location.href);
          url.searchParams.set('build', idServidor);
          window.location.replace(url.toString());
        })
        .withFailureHandler(function() {})
        .obterVersaoFrontend();
    }

    setInterval(verificarNovaVersaoAudit_, 60000);
    window.addEventListener('focus', verificarNovaVersaoAudit_);
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) verificarNovaVersaoAudit_();
    });

`;
  html = html.slice(0, scriptStart) + buildJs + html.slice(scriptStart);
}

const buildConst = `var AUDIT_BUILD_ID_FRONTEND = ${JSON.stringify(buildId)};`;
if (/var AUDIT_BUILD_ID_FRONTEND\s*=/.test(code)) {
  code = code.replace(/var AUDIT_BUILD_ID_FRONTEND\s*=\s*[^;]+;/, buildConst);
} else {
  const appStart = code.indexOf('const APP = {');
  if (appStart < 0) throw new Error('Constante APP não encontrada.');
  code = code.slice(0, appStart) + buildConst + '\n' + code.slice(appStart);
}

if (!code.includes('function obterVersaoFrontend()')) {
  const doGetIndex = code.indexOf('function doGet(e) {');
  if (doGetIndex < 0) throw new Error('doGet não encontrado.');
  const helpers = `function obterVersaoFrontend() {
  return audBuildAtual_();
}

function audBuildAtual_() {
  return {
    id: String(AUDIT_BUILD_ID_FRONTEND || APP.versao || ''),
    versao: APP.versao,
    atualizadoEm: new Date().toISOString()
  };
}

`;
  code = code.slice(0, doGetIndex) + helpers + code.slice(doGetIndex);
}

const oldReturn = `  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle(APP.nome)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');`;

const newReturn = `  const template = HtmlService.createTemplateFromFile('Index');
  const build = audBuildAtual_();
  template.AUDIT_BUILD_ID = build.id;
  template.AUDIT_BUILD_VERSAO = build.versao;

  return template
    .evaluate()
    .setTitle(APP.nome)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');`;

if (code.includes(oldReturn)) {
  code = code.replace(oldReturn, newReturn);
} else if (!code.includes('template.AUDIT_BUILD_ID = build.id')) {
  throw new Error('doGet já difere do padrão esperado e não contém o patch de build.');
}

for (const block of [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1])) {
  new Function(block);
}
new Function(code);

if (!html.includes(DARK_MARKER)) throw new Error('Dark mode não foi aplicado.');
if (!html.includes(BUILD_JS_MARKER)) throw new Error('Refresh de build não foi aplicado.');
if (!code.includes(BUILD_CODE_MARKER)) throw new Error('Build ID do servidor não foi aplicado.');

fs.writeFileSync(indexPath, html);
fs.writeFileSync(codePath, code);

console.log(JSON.stringify({
  ok: true,
  buildId,
  indexPath,
  codePath,
  darkMode: true,
  autoRefresh: true,
  arquivosPreservados: fs.readdirSync(dir).sort()
}, null, 2));
