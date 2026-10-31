#!/usr/bin/env node
// vite build 뒤에 실행: 수집 데이터(public/data/status.json)로 정적 파일을 만든다.
// 수집 봇이 data 커밋을 올릴 때마다 Vercel 이 다시 빌드하므로 "수집 때마다" 새로 만들어진다.
//   dist/alerts-feed.json          빈자리 이메일 알림 피드(딸깍랭크 중앙 알림 서버가 주기적으로 읽음)
//   dist/forest/index.html         휴양림 전체 목록
//   dist/forest/<id>/index.html    휴양림별 빈자리 페이지(검색 유입용)
//   dist/vacancy/<지역>/[<시기>/]index.html  지역·시기 랜딩(이번 주말 경기 휴양림 빈자리 등)
//   dist/sitemap.xml               위 페이지 포함
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { policyInfo } from '../src/lib/policy.mjs';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(WEB, 'dist');
const SITE = 'https://supgaja.com';
const status = JSON.parse(fs.readFileSync(path.join(WEB, 'public/data/status.json'), 'utf8'));
let changes = [];
try { changes = JSON.parse(fs.readFileSync(path.join(WEB, 'public/data/changes.json'), 'utf8')).items || []; } catch { /* 없으면 빈 목록 */ }
const HOLIDAYS = JSON.parse(fs.readFileSync(path.join(WEB, 'src/lib/holidays.json'), 'utf8'));

// ---- 날짜 ----
const isoOf = (ymd) => `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
const toUTC = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const addDays = (iso, n) => new Date(toUTC(iso) + n * 864e5).toISOString().slice(0, 10);
const diff = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 864e5);
const dow = (iso) => new Date(toUTC(iso)).getUTCDay();
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const isRest = (iso) => dow(iso) === 0 || dow(iso) === 6 || !!HOLIDAYS[iso];
const isWeekendStay = (iso) => isRest(addDays(iso, 1));
const md = (iso) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`;
const mdw = (iso) => `${md(iso)}(${DOW[dow(iso)]})`;
const kindName = (k) => (k === '01' ? '숙소' : '야영장');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtWon = (n) => (n >= 10000 ? `${(n / 10000).toFixed(1).replace(/\.0$/, '')}만원` : `${n.toLocaleString()}원`);

const start = isoOf(status.start);
const generatedAt = status.generatedAt;
// 빌드 환경의 ICU 에 따라 toLocaleString 결과가 달라지므로(예: 'PM') 직접 KST 로 만든다
const kstFmt = (iso) => { const k = new Date(Date.parse(iso) + 9 * 3600e3).toISOString(); return `${+k.slice(5, 7)}/${+k.slice(8, 10)} ${k.slice(11, 16)}`; };
const kstTime = kstFmt(generatedAt);
const generatedKST = new Date(Date.parse(generatedAt) + 9 * 3600e3).toISOString().replace('Z', '+09:00').replace(/\.\d+/, '');

// 오늘처럼 모든 객실이 '정보 없음'인 앞쪽 날짜는 건너뛴다(웹 firstDataIdx 와 같은 규칙)
let first = 0;
outer: for (let i = 0; i < status.days; i++) for (const f of status.forests) for (const g of f.goods) if (g.s[i] && g.s[i] !== '.') { first = i; break outer; }
const firstISO = addDays(start, first);

// 지역 묶음(웹 SIDOS 와 같은 코드)
const REGIONS = [
  { code: '1', slug: 'gyeonggi', name: '경기·서울·인천', short: '경기' },
  { code: '2', slug: 'gangwon', name: '강원', short: '강원' },
  { code: '3', slug: 'chungbuk', name: '충북', short: '충북' },
  { code: '4', slug: 'chungnam', name: '충남·대전', short: '충남' },
  { code: '5', slug: 'jeonbuk', name: '전북', short: '전북' },
  { code: '6', slug: 'jeonnam', name: '전남·광주', short: '전남' },
  { code: '7', slug: 'gyeongbuk', name: '경북·대구', short: '경북' },
  { code: '8', slug: 'gyeongnam', name: '경남·부산', short: '경남' },
  { code: '9', slug: 'jeju', name: '제주', short: '제주' },
];
const regionOf = (f) => REGIONS.find((r) => r.code === f.sido);

// 이번 주말·다음 주말(웹 FilterBar 와 같은 규칙: 토요일 체크인과 그 전날 금요일 체크인)
const sat0 = addDays(firstISO, (6 - dow(firstISO) + 7) % 7);
const clampISO = (d) => (d < firstISO ? firstISO : d > addDays(start, status.days - 1) ? addDays(start, status.days - 1) : d);
const PERIODS = [
  { slug: '', name: '', title: '', from: firstISO, to: addDays(start, status.days - 1), weekend: false },
  { slug: 'this-weekend', name: '이번 주말', from: clampISO(addDays(sat0, -1)), to: clampISO(sat0), weekend: true },
  { slug: 'next-weekend', name: '다음 주말', from: clampISO(addDays(sat0, 6)), to: clampISO(addDays(sat0, 7)), weekend: true },
];

// ---- 휴양림별 집계 ----
// avail[kind][i] = 그날 체크인 가능한 객실 목록
function availability(f) {
  const out = { '01': new Map(), '02': new Map() };
  for (const g of f.goods) {
    for (let i = first; i < g.s.length; i++) {
      if (g.s[i] !== 'A') continue;
      const m = out[g.kind] || (out[g.kind] = new Map());
      if (!m.has(i)) m.set(i, []);
      m.get(i).push(g);
    }
  }
  return out;
}
const weekendPrice = (f, kind) => {
  const xs = f.goods.filter((g) => g.kind === kind && g.pr?.[1]).map((g) => g.pr[1]);
  return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length / 100) * 100 : null;
};
const rateOf = (f, kind) => {
  const b = f.booking?.[kind];
  if (!b) return { we: null, wd: null };
  const pct = ([a, n]) => (n >= 10 ? Math.round((a / n) * 100) : null);
  return { we: pct(b.we), wd: pct(b.wd) };
};
const AV = new Map(status.forests.map((f) => [f.id, availability(f)]));
const goodsIndex = new Map();
for (const f of status.forests) for (const g of f.goods) goodsIndex.set(g.id, { f, g });

// ---- 1. 알림 피드 ----
// 항목 단위: 휴양림 × 체크인 날짜 × 시설 유형(숙소/야영장). 그날 1박 예약가능 객실이 1개 이상이면 담는다.
const feedItems = [];
for (const f of status.forests) {
  const av = AV.get(f.id);
  for (const kind of ['01', '02']) {
    for (const [i, list] of [...(av[kind] || new Map())].sort((a, b) => a[0] - b[0])) {
      const date = addDays(start, i);
      const type = kindName(kind);
      feedItems.push({
        id: `${f.id}:${date}:${type}`,
        title: `${f.name} ${type} ${mdw(date)}`,
        url: `${SITE}/?forest=${encodeURIComponent(f.id)}&from=${date}`,
        attrs: {
          forest: f.name.replace(/자연휴양림$/, '') || f.name, forestId: f.id, region: f.sidoName,
          date, type, weekday: DOW[dow(date)], weekend: isWeekendStay(date),
          people: Math.max(...list.map((g) => g.cap || 0)), rooms: list.length,
        },
      });
    }
  }
}
const feed = { site: 'supgaja.com', generatedAt: generatedKST, source: '숲나들e 월별 예약현황(1박 체크인 기준)', items: feedItems };
fs.writeFileSync(path.join(DIST, 'alerts-feed.json'), JSON.stringify(feed));

// ---- 2. 정적 페이지 공통 틀 ----
// 운영자의 다른 서비스(공통 데이터: src/lib/network.json, 웹과 같이 읽는다. 이슈 #2)
const NETWORK = JSON.parse(fs.readFileSync(path.join(WEB, 'src/lib/network.json'), 'utf8'));
const networkBand = `<div class="netwrap"><nav class="netband" aria-label="운영자의 다른 서비스"><div class="netband-in"><h2>운영자의 다른 서비스</h2><ul>${NETWORK.sites
  .filter((s) => s.url !== NETWORK.self)
  .map((s) => `<li><a href="${s.url}/?utm_source=${NETWORK.utm.source}&amp;utm_medium=${NETWORK.utm.medium}" target="_blank" rel="noopener"><span class="nb-i" aria-hidden="true">${s.icon}</span><span class="nb-t"><b>${esc(s.name)}</b><span>${esc(s.desc)}</span></span></a></li>`)
  .join('')}</ul></div></nav></div>`;
const CSS = `
:root{--bg:#f6f5f0;--surface:#fff;--surface-2:#f0efe8;--line:#e2e0d6;--line-strong:#cfccbf;--ink:#1d2420;--ink-2:#4b5650;--ink-3:#646e68;--brand:#1f5f3f;--brand-soft:#e3efe6;--open:#1f7a4a;--new:#9a4508;--new-soft:#fdf0e3;--rest:#c0392b;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root:not([data-theme='light']){--bg:#121614;--surface:#1a201c;--surface-2:#222a25;--line:#2f3933;--line-strong:#46534b;--ink:#e7ece8;--ink-2:#b4bfb8;--ink-3:#939f98;--brand:#7cc79c;--brand-soft:#1f3328;--open:#7cc79c;--new:#f2a65a;--new-soft:#3a2a1a;--rest:#ff8a7a}}
:root[data-theme='dark']{--bg:#121614;--surface:#1a201c;--surface-2:#222a25;--line:#2f3933;--line-strong:#46534b;--ink:#e7ece8;--ink-2:#b4bfb8;--ink-3:#939f98;--brand:#7cc79c;--brand-soft:#1f3328;--open:#7cc79c;--new:#f2a65a;--new-soft:#3a2a1a;--rest:#ff8a7a}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);line-height:1.6;font-family:'Pretendard Variable',Pretendard,system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;word-break:keep-all;overflow-wrap:anywhere}
a{color:var(--brand)}
.top{background:var(--surface);border-bottom:1px solid var(--line)}
.top .in{max-width:900px;margin:0 auto;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.brand{display:inline-flex;align-items:center;gap:8px;color:var(--ink);font-weight:700;text-decoration:none}
.brand-mark{width:28px;height:28px;border-radius:8px;background:#1f5f3f;display:inline-flex;align-items:center;justify-content:center}
.brand-mark svg{width:20px;height:20px}
.back{font-size:.9rem;color:var(--ink-2);text-decoration:none;min-height:44px;display:inline-flex;align-items:center}
main{max-width:900px;margin:0 auto;padding:20px 16px 48px}
.crumb{font-size:.85rem;color:var(--ink-3);margin:0 0 6px}
.crumb a{color:var(--ink-3)}
h1{margin:0;font-size:1.5rem;letter-spacing:-.02em;line-height:1.35}
h2{font-size:1.1rem;margin:28px 0 10px}
.lead{margin:8px 0 0;color:var(--ink-2)}
.stamp{display:inline-block;margin:12px 0 0;font-size:.82rem;color:var(--ink-2);background:var(--surface-2);border-radius:999px;padding:4px 12px}
.badge{display:inline-block;font-size:.75rem;font-weight:700;padding:1px 8px;border-radius:6px;background:var(--brand-soft);color:var(--brand);vertical-align:middle}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:16px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.card .k{font-size:.8rem;color:var(--ink-3)}
.card .v{font-size:1.25rem;font-weight:800}
.card .v small{font-size:.8rem;font-weight:600;color:var(--ink-2);margin-left:2px}
.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.btn{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 16px;border-radius:10px;border:1px solid var(--line-strong);background:var(--surface);color:var(--ink);font-weight:700;font-size:.92rem;text-decoration:none;cursor:pointer;font-family:inherit}
.btn.primary{background:#1f5f3f;border-color:#1f5f3f;color:#fff}
.btn.alert{border-color:var(--new);color:var(--new)}
.note{background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--brand);border-radius:10px;padding:10px 14px;font-size:.9rem;color:var(--ink-2);margin-top:12px}
table{width:100%;border-collapse:collapse;background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden;font-size:.9rem}
th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{background:var(--surface-2);font-size:.8rem;color:var(--ink-2)}
tr:last-child td{border-bottom:0}
.rest{color:var(--rest);font-weight:700}
.num{font-weight:800;color:var(--open)}
.new{display:inline-block;font-size:.72rem;font-weight:800;color:var(--new);background:var(--new-soft);border-radius:6px;padding:0 6px;margin-left:4px}
ul.flist{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px}
ul.flist li{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:8px 12px}
ul.flist a{font-weight:700;text-decoration:none;display:inline-block;min-height:24px}
.fsub{font-size:.8rem;color:var(--ink-3)}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chips a{display:inline-flex;align-items:center;min-height:36px;padding:0 12px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink-2);font-size:.85rem;font-weight:600;text-decoration:none}
.chips a[aria-current]{background:#1f5f3f;border-color:#1f5f3f;color:#fff}
footer{max-width:900px;margin:0 auto;padding:24px 16px 96px;border-top:1px solid var(--line);font-size:.82rem;color:var(--ink-3)}
footer nav{display:flex;flex-wrap:wrap;gap:4px 14px;margin:8px 0}
footer nav a{color:var(--ink-2);display:inline-block;min-height:24px}
.netwrap{max-width:900px;margin:32px auto 24px;padding:0 16px}
.netband { margin: 0; padding: 24px 0; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-2); font-size: 14px; word-break: keep-all; overflow-wrap: break-word; }
.netband-in { padding: 0 16px; }
.netband h2 { margin: 0 0 16px; font-size: 18px; font-weight: 700; line-height: 1.4; color: var(--ink); }
.netband ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.netband ul a { display: flex; height: 100%; box-sizing: border-box; align-items: flex-start; gap: 12px; padding: 12px; border: 1px solid var(--line); border-radius: 8px;
  background: var(--surface); color: var(--ink); text-decoration: none; transition: transform .15s, border-color .15s, box-shadow .15s; }
.netband ul a:hover { transform: translateY(-2px); border-color: var(--brand); box-shadow: 0 4px 10px rgba(0, 0, 0, .12); }
.netband ul a:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
.netband .nb-i { width: 32px; flex-shrink: 0; text-align: center; font-size: 24px; line-height: 1; }
.netband .nb-t { min-width: 0; }
.netband .nb-t b { margin: 0; display: block; font-size: 16px; font-weight: 700; line-height: 1.375; color: var(--ink); }
.netband .nb-t span { display: block; font-size: 14px; line-height: 1.5; color: var(--ink-2); }
@media (min-width: 640px) { .netband ul { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (min-width: 1024px) { .netband ul { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
@media (prefers-reduced-motion: reduce) { .netband ul a { transition: none; } .netband ul a:hover { transform: none; } }
@media (max-width: 480px) { .netwrap { padding: 0; } .netband { border-left-width: 0; border-right-width: 0; border-radius: 0; } }
@media (max-width:600px){h1{font-size:1.25rem}th,td{padding:7px 8px}.hide-sm{display:none}}
`;
const GA = `<script async src="https://www.googletagmanager.com/gtag/js?id=G-7W5GR0VK33"></script>
<script>if(location.hostname==='supgaja.com'){window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-7W5GR0VK33');}</script>`;
// 알림 버튼: 중앙 alerts.js(딸깍랭크)가 아직 없거나 못 불러와도 안내만 띄운다
// 알림 모듈(alerts.js)은 버튼을 처음 누를 때 불러온다(src/lib/alerts.ts 와 같은 방식)
const ALERT_JS = `<script>
(function(){var soon='빈자리 이메일 알림은 곧 제공됩니다. 준비되면 이 버튼으로 바로 신청할 수 있어요.';
function ok(){return window.SiteAlerts&&typeof window.SiteAlerts.open==='function'}
function load(cb){if(ok())return cb(true);var s=document.createElement('script'),done=false;function fin(v){if(!done){done=true;cb(v)}}s.src='https://ddalkkakrank.kr/alerts.js';s.async=true;s.onload=function(){fin(ok())};s.onerror=function(){fin(false)};setTimeout(function(){fin(false)},8000);document.head.appendChild(s)}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-alert]');if(!b)return;e.preventDefault();var o;try{o=JSON.parse(b.getAttribute('data-alert'))}catch(_){return}
load(function(v){if(v){try{window.SiteAlerts.open(o);return}catch(_){}}alert(soon)})});})();
try{var th=localStorage.getItem('theme');if(th)document.documentElement.dataset.theme=th}catch(_){}
</script>`;
const alertAttr = (o) => esc(JSON.stringify({ site: 'supgaja.com', ...o }));

function page({ urlPath, title, description, body, jsonld = [] }) {
  const url = SITE + urlPath;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Organization', name: '숲가자', url: SITE + '/', logo: SITE + '/icon-512.png', founder: { '@type': 'Person', name: 'chanyong' }, email: 'cyjung@gmail.com' },
    ...jsonld,
  ];
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${url}" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta name="theme-color" content="#1f5f3f" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="숲가자" />
<meta property="og:locale" content="ko_KR" />
<meta property="og:url" content="${url}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${SITE}/og-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${SITE}/og-image.png" />
${ld.map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, '\\u003c')}</script>`).join('\n')}
${GA}
<style>${CSS}</style>
${ALERT_JS}
</head>
<body>
<header class="top"><div class="in">
  <a class="brand" href="/"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M16 3l-8 11h4.5l-6 8H13v6h6v-6h6.5l-6-8H24z" fill="#e8f3ea" /></svg></span>숲가자</a>
  <a class="back" href="/">← 전국 빈자리 찾기</a>
</div></header>
<main>
${body}
</main>
${networkBand}
<footer>
  <p>숲가자는 숲나들e(foresttrip.go.kr)에 공개된 월별 예약현황을 약 3시간마다 모아 보여 주는 <b>비공식 참고용</b> 서비스입니다. 실제 예약 가능 여부는 수집 이후 바뀌었을 수 있으니 예약·결제는 <a href="https://www.foresttrip.go.kr" target="_blank" rel="noopener">숲나들e</a>에서 확인하세요.</p>
  <nav aria-label="사이트 링크"><a href="/">빈자리 찾기</a><a href="/forest/">휴양림 전체 목록</a><a href="/vacancy/all/this-weekend/">이번 주말 빈자리</a><a href="/faq.html">자주 묻는 질문</a><a href="/privacy">개인정보처리방침</a><a href="/terms">이용약관</a></nav>
</footer>
<script src="https://ddalkkakrank.kr/feedback.js" defer data-color="#0b6e4f"></script>
</body>
</html>
`;
}
const write = (rel, html) => {
  const file = path.join(DIST, rel, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
};
const stampLine = `<p class="stamp">마지막 갱신 ${esc(kstTime)} · 출처 숲나들e 월별 예약현황 · 1박 체크인 기준, 약 3시간마다 갱신</p>`;

// ---- 3. 휴양림별 페이지 ----
const recentByForest = new Map(); // 최근 72시간 안에 새로 열린(취소 등) 자리 중 지금도 비어 있는 것
for (const c of changes) {
  const x = goodsIndex.get(c.goods);
  if (!x) continue;
  const i = diff(start, isoOf(c.date));
  if (i < first || x.g.s[i] !== 'A') continue;
  if (!recentByForest.has(c.forest)) recentByForest.set(c.forest, []);
  recentByForest.get(c.forest).push({ ...c, g: x.g, iso: isoOf(c.date) });
}

const forestUrl = (f) => `/forest/${encodeURIComponent(f.id)}`;
const urls = [];
for (const f of status.forests) {
  const reg = regionOf(f);
  const av = AV.get(f.id);
  const kinds = ['01', '02'].filter((k) => f.goods.some((g) => g.kind === k));
  const countOf = (k) => f.goods.filter((g) => g.kind === k).length;
  const dates = [...new Set(kinds.flatMap((k) => [...(av[k] || new Map()).keys()]))].sort((a, b) => a - b);
  const total = kinds.reduce((n, k) => n + [...(av[k] || new Map()).values()].reduce((m, l) => m + l.length, 0), 0);
  const nearest = dates.length ? addDays(start, dates[0]) : null;
  const weekendDates = dates.filter((i) => isWeekendStay(addDays(start, i)));
  const recent = (recentByForest.get(f.id) || []).sort((a, b) => b.at.localeCompare(a.at) || a.iso.localeCompare(b.iso));
  const newNow = new Set(recent.filter((c) => c.at === generatedAt).map((c) => `${c.g.kind}:${c.iso}`));
  const pol = policyInfo(f.policy, generatedAt);
  const prices = kinds.map((k) => [k, weekendPrice(f, k)]).filter(([, p]) => p != null);

  const rows = dates.slice(0, 60).map((i) => {
    const iso = addDays(start, i);
    const cells = kinds.map((k) => {
      const n = av[k]?.get(i)?.length || 0;
      return `<td>${n ? `<span class="num">${n}</span>${k === '01' ? '실' : '곳'}${newNow.has(`${k}:${iso}`) ? '<span class="new">NEW</span>' : ''}` : '<span class="fsub">-</span>'}</td>`;
    }).join('');
    return `<tr><td><span class="${isWeekendStay(iso) ? 'rest' : ''}">${mdw(iso)}</span>${HOLIDAYS[iso] ? ` <span class="fsub">${esc(HOLIDAYS[iso])}</span>` : ''}</td>${cells}</tr>`;
  }).join('');

  const desc = `${f.name}(${f.sidoName} ${f.sigungu}) ${kinds.map(kindName).join('·')} 예약 빈자리와 취소표를 날짜별로 정리했습니다. ` +
    (nearest ? `가장 가까운 빈자리 ${mdw(nearest)}, 예약가능 ${total.toLocaleString()}건.` : '지금은 예약가능한 날짜가 없습니다.') + ' 3시간마다 갱신.';
  const nearby = status.forests.filter((x) => x.sido === f.sido && x.id !== f.id)
    .map((x) => ({ x, n: [...Object.values(AV.get(x.id))].reduce((m, mp) => m + mp.size, 0) }))
    .sort((a, b) => b.n - a.n).slice(0, 12);

  const body = `
<p class="crumb"><a href="/">홈</a> › <a href="/forest/">휴양림</a> › <a href="/vacancy/${reg?.slug}/">${esc(reg?.name || f.sidoName)}</a></p>
<h1>${esc(f.name)} 빈자리·예약 현황</h1>
<p class="lead"><span class="badge">${esc(f.type)}</span> ${esc(f.addr || `${f.sidoName} ${f.sigungu}`)}${f.tel ? ` · <a href="tel:${esc(f.tel)}">${esc(f.tel)}</a>` : ''}${f.checkin ? ` · 입실 ${esc(f.checkin)}` : ''}${f.checkout ? ` · 퇴실 ${esc(f.checkout)}` : ''}</p>
${stampLine}
<div class="cards">
  ${kinds.map((k) => `<div class="card"><div class="k">${kindName(k)}</div><div class="v">${countOf(k)}<small>${k === '01' ? '실' : '곳'}</small></div></div>`).join('')}
  <div class="card"><div class="k">예약가능 객실·날짜</div><div class="v">${total.toLocaleString()}<small>건</small></div></div>
  <div class="card"><div class="k">가장 가까운 빈자리</div><div class="v">${nearest ? mdw(nearest) : '없음'}</div></div>
  <div class="card"><div class="k">주말(금·토·연휴 전날) 빈자리</div><div class="v">${weekendDates.length}<small>일</small></div></div>
  ${prices.map(([k, p]) => `<div class="card"><div class="k">${kindName(k)} 주말 1박 평균</div><div class="v">${fmtWon(p)}</div></div>`).join('')}
  ${kinds.map((k) => { const r = rateOf(f, k); return r.we != null || r.wd != null ? `<div class="card"><div class="k">${kindName(k)} 예약률(주말/평일)</div><div class="v">${r.we ?? '-'}%<small>/ ${r.wd ?? '-'}%</small></div></div>` : ''; }).join('')}
</div>
<div class="actions">
  <a class="btn primary" href="/?forest=${encodeURIComponent(f.id)}">객실별 날짜 자세히 보기</a>
  <button type="button" class="btn alert" data-alert="${alertAttr({ label: `${f.name} 빈자리`, filters: [{ key: 'forestId', op: 'eq', value: f.id }] })}">🔔 빈자리 알림 받기</button>
  <a class="btn" href="https://www.foresttrip.go.kr/rep/or/sssn/monthRsrvtStatus.do?hmpgId=FRIP&amp;menuId=001004" target="_blank" rel="noopener">숲나들e에서 예약 ↗</a>
  ${f.url ? `<a class="btn" href="${esc(f.url)}" target="_blank" rel="noopener">휴양림 홈페이지 ↗</a>` : ''}
</div>
${pol ? `<h2>예약은 언제 열리나요?</h2><div class="note">${pol.html}</div>` : ''}
${recent.length ? `<h2>최근 새로 빈 자리 <span class="fsub">(최근 72시간 안에 예약완료·대기에서 예약가능으로 바뀐 자리, 지금도 비어 있음)</span></h2>
<ul class="flist">${recent.slice(0, 12).map((c) => `<li><b>${mdw(c.iso)}</b> ${esc(c.g.cls)} ${esc(c.g.name)}${c.at === generatedAt ? '<span class="new">NEW</span>' : ''}<div class="fsub">${kstFmt(c.at)} 수집에서 확인</div></li>`).join('')}</ul>` : ''}
<h2>날짜별 빈자리 <span class="fsub">(체크인 날짜 기준 1박, 빨간 날짜는 주말·연휴 숙박)</span></h2>
${dates.length ? `<table><thead><tr><th>체크인</th>${kinds.map((k) => `<th>${kindName(k)} 예약가능</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
${dates.length > 60 ? `<p class="fsub">외 ${dates.length - 60}일 더 있음 — <a href="/?forest=${encodeURIComponent(f.id)}">전체 보기</a></p>` : ''}` : '<p class="note">지금은 숲나들e에 예약가능으로 표시된 날짜가 없습니다. 취소가 나오면 알림으로 받아 보세요.</p>'}
${nearby.length ? `<h2>${esc(reg?.name || f.sidoName)}의 다른 휴양림</h2><ul class="flist">${nearby.map(({ x, n }) => `<li><a href="${forestUrl(x)}">${esc(x.name)}</a><div class="fsub">${esc(x.sigungu)} · 빈자리 ${n}일</div></li>`).join('')}</ul>` : ''}
`;
  const ld = [{
    '@context': 'https://schema.org', '@type': 'LodgingBusiness', name: f.name, url: f.url || SITE + forestUrl(f),
    ...(f.tel ? { telephone: f.tel } : {}),
    address: { '@type': 'PostalAddress', streetAddress: f.addr || undefined, addressRegion: f.sidoName, addressLocality: f.sigungu, addressCountry: 'KR' },
    ...(f.lat != null ? { geo: { '@type': 'GeoCoordinates', latitude: f.lat, longitude: f.lng } } : {}),
    ...(f.checkin ? { checkinTime: f.checkin } : {}), ...(f.checkout ? { checkoutTime: f.checkout } : {}),
  }, {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '숲가자', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: '휴양림', item: SITE + '/forest/' },
      { '@type': 'ListItem', position: 3, name: f.name, item: SITE + forestUrl(f) },
    ],
  }];
  write(`forest/${f.id}`, page({ urlPath: forestUrl(f), title: `${f.name} 빈자리·예약 현황 (${f.sidoName} ${f.sigungu}) · 숲가자`, description: desc, body, jsonld: ld }));
  urls.push({ loc: forestUrl(f), freq: 'daily', pri: '0.7' });
}

// ---- 4. 휴양림 전체 목록 ----
{
  const body = `
<p class="crumb"><a href="/">홈</a> › 휴양림</p>
<h1>전국 자연휴양림 ${status.forests.length}곳 빈자리 현황</h1>
<p class="lead">숲나들e에서 예약을 받는 국립·공립·사립 자연휴양림을 지역별로 모았습니다. 휴양림을 누르면 날짜별 빈자리와 예약 오픈 일정을 볼 수 있습니다.</p>
${stampLine}
${REGIONS.map((r) => {
    const fs_ = status.forests.filter((f) => f.sido === r.code).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    if (!fs_.length) return '';
    return `<h2 id="${r.slug}">${esc(r.name)} <span class="fsub">${fs_.length}곳 · <a href="/vacancy/${r.slug}/this-weekend/">이번 주말 빈자리</a></span></h2>
<ul class="flist">${fs_.map((f) => { const n = Object.values(AV.get(f.id)).reduce((m, mp) => m + mp.size, 0); return `<li><a href="${forestUrl(f)}">${esc(f.name)}</a><div class="fsub">${esc(f.type)} · ${esc(f.sigungu)} · 빈자리 ${n ? `${n}일` : '없음'}</div></li>`; }).join('')}</ul>`;
  }).join('\n')}`;
  write('forest', page({ urlPath: '/forest/', title: `전국 자연휴양림 ${status.forests.length}곳 빈자리 현황 · 숲가자`, description: `전국 국립·공립·사립 자연휴양림 ${status.forests.length}곳을 지역별로 모아 휴양림마다 숙소·야영장 예약 빈자리와 예약 오픈 일정을 정리했습니다. 3시간마다 갱신.`, body }));
  urls.push({ loc: '/forest/', freq: 'daily', pri: '0.8' });
}

// ---- 5. 지역·시기 랜딩 ----
const ALL = { code: '', slug: 'all', name: '전국', short: '전국' };
for (const r of [ALL, ...REGIONS]) {
  for (const p of PERIODS) {
    if (r === ALL && !p.slug) continue; // 전국 전체 기간은 홈과 같다
    const lo = diff(start, p.from), hi = diff(start, p.to);
    const list = [];
    for (const f of status.forests) {
      if (r.code && f.sido !== r.code) continue;
      const av = AV.get(f.id);
      const byDate = [];
      for (let i = Math.max(lo, first); i <= hi; i++) {
        const iso = addDays(start, i);
        if (p.weekend && !isWeekendStay(iso)) continue;
        const a = av['01']?.get(i)?.length || 0, b = av['02']?.get(i)?.length || 0;
        if (a || b) byDate.push({ iso, a, b });
      }
      if (byDate.length) list.push({ f, byDate, n: byDate.reduce((m, d) => m + d.a + d.b, 0) });
    }
    list.sort((x, y) => y.n - x.n);
    const when = p.slug ? `${p.name}(${mdw(p.from)}${p.to !== p.from ? `~${mdw(p.to)}` : ''} 체크인)` : '';
    const title = p.slug ? `${p.name} ${r.name} 자연휴양림 빈자리` : `${r.name} 자연휴양림 빈자리·취소표`;
    const urlPath = `/vacancy/${r.slug}/${p.slug ? p.slug + '/' : ''}`;
    const appQs = new URLSearchParams({ ...(r.code ? { sidos: r.code } : {}), from: p.from, to: p.to, ...(p.weekend ? { weekend: '1' } : {}) }).toString();
    const alertFilters = [
      ...(r.code ? [{ key: 'region', op: 'eq', value: status.forests.find((f) => f.sido === r.code)?.sidoName }] : []),
      { key: 'date', op: 'between', value: [p.from, p.to] },
      ...(p.weekend ? [{ key: 'weekend', op: 'eq', value: true }] : []),
    ];
    const body = `
<p class="crumb"><a href="/">홈</a> › <a href="/forest/">휴양림</a> › ${esc(r.name)}${p.slug ? ` › ${p.name}` : ''}</p>
<h1>${esc(title)}</h1>
<p class="lead">${p.slug ? `${when} ` : ''}${esc(r.name)} 자연휴양림 숙소·야영장 중 숲나들e에 예약가능으로 나온 곳 <b>${list.length}곳</b>입니다. 빈자리가 많은 순으로 정리했습니다.</p>
${stampLine}
<nav class="chips" aria-label="시기" style="margin-top:14px">${PERIODS.filter((q) => r !== ALL || q.slug).map((q) => `<a href="/vacancy/${r.slug}/${q.slug ? q.slug + '/' : ''}"${q === p ? ' aria-current="page"' : ''}>${q.slug ? q.name : '전체 기간'}</a>`).join('')}</nav>
<nav class="chips" aria-label="지역" style="margin-top:8px">${[ALL, ...REGIONS].filter((x) => x !== ALL || p.slug).map((x) => `<a href="/vacancy/${x.slug}/${p.slug ? p.slug + '/' : ''}"${x === r ? ' aria-current="page"' : ''}>${esc(x.name)}</a>`).join('')}</nav>
<div class="actions">
  <a class="btn primary" href="/?${esc(appQs)}">조건 그대로 숲가자에서 보기</a>
  <button type="button" class="btn alert" data-alert="${alertAttr({ label: `${r.name} 휴양림${p.slug ? ` · ${md(p.from)}~${md(p.to)} 주말` : ''} 빈자리`, filters: alertFilters })}">🔔 빈자리 알림 받기</button>
</div>
${list.length ? `<table style="margin-top:16px"><thead><tr><th>휴양림</th><th>빈자리(체크인 날짜 · 숙소/야영장)</th></tr></thead><tbody>
${list.slice(0, 80).map(({ f, byDate }) => `<tr><td><a href="${forestUrl(f)}"><b>${esc(f.name)}</b></a><div class="fsub">${esc(f.type)} · ${esc(f.sigungu)}</div></td><td>${byDate.slice(0, 8).map((d) => `<span class="${isWeekendStay(d.iso) ? 'rest' : ''}">${mdw(d.iso)}</span> ${d.a ? `숙소 <span class="num">${d.a}</span>` : ''}${d.a && d.b ? ' · ' : ''}${d.b ? `야영 <span class="num">${d.b}</span>` : ''}`).join('<br>')}${byDate.length > 8 ? `<div class="fsub">외 ${byDate.length - 8}일</div>` : ''}</td></tr>`).join('\n')}
</tbody></table>${list.length > 80 ? `<p class="fsub">외 ${list.length - 80}곳은 <a href="/?${esc(appQs)}">숲가자에서 보기</a></p>` : ''}` : '<p class="note">지금은 이 조건에 예약가능한 자리가 없습니다. 취소표가 나오면 알림으로 받아 보세요.</p>'}
`;
    const desc = `${p.slug ? when + ' ' : ''}${r.name} 자연휴양림 숙소·야영장 예약 빈자리 ${list.length}곳을 빈자리 많은 순으로 정리했습니다. 숲나들e 예약현황을 3시간마다 모아 갱신합니다.`;
    write(urlPath.slice(1, -1), page({ urlPath, title: `${title} · 숲가자`, description: desc, body }));
    urls.push({ loc: urlPath, freq: 'hourly', pri: p.slug ? '0.7' : '0.6' });
  }
}

// ---- 6. FAQ 페이지 FAQPage 구조화 데이터(질문·답 원문에서 생성) ----
{
  const file = path.join(DIST, 'faq.html');
  const html = fs.readFileSync(file, 'utf8');
  const strip = (x) => x.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const qa = [...html.matchAll(/<details class="item"><summary>([\s\S]*?)<\/summary><div class="a">([\s\S]*?)<\/div><\/details>/g)]
    .map(([, q, a]) => ({ '@type': 'Question', name: strip(q), acceptedAnswer: { '@type': 'Answer', text: strip(a) } }));
  const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qa };
  fs.writeFileSync(file, html.replace('<!--FAQ_JSONLD-->', `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`));
  console.log(`FAQPage 질문 ${qa.length}개`);
}

// ---- 7. sitemap ----
const today = generatedKST.slice(0, 10);
const fixed = [
  { loc: '/', freq: 'hourly', pri: '1.0' },
  { loc: '/?view=map', freq: 'hourly', pri: '0.8' },
  { loc: '/?view=calendar', freq: 'hourly', pri: '0.8' },
  { loc: '/?view=grid', freq: 'hourly', pri: '0.6' },
  { loc: '/faq.html', freq: 'monthly', pri: '0.5' },
  { loc: '/privacy', freq: 'yearly', pri: '0.2' },
  { loc: '/terms', freq: 'yearly', pri: '0.2' },
];
const sm = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...fixed, ...urls].map((u) => `  <url><loc>${esc(SITE + u.loc)}</loc>${u.freq === 'yearly' || u.freq === 'monthly' ? '' : `<lastmod>${today}</lastmod>`}<changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sm);

const kb = (f) => (fs.statSync(path.join(DIST, f)).size / 1024).toFixed(0) + 'KB';
console.log(`정적 생성: 알림 피드 ${feedItems.length}건(${kb('alerts-feed.json')}) · 휴양림 페이지 ${status.forests.length} · 랜딩 ${urls.length - status.forests.length - 1} · sitemap ${fixed.length + urls.length}개 URL`);
