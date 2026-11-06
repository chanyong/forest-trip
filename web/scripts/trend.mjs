// 휴양림 상세 페이지의 '최근 4주 빈자리 추이' 작은 차트 (정적 생성용, 이슈 #15)
// 입력: data/history/YYYYMMDD.json 들 (collector/history.mjs 가 쌓음)
import fs from 'node:fs';
import path from 'node:path';

export const TREND_DAYS = 28;

export function loadHistory(dir) {
  let names = [];
  try { names = fs.readdirSync(dir).filter((n) => /^\d{8}\.json$/.test(n)).sort(); } catch { return []; }
  const out = [];
  for (const n of names) {
    try { out.push(JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'))); } catch { /* 깨진 파일은 건너뜀 */ }
  }
  return out;
}

// 휴양림 하나의 최근 days일 점수열: [{ date, a:[숙소, 야영장], r:[숙소%, 야영장%] }]
export function seriesOf(history, forestId, days = TREND_DAYS) {
  const pts = history.filter((h) => h.f?.[forestId]).map((h) => {
    const [a1, a2, r1, r2] = h.f[forestId];
    return { date: h.date, a: [a1, a2], r: [r1, r2] };
  });
  if (!pts.length) return [];
  const last = pts[pts.length - 1].date;
  const t = (s) => Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
  return pts.filter((p) => (t(last) - t(p.date)) / 864e5 < days);
}

const md = (s) => `${+s.slice(4, 6)}/${+s.slice(6, 8)}`;

// 선 그래프 하나(SVG). pts: [{date, v}] (v 가 null 인 날은 선을 끊음)
function chart(pts, label, unit) {
  const W = 320, H = 96, L = 8, R = 8, T = 10, B = 18;
  const vals = pts.map((p) => p.v).filter((v) => v != null);
  if (!vals.length) return '';
  const max = Math.max(...vals, 1);
  const x = (i) => L + (pts.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (pts.length - 1));
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const segs = [];
  let cur = [];
  pts.forEach((p, i) => {
    if (p.v == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push(`${x(i).toFixed(1)},${y(p.v).toFixed(1)}`);
  });
  if (cur.length) segs.push(cur);
  const lines = segs.map((s) => (s.length > 1 ? `<polyline points="${s.join(' ')}" fill="none" stroke="var(--brand)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : `<circle cx="${s[0].split(',')[0]}" cy="${s[0].split(',')[1]}" r="2.5" fill="var(--brand)"/>`)).join('');
  const lastI = pts.length - 1;
  const lv = pts[lastI].v;
  const dot = lv != null ? `<circle cx="${x(lastI).toFixed(1)}" cy="${y(lv).toFixed(1)}" r="3.5" fill="var(--brand)"/>` : '';
  const desc = `${label}: ${md(pts[0].date)}부터 ${md(pts[lastI].date)}까지 ${pts.map((p) => (p.v == null ? '-' : p.v)).join(', ')}${unit}`;
  return `<figure class="trend"><figcaption>${label} <span class="fsub">최고 ${max.toLocaleString()}${unit}</span></figcaption>`
    + `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${desc}">`
    + `<line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="var(--line-strong)" stroke-width="1"/>${lines}${dot}`
    + `<text x="${L}" y="${H - 4}" font-size="10" fill="var(--ink-3)">${md(pts[0].date)}</text>`
    + `<text x="${W - R}" y="${H - 4}" font-size="10" fill="var(--ink-3)" text-anchor="end">${md(pts[lastI].date)}</text></svg></figure>`;
}

// kinds: 이 휴양림이 가진 시설 유형 ['01','02'], kindName: 이름 함수
export function trendSection(history, forestId, kinds, kindName) {
  const pts = seriesOf(history, forestId);
  if (pts.length < 2) {
    return `<h2>빈자리 추이 <span class="fsub">(최근 4주)</span></h2><p class="note">추이를 쌓는 중입니다. 수집된 날이 이틀 이상 되면 여기에 그래프가 나옵니다.</p>`;
  }
  const charts = kinds.map((k) => {
    const i = k === '01' ? 0 : 1;
    const unit = k === '01' ? '건' : '건';
    return chart(pts.map((p) => ({ date: p.date, v: p.a[i] })), `${kindName(k)} 예약가능 건수`, unit);
  }).join('');
  return `<h2>빈자리 추이 <span class="fsub">(최근 4주, 하루 한 번 마지막 수집 기준)</span></h2>
<div class="trends">${charts}</div>
<p class="fsub">예약가능 건수는 그날 수집 시점에 앞으로 조회되는 기간(약 87일)의 예약가능 객실·날짜 칸 수입니다. 값이 줄면 예약이 찼다는 뜻이고, 갑자기 늘면 취소가 나오거나 예약이 새로 열린 것입니다.</p>`;
}
