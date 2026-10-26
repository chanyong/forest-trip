#!/usr/bin/env node
// collector/master/*.json (Aside로 수집한 시도별 객실 ID) → data/master.json
// 휴양림 좌표·주소는 숲나들e 공개 지도정보 API로 받아 data/geo.json에 캐시한다.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'collector/master');
const OUT = path.join(ROOT, 'data/master.json');
const GEO = path.join(ROOT, 'data/geo.json');
const SIDO = { 1: '서울/인천/경기', 2: '강원', 3: '충북', 4: '대전/충남', 5: '전북', 6: '전남/광주', 7: '대구/경북', 8: '부산/경남', 9: '제주' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// "[공립](가평군)강씨봉자연휴양림" → { type, sigungu, shortName }
function parseName(n) {
  const m = n.match(/^\[(.+?)\]\s*\((.+?)\)\s*(.+)$/);
  return m ? { type: m[1], sigungu: m[2], shortName: m[3].trim() } : { type: '', sigungu: '', shortName: n };
}

// 숲나들e 공식 휴양림 정보 (좌표·주소·전화·홈페이지)
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';
let cookie = '', csrf = '';
async function initSession() {
  const res = await fetch('https://www.foresttrip.go.kr/main.do?hmpgId=FRIP', { headers: { 'User-Agent': UA } });
  cookie = (res.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
  csrf = (await res.text()).match(/_csrf=([0-9a-f-]{36})/)?.[1] || '';
}
async function mapInfo(insttId) {
  const res = await fetch(`https://www.foresttrip.go.kr/com/sub/selectMapInfo.do?_csrf=${csrf}`, {
    method: 'POST',
    headers: { 'User-Agent': UA, Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
    body: `insttId=${encodeURIComponent(insttId)}`,
  });
  await sleep(500);
  if (!res.ok) return null;
  const r = (await res.json()).result;
  if (!r) return null;
  const hm = (t) => (t && t.length >= 4 ? `${t.slice(0, 2)}:${t.slice(2, 4)}` : null);
  return {
    lat: r.insttLttd ? +(+r.insttLttd).toFixed(5) : null, lng: r.insttLngtd ? +(+r.insttLngtd).toFixed(5) : null,
    addr: [r.roadNmAddr, r.roadNmDtadd].filter(Boolean).join(' ').trim() || null,
    tel: r.insttTlno || null, url: r.url || null, checkin: hm(r.ethrmTm), checkout: hm(r.lthrmTm),
  };
}

const files = (await fs.readdir(SRC)).filter((f) => f.endsWith('.json')).sort();
let geo = {};
try { geo = JSON.parse(await fs.readFile(GEO, 'utf8')); } catch {}

const forests = [];
for (const file of files) {
  const list = JSON.parse(await fs.readFile(path.join(SRC, file), 'utf8'));
  for (const f of list) {
    const p = parseName(f.name);
    forests.push({
      insttId: f.insttId, name: f.name, ...p, sido: String(f.sido), sidoName: SIDO[f.sido],
      lastDay: f.lastDay, types: f.types, error: f.error,
    });
  }
}

await initSession();
for (const f of forests) {
  if (geo[f.insttId]?.lat) continue;
  let info = null;
  try { info = await mapInfo(f.insttId); } catch (e) { console.warn(f.name, e.message); }
  geo[f.insttId] = info;
  console.log(f.name, info?.lat ? `${info.lat},${info.lng}` : '좌표 없음');
}
await fs.mkdir(path.dirname(GEO), { recursive: true });
await fs.writeFile(GEO, JSON.stringify(geo, null, 1));

for (const f of forests) {
  const g = geo[f.insttId];
  Object.assign(f, { lat: g?.lat ?? null, lng: g?.lng ?? null, addr: g?.addr ?? null, tel: g?.tel ?? null,
    url: g?.url ?? null, checkin: g?.checkin ?? null, checkout: g?.checkout ?? null });
}
await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify({ builtAt: new Date().toISOString(), forests }, null, 1));
const goods = forests.reduce((n, f) => n + Object.values(f.types || {}).reduce((a, v) => a + v.length, 0), 0);
console.log(`master: 휴양림 ${forests.length}곳 · 객실 ${goods}개 · 좌표 ${forests.filter((f) => f.lat).length}곳`);
