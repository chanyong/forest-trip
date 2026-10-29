// 예약 오픈 안내. 수집기가 숲나들e 예약정책(selectSthngListForMonthRsrvt.do 의 rsrvtPolcy)에서 받은 값으로
// "다음에 언제 어디까지 열리는지"를 계산한다. 규칙으로 계산한 마지막 날이 숲나들e 가 알려 준
// 현재 예약 가능 마지막 날과 맞을 때만 규칙을 보여 주고, 안 맞으면(추가 개방·예외 정책) 마지막 날만 보여 준다.
// 웹(TS)과 정적 페이지 생성(scripts/build-static.mjs)이 같이 쓴다.
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const toUTC = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const addDays = (iso, n) => new Date(toUTC(iso) + n * 864e5).toISOString().slice(0, 10);
const dow = (iso) => new Date(toUTC(iso)).getUTCDay();
const mdw = (iso) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}(${DOW[dow(iso)]})`;
const ymdToIso = (s) => (s && /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null);
const monthEnd = (y, m) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); // m: 1~12
const hm = (t) => `${t.slice(0, 2)}:${t.slice(2, 4)}`;

/**
 * @param {{cycle?:string, day?:string|null, time?:string|null, weeks?:number|null, lastDay?:string|null}|null|undefined} p
 * @param {string} nowIso 기준 시각(ISO, 보통 수집 시각)
 * @returns {{lastDay:string, rule:string|null, next:string|null, text:string, html:string}|null}
 */
export function policyInfo(p, nowIso) {
  const last = ymdToIso(p?.lastDay);
  if (!last) return null;
  const k = new Date(Date.parse(nowIso) + 9 * 3600e3).toISOString();
  const today = k.slice(0, 10), nowHM = k.slice(11, 13) + k.slice(14, 16);
  const time = /^\d{4}$/.test(p.time || '') ? p.time : null;
  const passed = (iso) => iso < today || (iso === today && time != null && nowHM >= time);
  let rule = null, next = null;
  const d = Number(p.day);
  if (p.cycle === 'WEEK' && d >= 1 && d <= 7 && p.weeks > 0 && time) {
    const wd = d - 1;
    let prev = addDays(today, -((dow(today) - wd + 7) % 7));
    if (!passed(prev)) prev = addDays(prev, -7);
    if (addDays(prev, p.weeks * 7 - 1) === last) {
      rule = `매주 ${DOW[wd]}요일 ${hm(time)}에 1주일치가 새로 열려 약 ${p.weeks}주 앞까지 예약할 수 있습니다.`;
      next = `다음 오픈 ${mdw(addDays(prev, 7))} ${hm(time)} → ${mdw(addDays(last, 7))} 체크인까지`;
    }
  } else if (p.cycle === 'MON' && d >= 1 && d <= 28 && time) {
    let y = +today.slice(0, 4), m = +today.slice(5, 7);
    let prev = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (!passed(prev)) { m -= 1; if (!m) { m = 12; y -= 1; } prev = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
    const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1; // 지난 오픈 때 열린 달
    if (monthEnd(ny, nm) === last) {
      const ny2 = nm === 12 ? ny + 1 : ny, nm2 = nm === 12 ? 1 : nm + 1;
      rule = `매월 ${d}일 ${hm(time)}에 다음 달 예약이 열립니다.`;
      next = `다음 오픈 ${mdw(`${ny}-${String(nm).padStart(2, '0')}-${String(d).padStart(2, '0')}`)} ${hm(time)} → ${nm2}월 ${+monthEnd(ny2, nm2).slice(8)}일 체크인까지`;
    }
  }
  const head = `지금은 ${mdw(last)} 체크인까지 예약을 받고 있습니다.`;
  const tail = '숲나들e 예약정책 기준이며, 주말 추첨·우선예약 기간이나 휴양림 사정에 따라 달라질 수 있으니 숲나들e 공지를 확인하세요.';
  const text = [head, rule, next ? next + '.' : null, tail].filter(Boolean).join(' ');
  const html = `<b>${head}</b>${rule ? `<br>${rule}` : ''}${next ? `<br><b>${next}</b>` : ''}<br><span style="font-size:.85em;opacity:.8">${tail}</span>`;
  return { lastDay: last, rule, next, text, html };
}
