// 네이버 플레이스의 휴양림별 방문자 리뷰·블로그 리뷰 수를 data/naver.json에 모은다.
// 네이버 모바일 통합검색 결과 HTML 안의 __APOLLO_STATE__를 읽는다(로그인 불필요).
// 사용: node collector/naver-reviews.mjs [--force]   (월 1회 정도, 로컬에서 실행)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MASTER = path.join(ROOT, 'data/master.json');
const OUT = path.join(ROOT, 'data/naver.json');
const FORCE = process.argv.includes('--force');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => (s || '').replace(/국립|공립|사립|\s|\(.*?\)|·/g, '');
const num = (v) => (v == null || v === '' ? null : +String(v).replace(/,/g, ''));

function apollo(html) {
  const i = html.indexOf('__APOLLO_STATE__ = ');
  if (i < 0) return null;
  const s = html.indexOf('{', i);
  // JSON 객체 끝을 괄호 짝으로 찾는다(문자열 안의 괄호는 건너뜀)
  let depth = 0, inStr = false, esc = false;
  for (let k = s; k < html.length; k++) {
    const c = html[k];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return JSON.parse(html.slice(s, k + 1));
  }
  return null;
}

const strip = (s) => (s || '').replace(/<[^>]+>/g, '');

function candidates(state) {
  const out = [];
  for (const v of Object.values(state)) {
    if (v?.__typename === 'PlaceDetailBase') {
      out.push({ id: v.id, name: strip(v.name), addr: `${v.roadAddress || ''} ${v.address || ''}`, v: num(v.visitorReviewsTotal), b: num(v.cafeBlogReviewsTotal), s: num(v.visitorReviewsScore) });
    } else if (v?.__typename === 'PlaceListBusinessesItem' || v?.__typename === 'PlaceSummary') {
      out.push({ id: v.id, name: strip(v.name), addr: `${v.commonAddress || ''} ${v.roadAddress || ''} ${v.address || ''}`, v: num(v.visitorReviewCount), b: num(v.blogCafeReviewCount), s: num(v.visitorReviewScore) });
    }
  }
  return out;
}

function pick(cands, f) {
  const want = norm(f.shortName);
  const sigungu = (f.sigungu || '').replace(/[시군구]$/, '');
  const score = (c) => {
    const n = norm(c.name);
    let sc = 0;
    if (n === want) sc += 10;
    // '광치자연휴양림캠핑장'처럼 이름 뒤에 시설명이 더 붙은 곳은 휴양림 본체가 아니다
    else if (n.includes(want) && !n.endsWith(want)) return -1;
    else if (n.includes(want) || want.includes(n)) sc += 6;
    else if (n.includes(want.replace(/자연휴양림|휴양림/, ''))) sc += 3;
    else return -1;
    if (sigungu && c.addr.includes(sigungu)) sc += 4;
    if (/무장애|나눔길|숲길|등산로|주차장|매표소|카페|식당|매점|펜션|캠핑장$/.test(c.name) && !/캠핑|야영/.test(want)) sc -= 5;
    sc += Math.min(3, Math.log10((c.v || 0) + (c.b || 0) + 1));
    return sc;
  };
  return cands.map((c) => ({ c, sc: score(c) })).filter((x) => x.sc >= 8).sort((a, b) => b.sc - a.sc)[0]?.c;
}

async function search(q) {
  const res = await fetch(`https://m.search.naver.com/search.naver?query=${encodeURIComponent(q)}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const st = apollo(await res.text());
  return st ? candidates(st) : [];
}

const master = JSON.parse(await fs.readFile(MASTER, 'utf8'));
let db = {};
try { db = JSON.parse(await fs.readFile(OUT, 'utf8')); } catch {}

let ok = 0, miss = 0;
for (const f of master.forests) {
  if (!FORCE && db[f.insttId]?.id) { ok++; continue; }
  let hit = null;
  for (const q of [f.shortName, `${f.sigungu} ${f.shortName}`]) {
    try { hit = pick(await search(q), f); } catch (e) { console.error(f.shortName, e.message); }
    await sleep(1200 + Math.random() * 1200);
    if (hit) break;
  }
  if (hit) {
    db[f.insttId] = { id: hit.id, name: hit.name, v: hit.v ?? 0, b: hit.b ?? 0, s: hit.s, at: new Date().toISOString().slice(0, 10) };
    ok++;
    console.log(`✓ ${f.shortName} → ${hit.name} 방문자 ${hit.v} 블로그 ${hit.b}`);
  } else {
    miss++;
    console.log(`✗ ${f.shortName} (${f.sigungu}) 일치하는 장소 없음`);
  }
  await fs.writeFile(OUT, JSON.stringify(db, null, 1));
}
console.log(`완료: ${ok}곳 매칭, ${miss}곳 실패`);
