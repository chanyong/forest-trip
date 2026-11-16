// 예약 오픈·추첨 일정 허브(/reservation/)와 성수기 추첨 경쟁률 기록 (이슈 #38)
// 원칙(이슈 #38 관제 창 11-16 검수 결정):
//  - 숲나들e 안내·공지와 산림청 보도자료 원문으로 확인한 값만 단정한다. 확인 못 한 것은 '확인 필요'로 적는다.
//  - 숲나들e 원문을 옮겨 적지 않고, 규칙으로 날짜를 계산하거나 연도별 경쟁률을 직접 비교·계산해서 보여 준다.
//  - 연도 비교는 경쟁률만 한다(신청 수는 보도마다 '명'·'건' 단위가 달라 싣지 않는다).
//  - 공립·사립 오픈 규칙은 수집한 예약정책 값을 policy.mjs 로 계산한다(손으로 옮기지 않는다).
//  - '공식' 표현, 광고·제휴·예약 대행 표현, 미결제분 선착순 풀림 알림 안내는 넣지 않는다.
import { policyInfo } from '../src/lib/policy.mjs';

/** 사람이 숲나들e 안내·산림청 자료를 읽고 확인한 날 */
export const CHECKED = '2026-11-16';

export const SRC = {
  lottery: { name: '숲나들e 추첨제 이용안내', url: 'https://www.foresttrip.go.kr/rep/drlts/drltsUseGdnc.do?hmpgId=FRIP&menuId=001003004' },
  policy: { name: '숲나들e 휴양림별 예약정책 안내', url: 'https://www.foresttrip.go.kr/pot/cc/bb/selectFripRsrvtPolcyView.do?hmpgId=FRIP&menuId=002001' },
  notice12: { name: "숲나들e 공지 '26년 12월 주말추첨제 당첨발표 알림(수정일 2026-11-10)", url: 'https://www.foresttrip.go.kr/pot/cc/nm/selectNticBbrssDtlView.do?twbbsId=279448&bbrssMsterId=BBRSSMSTER_00000001&hmpgId=FRIP&menuId=004001' },
};

/**
 * 국립 주말추첨제 규칙(숲나들e 추첨제 이용안내, 확인일 CHECKED):
 * 다음 달 금·토·법정공휴일 전일 이용분. 신청 매월 4일 09:00~9일 18:00, 당첨 발표 10일 16:00, 미당첨·미결제분 선착순은 15일 09:00부터.
 */
export const WEEKEND_LOTTERY = [
  { day: 4, time: '09:00', text: '신청 시작' },
  { day: 9, time: '18:00', text: '신청 마감' },
  { day: 10, time: '16:00', text: '당첨 발표' },
  { day: 15, time: '09:00', text: '미당첨·미결제분 선착순 시작(6주 예약정책 기준으로 이용일 구간별로 열림)' },
];

/**
 * 12월 이용분 공지 사례(숲나들e 공지 수정일 2026-11-10). 이 달 일정이 지나면(validThrough 다음 날부터) 페이지에서 뺀다.
 * 구간별 시작 일정은 공지의 표를 날짜·기간만 옮겼다.
 */
export const DEC_CASE = {
  month: '12월', validThrough: '2026-11-25', pay: '11/10(화) 16:00 ~ 11/14(토) 18:00(기한 안에 결제하지 않으면 당첨 자동 취소)',
  steps: [
    { date: '2026-11-15', time: '09:00', range: '12/1~12/22' },
    { date: '2026-11-18', time: '09:00', range: '12/23~12/29' },
    { date: '2026-11-25', time: '09:00', range: '12/30~12/31' },
  ],
};

/**
 * 성수기 추첨 경쟁률 기록. 숫자는 모두 '평균 경쟁률(대 1)'이다. 신청 수는 싣지 않는다.
 * 2024: 산림청 보도자료 2024-06-20 (korea.kr newsId=156636770)을 직접 읽음. 성수기는 원문에 7.25~8.24로 표기됨.
 * 2025: 산림청 보도자료 '이번 여름, 최고 인기 국립자연휴양림은 어디?'(산림청 누리집 게시글 nttId=3208681, 관제 창이 원문 대조, 2025-06-19 보도).
 * 2026: 산림청 보도자료 본문 확인 못 함 → 언론 보도 기준(이투데이 2026-06-20·머니투데이 2026-06-18 본문을 직접 읽어 대조).
 */
export const PEAK = [
  { year: 2024, basis: 'press', period: '7.25~8.24(보도자료 표기)', apply: '6/10~6/17', overall: 5.15, room: 6.60, camp: 1.69,
    topRoom: { name: '대야산 숲속의집 601호', rate: 77 }, topCamp: { name: '가리왕산 201번 야영데크', rate: 10 },
    forests: [['무의도', 22], ['대야산', 14], ['변산', 11], ['신시도', 10]],
    src: [{ name: '산림청 보도자료 "77:1의 평균경쟁률을 기록한 휴양림 최고의 명소는?"(2024-06-20)', url: 'https://www.korea.kr/briefing/pressReleaseView.do?newsId=156636770' }] },
  { year: 2025, basis: 'press', period: '7/15~8/24', apply: '6/9~6/16', overall: 6.28, room: 7.74, camp: 1.83,
    topRoom: { name: '대야산 숲속의집 601호', rate: 91.46 }, topCamp: { name: '대야산 10번 캐빈', rate: 8.33 },
    forests: [['무의도', 26.63], ['변산', 13.82], ['대야산', 13.64], ['용지봉', 11.31]],
    src: [{ name: '산림청 보도자료 "이번 여름, 최고 인기 국립자연휴양림은 어디?"(2025-06-19, 산림청 누리집 게시글 번호 3208681)', url: 'https://www.forest.go.kr' }] },
  { year: 2026, basis: 'news', period: '7/15~8/24', apply: null, overall: 5.91, room: 6.88, camp: 2.22,
    topRoom: { name: '대야산 숲속의집 601호', rate: 92.96 }, topCamp: { name: '방태산 캐빈 국산낙엽송3', rate: 11.7 },
    forests: [['진부령', 24.81], ['무의도', 13.57]],
    src: [{ name: '이투데이 "국립휴양림 여름 예약 전쟁…인기 숲속 집은 90대1 경쟁"(2026-06-20)', url: 'https://www.etoday.co.kr/news/view/2595286' },
      { name: '머니투데이 "올 여름 가장 핫한 \'숲속의 집\'은?"(2026-06-18)', url: 'https://www.mt.co.kr/policy/2026/06/18/2026061811071722166' }] },
];
const BASIS = { press: '산림청 보도자료 기준', news: '언론 보도 기준(산림청 보도자료 본문 확인 못 함)' };

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const toUTC = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const dowOf = (iso) => new Date(toUTC(iso)).getUTCDay();
const pad = (n) => String(n).padStart(2, '0');
const mdw = (iso) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}(${DOW[dowOf(iso)]})`;
const fmt = (n) => String(n);
const r2 = (n) => Math.round(n * 100) / 100;

/** 오늘이 속한 달과 다음 달의 [연, 월] */
export function monthsFrom(todayISO) {
  const y = +todayISO.slice(0, 4), m = +todayISO.slice(5, 7);
  return [[y, m], m === 12 ? [y + 1, 1] : [y, m + 1]];
}

/**
 * 공립·사립(국립 제외) 휴양림을 예약정책 값으로 계산한 규칙별로 묶는다.
 * 규칙으로 설명되지 않는 곳(마지막 예약일이 맞지 않음, 정책 없음)은 rule=null 묶음으로 둔다.
 */
export function groupByRule(forests, nowIso) {
  const map = new Map();
  for (const f of forests) {
    if (f.type === '국립') continue;
    const p = policyInfo(f.policy, nowIso);
    const key = p?.rule || null;
    if (!map.has(key)) map.set(key, { rule: key, cycle: key ? f.policy.cycle : null, day: key ? Number(f.policy.day) : null, time: key ? f.policy.time : null, forests: [] });
    map.get(key).forests.push(f);
  }
  return [...map.values()].sort((a, b) => (a.rule === null) - (b.rule === null) || b.forests.length - a.forests.length || String(a.rule).localeCompare(String(b.rule), 'ko'));
}

/**
 * 국립 휴양림 평일 선착순 오픈 규칙(대표 결정 11-16: 수집 데이터 기준으로 단정). 문구는 수집한 예약정책 값을
 * policy.mjs 로 계산한 결과에서 만든다(요일·시각·주 수·곳 수·확인일을 손으로 고정하지 않는다).
 * 모두 같은 규칙이면 단정하고, 갈리면 가장 많은 규칙과 예외 수를 적고, 규칙을 계산한 곳이 없으면 확인 필요로 둔다.
 */
export function weekdayRule(forests, nowIso) {
  const nat = forests.filter((f) => f.type === '국립');
  const date = new Date(Date.parse(nowIso) + 9 * 3600e3).toISOString().slice(0, 10);
  const tally = new Map();
  for (const f of nat) { const r = policyInfo(f.policy, nowIso)?.rule; if (r) tally.set(r, (tally.get(r) || 0) + 1); }
  const [rule, count] = [...tally].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))[0] || [null, 0];
  const total = nat.length, exceptions = total - count, unanimous = !!rule && exceptions === 0;
  const base = `숲가자 수집 데이터 기준(${total}개 국립 휴양림, 확인일 ${date})`;
  const text = !rule ? `${base}으로는 평일 선착순 오픈 규칙을 계산하지 못해 확인 필요입니다.`
    : unanimous ? `${base}: ${total}곳 모두 ${rule}`
    : `${base}: ${total}곳 중 ${count}곳이 ${rule} 나머지 ${exceptions}곳은 이 규칙으로 설명되지 않아 확인 필요입니다.`;
  return { total, rule, count, exceptions, unanimous, date, text };
}

/** 오늘 이후 이번 달·다음 달 달력 행: [{date, cells:[html...]}] */
export function calendarRows(c, groups) {
  const { todayISO, esc, forestUrl } = c;
  const rows = new Map();
  const add = (date, html) => { if (date < todayISO) return; if (!rows.has(date)) rows.set(date, []); rows.get(date).push(html); };
  const hm = (t) => `${t.slice(0, 2)}:${t.slice(2, 4)}`;
  for (const [y, m] of monthsFrom(todayISO)) {
    const next = m === 12 ? 1 : m + 1;
    for (const e of WEEKEND_LOTTERY) {
      const date = `${y}-${pad(m)}-${pad(e.day)}`;
      add(date, `<b>국립 주말추첨</b>(${next}월 이용분) ${esc(e.text)} <span class="fsub">${e.time}</span>`);
    }
    for (const g of groups) {
      if (g.cycle !== 'MON') continue;
      const date = `${y}-${pad(m)}-${pad(g.day)}`;
      const names = g.forests.slice(0, 4).map((f) => `<a href="${forestUrl(f)}">${esc(f.name)}</a>`).join(' · ');
      add(date, `<b>${g.forests.length}곳</b> ${next}월 예약 오픈 <span class="fsub">${esc(hm(g.time))}</span><div class="fsub">${names}${g.forests.length > 4 ? ` 외 ${g.forests.length - 4}곳` : ''}</div>`);
    }
  }
  if (todayISO <= DEC_CASE.validThrough) {
    for (const s of DEC_CASE.steps) add(s.date, `<b>${DEC_CASE.month} 이용분</b> 미당첨·미결제분 선착순 시작 <span class="fsub">${s.time}</span><div class="fsub">${s.range} 체크인 구간(공지 기준)</div>`);
  }
  return [...rows].sort((a, b) => a[0].localeCompare(b[0])).map(([date, cells]) => ({ date, cells }));
}

/** 연도별 경쟁률에서 직접 계산한 값(경쟁률만 사용) */
export function peakStats() {
  const avg = (k) => r2(PEAK.reduce((s, y) => s + y[k], 0) / PEAK.length);
  return {
    overallAvg: avg('overall'), roomAvg: avg('room'),
    ratioRoomCamp: PEAK.map((y) => ({ year: y.year, x: Math.round((y.room / y.camp) * 10) / 10 })),
    topRoomSame: PEAK.every((y) => y.topRoom.name === PEAK[0].topRoom.name),
    topRoomName: PEAK[0].topRoom.name,
    topRoomPath: PEAK.map((y) => y.topRoom.rate),
    topForestPath: PEAK.map((y) => ({ year: y.year, name: y.forests[0][0], rate: y.forests[0][1] })),
  };
}

export function buildReservationGuide(c) {
  const { status, esc, SITE } = c;
  const nowIso = c.generatedAt;
  const groups = groupByRule(status.forests, nowIso);
  const cal = calendarRows(c, groups);
  const nat = status.forests.filter((f) => f.type === '국립').length;
  const pub = status.forests.filter((f) => f.type === '공립').length;
  const pri = status.forests.filter((f) => f.type === '사립').length;
  const st = peakStats();
  const wk = weekdayRule(status.forests, nowIso);
  const urlPath = '/reservation/';
  const link = (s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>`;
  const [[y1, m1], [y2, m2]] = monthsFrom(c.todayISO);

  const calHtml = cal.length ? `<div style="overflow-x:auto"><table><thead><tr><th>날짜</th><th>내용</th></tr></thead><tbody>
${cal.map((r) => `<tr><td style="white-space:nowrap"><b>${esc(mdw(r.date))}</b></td><td>${r.cells.join('<hr style="border:0;border-top:1px solid var(--line);margin:6px 0">')}</td></tr>`).join('\n')}
</tbody></table></div>` : '<p>오늘 이후 이번 달·다음 달에 계산된 일정이 없습니다.</p>';

  const groupHtml = groups.map((g) => `<tr><td>${g.rule ? esc(g.rule) : '<b>확인 필요</b><div class="fsub">수집한 예약정책 값으로 규칙을 설명하지 못했습니다. 현재 예약 가능한 마지막 날만 휴양림 페이지에 표시합니다.</div>'}</td><td><span class="num">${g.forests.length}</span>곳<details><summary class="fsub">휴양림 보기</summary><p class="fsub" style="line-height:1.9">${g.forests.map((f) => `<a href="${c.forestUrl(f)}">${esc(f.name)}</a>`).join(' · ')}</p></details></td></tr>`).join('\n');

  const peakRows = PEAK.map((y) => `<tr><td><b>${y.year}</b><div class="fsub">${esc(BASIS[y.basis])}</div></td><td><span class="num">${fmt(y.overall)}</span></td><td>${fmt(y.room)}</td><td>${fmt(y.camp)}</td><td>${esc(y.topRoom.name)}<div class="fsub">${fmt(y.topRoom.rate)}대 1</div></td><td>${y.forests.map(([n, r]) => `${esc(n)} ${fmt(r)}`).join('<br>')}</td></tr>`).join('\n');
  const periodRows = PEAK.map((y) => `<li><b>${y.year}</b>: 성수기 ${esc(y.period)}${y.apply ? `, 추첨 신청 ${esc(y.apply)}` : ', 추첨 신청 기간은 확인 못 함'}</li>`).join('');
  const srcRows = PEAK.map((y) => `<li><b>${y.year}</b> ${y.src.map(link).join(' · ')}</li>`).join('');

  const compare = [
    `전체 평균 경쟁률은 ${PEAK.map((y) => `${y.year}년 ${fmt(y.overall)}대 1`).join(', ')}이고, 세 해를 단순 평균하면 ${fmt(st.overallAvg)}대 1입니다.`,
    `객실 평균은 ${PEAK.map((y) => fmt(y.room)).join(' → ')}대 1로 움직였고(세 해 단순 평균 ${fmt(st.roomAvg)}대 1), 야영시설보다 ${st.ratioRoomCamp.map((r) => `${r.year}년 ${r.x}배`).join(', ')} 높았습니다.`,
    st.topRoomSame ? `객실 최고 경쟁률은 세 해 모두 ${st.topRoomName}이고 ${st.topRoomPath.map(fmt).join(' → ')}대 1입니다.` : '',
    `휴양림별 1위는 ${st.topForestPath.map((t) => `${t.year}년 ${t.name} ${fmt(t.rate)}`).join(', ')}대 1입니다.`,
  ].filter(Boolean).join(' ');

  const caseBlock = c.todayISO <= DEC_CASE.validThrough ? `
<h3>지금 진행 중인 ${DEC_CASE.month} 이용분 사례</h3>
<p>당첨자 결제 기간은 ${esc(DEC_CASE.pay)}입니다. 미당첨·미결제분 선착순은 이용일 구간별로 나뉘어 열립니다: ${DEC_CASE.steps.map((s) => `${esc(mdw(s.date))} ${s.time}(${s.range} 체크인)`).join(', ')}. 출처: ${link(SRC.notice12)}, 확인일 ${CHECKED}.</p>` : '';

  const body = `
<p class="crumb"><a href="/">홈</a> › 예약 오픈·추첨 일정</p>
<h1>자연휴양림 예약 오픈·추첨 일정</h1>
<p class="lead">예약이 언제 열리는지, 추첨은 언제인지 숲나들e 안내를 기준으로 날짜를 계산해 정리했습니다. 이번 달·다음 달 달력, 국립·공립·사립 구분, 성수기 추첨 경쟁률 기록을 한곳에 모았습니다.</p>
<p class="stamp">안내 확인일 ${CHECKED} · 휴양림별 규칙은 마지막 수집 ${esc(c.kstTime)} 기준 · 출처 숲나들e 안내·산림청 보도자료</p>
<div class="note">일정은 숲나들e 안내가 바뀌면 달라질 수 있습니다. 예약 직전에 <a href="https://www.foresttrip.go.kr" target="_blank" rel="noopener">숲나들e 공지사항</a>을 확인하세요. 확인하지 못한 규칙은 '확인 필요'로 적었습니다.</div>

<h2>${m1}월·${m2}월 달력 (오늘 이후)</h2>
<p>국립 주말추첨은 숲나들e 안내(${link(SRC.lottery)})의 날짜 규칙을 ${y1}년 ${m1}월·${m2}월에 적용했고, 공립·사립은 휴양림별 예약정책 값으로 계산했습니다. 매주 같은 요일에 열리는 곳은 아래 규칙표에 있습니다.</p>
${calHtml}
${caseBlock}

<h2>국립·공립·사립은 이렇게 다릅니다</h2>
<div style="overflow-x:auto"><table><thead><tr><th>구분</th><th>휴양림</th><th>오픈 방식</th></tr></thead><tbody>
<tr><td style="white-space:nowrap"><b>국립</b></td><td style="white-space:nowrap">${nat}곳</td><td>주말(금·토·법정공휴일 전일)은 추첨으로 먼저 받습니다. 대상은 숲나들e 안내 기준 아세안자연휴양림을 뺀 국립 47곳입니다. 성수기는 별도 추첨입니다(아래). <b>평일 선착순</b>: ${esc(wk.text)} 숲나들e 예약정책 페이지(${link(SRC.policy)})도 참고하고, 예약 직전에 숲나들e 공지에서 확인하세요.</td></tr>
<tr><td style="white-space:nowrap"><b>공립</b></td><td style="white-space:nowrap">${pub}곳</td><td>지자체가 정해 휴양림마다 다릅니다. 매월 정해진 날, 매주 정해진 요일, 주 단위 등 방식이 섞여 있습니다(아래 규칙표). 숲나들e 안내에 따르면 예약·이용·환불 책임은 지자체에 있습니다.</td></tr>
<tr><td style="white-space:nowrap"><b>사립</b></td><td style="white-space:nowrap">${pri}곳</td><td>개인이 운영하며 휴양림마다 다릅니다. 숲나들e 안내에 따르면 예약·이용·환불 책임은 운영자에게 있습니다.</td></tr>
</tbody></table></div>
<p class="fsub">출처: ${link(SRC.policy)}, 확인일 ${CHECKED}. 곳 수는 마지막 수집 기준입니다.</p>

<h2>공립·사립 오픈 규칙 (규칙별 묶음)</h2>
<p>수집한 예약정책 값으로 계산한 마지막 예약일이 숲나들e가 알려 준 현재 마지막 예약일과 맞는 곳만 규칙을 적었습니다. 맞지 않는 곳은 '확인 필요'로 둡니다. 공립·사립 ${pub + pri}곳을 규칙별로 묶었습니다.</p>
<div style="overflow-x:auto"><table><thead><tr><th>규칙</th><th>해당 휴양림</th></tr></thead><tbody>
${groupHtml}
</tbody></table></div>

<h2>성수기 추첨 경쟁률 기록</h2>
<p>국립자연휴양림 여름 성수기는 추첨으로 먼저 받습니다. 숲나들e 추첨제 안내 기준 대상 기간은 7월 15일~8월 24일, 신청은 5월 말~6월 중으로 안내돼 있습니다(확인일 ${CHECKED}). 연도별 평균 경쟁률만 비교했습니다. 신청 수는 보도마다 '명'과 '건'으로 단위가 달라 비교하지 않았습니다.</p>
<div style="overflow-x:auto"><table><thead><tr><th>연도</th><th>전체</th><th>객실</th><th>야영</th><th>객실 최고</th><th>휴양림별 상위(대 1)</th></tr></thead><tbody>
${peakRows}
</tbody></table></div>
<p class="fsub">표의 숫자는 모두 평균 경쟁률(대 1)입니다. 야영 최고는 ${PEAK.map((y) => `${y.year}년 ${esc(y.topCamp.name)} ${fmt(y.topCamp.rate)}대 1`).join(', ')}입니다.</p>
<h3>숲가자가 계산한 비교</h3>
<p>${esc(compare)}</p>
<h3>연도별 기간</h3>
<ul>${periodRows}</ul>
<h3>출처 · 확인일 ${CHECKED}</h3>
<ul>${srcRows}</ul>
<p class="note">'산림청 보도자료 기준'은 산림청 보도자료 원문에서 확인한 값이고, '언론 보도 기준'은 언론 보도 두 건을 대조한 값입니다. 2026년은 산림청 보도자료 본문을 확인하지 못해 신청 기간도 확인하지 못했습니다. 2023년 이전은 수집하지 않았습니다.</p>

<p class="fsub" style="margin-top:20px">이 페이지는 숲나들e 안내와 산림청 보도자료를 참고해 숲가자가 날짜를 계산·정리한 참고 자료이며 예약·결제 기능은 없습니다. 이 사이트는 숲나들e와 무관한 비공식 안내입니다. 예약과 결제는 <a href="https://www.foresttrip.go.kr" target="_blank" rel="noopener">숲나들e</a>에서 직접 하세요.</p>
`;
  const crumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: '숲가자', item: SITE + '/' }, { '@type': 'ListItem', position: 2, name: '예약 오픈·추첨 일정', item: SITE + urlPath }] };
  return {
    urlPath, name: '예약 오픈·추첨 일정', freq: 'daily', pri: '0.7', body, groups, cal, stats: st,
    title: '자연휴양림 예약 오픈·추첨 일정과 성수기 경쟁률 · 숲가자',
    description: '국립 주말추첨·성수기 추첨 일정, 공립·사립 휴양림별 예약 오픈 규칙, 이번 달·다음 달 달력과 2024~2026 성수기 평균 경쟁률을 출처·확인일과 함께 정리했습니다.',
    jsonld: [crumb, { '@context': 'https://schema.org', '@type': 'WebPage', name: '자연휴양림 예약 오픈·추첨 일정', url: SITE + urlPath, inLanguage: 'ko', dateModified: c.generatedAt }],
  };
}
