// 이미 받은 status.json에 예약률 집계와 객실 요금을 다시 넣는다 (집계 방식이나 요금을 바꿨을 때 1회용)
import fs from 'node:fs';
import { bookingStats, weekendMask } from './stats.mjs';

const p = new URL('../web/public/data/status.json', import.meta.url);
const st = JSON.parse(fs.readFileSync(p, 'utf8'));
let prices = {};
try { prices = JSON.parse(fs.readFileSync(new URL('../data/prices.json', import.meta.url), 'utf8')); } catch {}
const mask = weekendMask(st.start, st.days);
st.forests = st.forests.map(({ goods, booking, ...f }) => ({
  ...f,
  booking: bookingStats(goods, mask),
  goods: goods.map(({ pr, s, ...g }) => ({ ...g, ...(prices[g.id] ? { pr: prices[g.id] } : {}), s })),
}));
fs.writeFileSync(p, JSON.stringify(st));
console.log(`${st.forests.length}곳 집계 완료`);
