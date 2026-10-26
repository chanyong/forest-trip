// 이미 받은 status.json에 예약률 집계를 다시 계산해 넣는다 (집계 방식을 바꿨을 때 1회용)
import fs from 'node:fs';
import { bookingStats, weekendMask } from './stats.mjs';

const p = new URL('../web/public/data/status.json', import.meta.url);
const st = JSON.parse(fs.readFileSync(p, 'utf8'));
const mask = weekendMask(st.start, st.days);
st.forests = st.forests.map(({ goods, booking, ...f }) => ({ ...f, booking: bookingStats(goods, mask), goods }));
fs.writeFileSync(p, JSON.stringify(st));
console.log(`${st.forests.length}곳 집계 완료`);
