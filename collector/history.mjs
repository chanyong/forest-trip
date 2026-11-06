// 빈자리 추이: 수집 회차마다 휴양림별 요약(가능 건수·예약률)을 하루 1파일로 쌓는다. (이슈 #15)
// 파일: data/history/YYYYMMDD.json (KST 날짜) = { date, at, f: { [휴양림ID]: [숙소 가능, 야영장 가능, 숙소 예약률%, 야영장 예약률%] } }
// 같은 날 여러 회차가 돌면 마지막 회차가 덮어쓴다(하루 1건). 가능 건수 = 앞으로 조회 기간(약 87일)의 예약가능('A') 객실·날짜 칸 수.
// 예약률은 주말+평일 합산 (예약됨 / 예약받는 날), 표본 10 미만이면 null.
import fs from 'node:fs/promises';
import path from 'node:path';

export const KEEP_DAYS = 90;
const KINDS = ['01', '02'];

export function summarizeForest(f) {
  const avail = KINDS.map((k) => {
    let n = 0;
    for (const g of f.goods) if (g.kind === k) for (const c of g.s) if (c === 'A') n++;
    return n;
  });
  const rate = KINDS.map((k) => {
    const b = f.booking?.[k];
    if (!b) return null;
    const done = b.we[0] + b.wd[0], all = b.we[1] + b.wd[1];
    return all >= 10 ? Math.round((done / all) * 100) : null;
  });
  return [...avail, ...rate];
}

export const kstDate = (iso) => new Date(Date.parse(iso) + 9 * 3600e3).toISOString().slice(0, 10).replaceAll('-', '');

export function buildDay(status) {
  const f = {};
  for (const x of status.forests) f[x.id] = summarizeForest(x);
  return { date: kstDate(status.generatedAt), at: status.generatedAt, f };
}

// 보관 기간(KEEP_DAYS일) 밖의 파일 이름을 골라 낸다
export function expired(names, todayYmd, keep = KEEP_DAYS) {
  const t = (s) => Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
  return names.filter((n) => /^\d{8}\.json$/.test(n) && (t(todayYmd) - t(n.slice(0, 8))) / 864e5 >= keep);
}

export async function writeHistory(dir, status) {
  const day = buildDay(status);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${day.date}.json`), JSON.stringify(day));
  for (const n of expired(await fs.readdir(dir), day.date)) await fs.rm(path.join(dir, n));
  return day;
}
