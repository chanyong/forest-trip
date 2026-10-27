// 숲나들e 객실 상세(시설물 안내)의 요금표를 data/prices.json에 모은다(로그인 불필요).
// 객실마다 [비수기 평일, 비수기 주말, 성수기 평일, 성수기 주말] 1박 요금(원). 요금표가 없으면 null.
// 사용: node collector/prices.mjs [--force]   (요금은 거의 안 바뀌므로 객실 마스터를 갱신할 때 한 번)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MASTER = path.join(ROOT, 'data/master.json');
const OUT = path.join(ROOT, 'data/prices.json');
const FORCE = process.argv.includes('--force');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const CONCURRENCY = 2;
const DELAY_MS = 350;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 표 순서: 비수기(평일, 주말) → 성수기(평일, 주말)
async function fetchPrice(insttId, goodsId, attempt = 0) {
  try {
    const res = await fetch(`https://www.foresttrip.go.kr/pot/rm/fa/selectFcltsArmpDtlView.do?insttId=${insttId}&goodsId=${goodsId}`, {
      headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const won = [...(await res.text()).matchAll(/(?:평일|주말)요금\s*([\d,]+)\s*원/g)].map((m) => +m[1].replace(/,/g, ''));
    return won.length === 4 && won.some(Boolean) ? won : null;
  } catch (e) {
    if (attempt >= 3) throw e;
    await sleep(2000 * 2 ** attempt);
    return fetchPrice(insttId, goodsId, attempt + 1);
  }
}

const master = JSON.parse(await fs.readFile(MASTER, 'utf8'));
let db = {};
try { db = JSON.parse(await fs.readFile(OUT, 'utf8')); } catch {}

const jobs = [];
for (const f of master.forests) for (const ids of Object.values(f.types || {})) for (const id of ids) {
  if (FORCE || !(id in db)) jobs.push({ insttId: f.insttId, id });
}
console.log(`객실 ${jobs.length}개 요금 조회`);

let i = 0, ok = 0, none = 0, fail = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (i < jobs.length) {
    const j = jobs[i++];
    try {
      db[j.id] = await fetchPrice(j.insttId, j.id);
      db[j.id] ? ok++ : none++;
    } catch (e) {
      fail++;
      console.error(j.id, e.message);
    }
    const n = ok + none + fail;
    if (n % 200 === 0) {
      console.log(`  ${n}/${jobs.length} (요금 없음 ${none}, 실패 ${fail})`);
      await fs.writeFile(OUT, JSON.stringify(db));
    }
    await sleep(DELAY_MS * (0.7 + Math.random() * 0.6));
  }
}));
await fs.writeFile(OUT, JSON.stringify(db));
console.log(`완료: 요금 ${ok}개, 요금표 없음 ${none}개, 실패 ${fail}개`);
