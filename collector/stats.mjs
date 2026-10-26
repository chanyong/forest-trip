// 휴양림별 주말·평일 예약률 집계.
// 예약을 받는 날(A 가능, 1~9 대기, F 완료) 중 이미 예약된 날(대기·완료)의 비율이다.
// 휴무·공사·추첨·기간 밖(C R P .)은 분모에서 뺀다. 주말 = 체크인 다음 날이 토·일·공휴일인 숙박.
import fs from 'node:fs';

const HOLIDAYS = JSON.parse(fs.readFileSync(new URL('../web/src/lib/holidays.json', import.meta.url), 'utf8'));
const toUTC = (ymd) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8));

export function weekendMask(startYmd, days) {
  const t0 = toUTC(startYmd);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(t0 + (i + 1) * 864e5);
    return d.getUTCDay() === 0 || d.getUTCDay() === 6 || !!HOLIDAYS[d.toISOString().slice(0, 10)];
  });
}

// goods: [{kind, s}] → { '01': {we:[예약, 전체], wd:[예약, 전체]}, '02': ... }
export function bookingStats(goods, mask) {
  const out = {};
  for (const g of goods) {
    const r = (out[g.kind] ||= { we: [0, 0], wd: [0, 0] });
    for (let i = 0; i < g.s.length; i++) {
      const c = g.s[i];
      if (c !== 'A' && c !== 'F' && !(c >= '1' && c <= '9')) continue;
      const k = mask[i] ? r.we : r.wd;
      k[1]++;
      if (c !== 'A') k[0]++;
    }
  }
  return out;
}
