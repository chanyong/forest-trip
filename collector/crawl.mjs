#!/usr/bin/env node
// 숲나들e 월별현황 비로그인 상태 수집기.
// 입력: data/master.json (휴양림·객실 ID 마스터)
// 출력: web/public/data/status.json, changes.json, meta.json
// 의존성 없음 (Node 20+ fetch 사용).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bookingStats, weekendMask } from './stats.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MASTER = path.join(ROOT, 'data/master.json');
const NAVER = path.join(ROOT, 'data/naver.json'); // collector/naver-reviews.mjs가 만든 리뷰 수
const PRICES = path.join(ROOT, 'data/prices.json'); // collector/prices.mjs가 만든 객실 요금
const OUT_DIR = path.join(ROOT, 'web/public/data');
const BASE = 'https://www.foresttrip.go.kr';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const BATCH = 5; // 서버가 요청당 객실 5개까지만 응답
const CONCURRENCY = Number(process.env.CONCURRENCY || 2);
const DELAY_MS = Number(process.env.DELAY_MS || 350);
const LIMIT_FORESTS = Number(process.env.LIMIT_FORESTS || 0);
const CHANGE_KEEP_HOURS = 72;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = () => DELAY_MS * (0.7 + Math.random() * 0.6);

// ---- KST 날짜 유틸 ----
const kstNow = () => new Date(Date.now() + 9 * 3600e3);
const ymd = (d) => d.toISOString().slice(0, 10).replaceAll('-', '');
const addDays = (s, n) => {
  const d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8) + n));
  return ymd(d);
};
const diffDays = (a, b) =>
  Math.round((Date.UTC(+b.slice(0, 4), +b.slice(4, 6) - 1, +b.slice(6, 8)) -
    Date.UTC(+a.slice(0, 4), +a.slice(4, 6) - 1, +a.slice(6, 8))) / 864e5);

// ---- 세션 (쿠키 + CSRF) ----
class Session {
  cookies = new Map();
  token = null;
  cookieHeader() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '); }
  absorb(res) {
    for (const c of res.headers.getSetCookie?.() || []) {
      const [kv] = c.split(';');
      const i = kv.indexOf('=');
      this.cookies.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim());
    }
  }
  async init() {
    this.cookies.clear();
    const res = await fetch(`${BASE}/main.do?hmpgId=FRIP`, { headers: { 'User-Agent': UA } });
    this.absorb(res);
    const html = await res.text();
    this.token = html.match(/_csrf=([0-9a-f-]{36})/)?.[1];
    if (!this.token) throw new Error('CSRF 토큰을 찾지 못함 (사이트 구조 변경 가능)');
  }
  async post(url, body, attempt = 0) {
    try {
      const res = await fetch(BASE + url, {
        method: 'POST',
        headers: {
          'User-Agent': UA,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Ajax-call': 'true',
          'X-CSRF-TOKEN': this.token,
          Referer: `${BASE}/rep/or/sssn/monthRsrvtStatus.do?hmpgId=FRIP&menuId=001004`,
          Cookie: this.cookieHeader(),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
      this.absorb(res);
      const text = await res.text();
      if (res.status === 403 && attempt < 2) { await this.init(); return this.post(url, body, attempt + 1); }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return JSON.parse(text);
    } catch (e) {
      if (attempt >= 3) throw e;
      await sleep(2000 * 2 ** attempt);
      return this.post(url, body, attempt + 1);
    }
  }
}

// ---- 상태 인코딩: 날짜당 1글자 ----
// A 예약가능 · 1~9 대기(다음 대기 순번) · F 완료 · C 휴무 · R 공사/점검 · P 추첨·우선예약 · . 기간 밖/정보 없음
const unknownCodes = new Map();
function encode(r) {
  switch (r.rsrvtAvail) {
    case 'Y': {
      if (!r.rsrvtCnt) return 'A';
      const max = r.goodsMxmmWtngCnt || 0;
      const w = r.wtngCnt || 0;
      if (r.wtngPssblYn !== 'N' && w < max) return String(Math.min(9, w + 1));
      return 'F';
    }
    case 'PRNSL_DAY': return 'C';
    case 'REPAIR': return 'R';
    case 'DRLTS': // 추첨제 기간
    case 'PRIOR': return 'P'; // 우선예약 기간
    case 'BEFORE_DATE':
    case 'OVER_DATE': return '.';
    default:
      unknownCodes.set(r.rsrvtAvail, (unknownCodes.get(r.rsrvtAvail) || 0) + 1);
      return 'F';
  }
}
const flagsOf = (r) =>
  (r.arcndFclFg === 'Y' ? 'a' : '') + (r.cmDogFclFg === 'Y' ? 'd' : '') + (r.elctyFclFg === 'Y' ? 'e' : '') +
  (r.warmWaterFclFg === 'Y' ? 'w' : '') + (r.dsprsFclFg === 'Y' ? 'h' : '') + (r.vccpFclYn === 'Y' ? 'v' : '');

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; await fn(items[k], k); }
  }));
}

async function main() {
  const t0 = Date.now();
  const master = JSON.parse(await fs.readFile(MASTER, 'utf8'));
  let forests = master.forests;
  if (LIMIT_FORESTS) forests = forests.slice(0, LIMIT_FORESTS);
  let naver = {};
  try { naver = JSON.parse(await fs.readFile(NAVER, 'utf8')); } catch {}
  let prices = {};
  try { prices = JSON.parse(await fs.readFile(PRICES, 'utf8')); } catch {}

  const today = ymd(kstNow());

  const s = new Session();
  await s.init();

  // 휴양림별 예약 가능 마지막 날 (사이트 로직: 월 정책 마감일과 일반예약 전환일 중 늦은 날)
  await pool(forests, CONCURRENCY, async (f) => {
    try {
      const sth = await s.post('/rep/or/selectSthngListForMonthRsrvt.do', { insttId: f.insttId });
      let last = sth.rsrvtPolcy?.monthLastDay || null;
      if (sth.gnrlRsrvtTrnseDtm && (!last || sth.gnrlRsrvtTrnseDtm > last)) last = sth.gnrlRsrvtTrnseDtm;
      f.lastDay = last;
      // 예약 오픈 규칙(숲나들e 예약정책 원문 값): WEEK=매주 rsrvtBgDt(1=일…7=토)요일, MON=매월 rsrvtBgDt일, rsrvtBgnTm 시각
      const p = sth.rsrvtPolcy || {};
      f.policy = p.rsrvtCycleTpeCd ? {
        cycle: p.rsrvtCycleTpeCd, day: p.rsrvtBgDt ?? null, time: String(p.rsrvtBgnTm || '').trim() || null,
        weeks: p.dytmCycleEstbsVal ? Number(p.dytmCycleEstbsVal) : null, lastDay: last,
      } : (last ? { lastDay: last } : null);
    } catch { f.lastDay = null; f.policy = null; }
    await sleep(jitter());
  });
  // 수집 범위: 오늘 ~ 가장 먼 예약 가능일 (최대 120일)
  const maxLast = forests.reduce((m, f) => (f.lastDay && f.lastDay > m ? f.lastDay : m), addDays(today, 35));
  const end = maxLast < addDays(today, 120) ? maxLast : addDays(today, 120);
  const nDays = diffDays(today, end) + 1;
  const months = [];
  for (let d = today.slice(0, 6) + '01'; d <= end; d = addDays(d.slice(0, 6) + '28', 7).slice(0, 6) + '01') months.push(d.slice(0, 6));

  // 작업 단위: (휴양림, 시설유형, 월, 객실 5개 묶음)
  const jobs = [];
  for (const f of forests) {
    if (!f.lastDay || f.lastDay < today) continue;
    const last = f.lastDay;
    for (const [type, ids] of Object.entries(f.types || {})) {
      for (const m of months) {
        if (m + '01' > last) continue;
        for (let i = 0; i < ids.length; i += BATCH) jobs.push({ f, type, m, ids: ids.slice(i, i + BATCH), last });
      }
    }
  }
  console.log(`휴양림 ${forests.length}곳 · 월 ${months.join(',')} · 요청 ${jobs.length}건 · 범위 ${today}~${end}`);

  const goods = new Map(); // goodsId -> {meta, s: char[]}
  let ok = 0, fail = 0;
  const failures = [];
  await pool(jobs, CONCURRENCY, async (j, k) => {
    try {
      const rows = await s.post('/rep/or/selectRsrvtAvailInfoListForMonthRsrvt.do', {
        insttId: j.f.insttId, upperGoodsClsscCd: j.type, goodsIdList: j.ids,
        srchDate: j.m, lastDay: j.last, inqurSctin: '01',
      });
      if (!Array.isArray(rows)) throw new Error('응답 형식 오류');
      for (const r of rows) {
        let g = goods.get(r.goodsId);
        if (!g) {
          g = {
            id: r.goodsId, forest: j.f.insttId, kind: r.upperGoodsClsscCd || j.type,
            cls: r.goodsClsscNm || '', name: r.goodsNm || '', cap: Number(r.mxmmAccptCnt) || 0,
            area: r.insttArea || '', flags: flagsOf(r), maxNights: r.mxmmStngDayCnt || null,
            s: Array(nDays).fill('.'),
          };
          goods.set(r.goodsId, g);
        }
        const idx = diffDays(today, r.useDt);
        if (idx >= 0 && idx < nDays && r.useDt <= j.last) g.s[idx] = encode(r);
      }
      ok++;
    } catch (e) {
      fail++;
      failures.push({ forest: j.f.name, type: j.type, month: j.m, error: String(e.message || e) });
    }
    if ((k + 1) % 100 === 0) console.log(`  ${k + 1}/${jobs.length} (실패 ${fail})`);
    await sleep(jitter());
  });

  // ---- 출력 구성 ----
  const byForest = new Map();
  for (const g of goods.values()) {
    if (!byForest.has(g.forest)) byForest.set(g.forest, []);
    byForest.get(g.forest).push(g);
  }
  const mask = weekendMask(today, nDays);
  const outForests = forests.map((f) => ({
    id: f.insttId, name: f.shortName, type: f.type, sido: f.sido, sidoName: f.sidoName,
    sigungu: f.sigungu, lat: f.lat, lng: f.lng, addr: f.addr, tel: f.tel, url: f.url, checkin: f.checkin, checkout: f.checkout,
    policy: f.policy || null,
    naver: naver[f.insttId] ? { id: naver[f.insttId].id, v: naver[f.insttId].v, b: naver[f.insttId].b, s: naver[f.insttId].s } : null,
    booking: bookingStats((byForest.get(f.insttId) || []).map((g) => ({ kind: g.kind, s: g.s })), mask),
    goods: (byForest.get(f.insttId) || [])
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.cls.localeCompare(b.cls, 'ko') || a.name.localeCompare(b.name, 'ko', { numeric: true }))
      .map(({ forest, s, ...g }) => ({ ...g, ...(prices[g.id] ? { pr: prices[g.id] } : {}), s: s.join('') })),
  }));
  const generatedAt = new Date().toISOString();
  const status = { generatedAt, start: today, days: nDays, forests: outForests };

  // ---- 변화 감지 (새로 열린 자리) ----
  await fs.mkdir(OUT_DIR, { recursive: true });
  let prev = null, prevChanges = [];
  try { prev = JSON.parse(await fs.readFile(path.join(OUT_DIR, 'status.json'), 'utf8')); } catch {}
  try { prevChanges = JSON.parse(await fs.readFile(path.join(OUT_DIR, 'changes.json'), 'utf8')).items || []; } catch {}
  const newItems = [];
  if (prev) {
    const prevMap = new Map();
    for (const f of prev.forests) for (const g of f.goods) prevMap.set(g.id, g.s);
    for (const f of outForests) for (const g of f.goods) {
      const ps = prevMap.get(g.id);
      if (!ps) continue;
      const shift = diffDays(prev.start, today);
      for (let i = 0; i < g.s.length; i++) {
        const before = ps[i + shift];
        if (g.s[i] === 'A' && before && before !== 'A' && before !== '.') {
          newItems.push({ at: generatedAt, forest: f.id, goods: g.id, date: addDays(today, i), from: before });
        }
      }
    }
  }
  const cutoff = Date.now() - CHANGE_KEEP_HOURS * 3600e3;
  const items = [...newItems, ...prevChanges]
    .filter((c) => Date.parse(c.at) >= cutoff && c.date >= today)
    .slice(0, 2000);

  const totals = { forests: outForests.length, goods: goods.size, available: 0 };
  for (const g of goods.values()) for (const c of g.s) if (c === 'A') totals.available++;
  const meta = {
    generatedAt, start: today, end, durationSec: Math.round((Date.now() - t0) / 1000),
    requests: jobs.length, ok, fail, totals, newlyOpened: newItems.length,
    unknownCodes: Object.fromEntries(unknownCodes), failures: failures.slice(0, 50),
  };

  // 실패율이 너무 높으면 기존 데이터를 덮어쓰지 않는다
  if (jobs.length && fail / jobs.length > 0.3) {
    await fs.writeFile(path.join(OUT_DIR, 'meta.failed.json'), JSON.stringify(meta, null, 1));
    console.error(`실패율 ${(100 * fail / jobs.length).toFixed(0)}% — 데이터 갱신 중단`);
    process.exit(1);
  }
  await fs.writeFile(path.join(OUT_DIR, 'status.json'), JSON.stringify(status));
  await fs.writeFile(path.join(OUT_DIR, 'changes.json'), JSON.stringify({ generatedAt, items }));
  await fs.writeFile(path.join(OUT_DIR, 'meta.json'), JSON.stringify(meta, null, 1));
  console.log(`완료 ${meta.durationSec}s · 성공 ${ok} 실패 ${fail} · 객실 ${goods.size} · 예약가능 ${totals.available}칸 · 새로 열림 ${newItems.length}`);
  if (unknownCodes.size) console.log('미확인 상태코드', meta.unknownCodes);
}

main().catch((e) => { console.error(e); process.exit(1); });
