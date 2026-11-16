// 이슈 #38: 예약 오픈·추첨 일정 허브(/reservation/): 사실·출처 표기, 금지 표현, 달력 계산, 규칙 묶음, 경쟁률 기록, 사이트 연결
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildReservationGuide, groupByRule, calendarRows, monthsFrom, peakStats, PEAK, WEEKEND_LOTTERY, DEC_CASE, CHECKED } from './reservation.mjs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const status = JSON.parse(read('public/data/status.json'));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ctx = (todayISO) => ({ status, esc, SITE: 'https://supgaja.com', kstTime: '11/16 09:00', forestUrl: (f) => `/forest/${encodeURIComponent(f.id)}`, todayISO, generatedAt: status.generatedAt });
const page = buildReservationGuide(ctx('2026-11-16'));
const text = page.body.replace(/<[^>]+>/g, ' ') + page.title + page.description;

test('monthsFrom: 오늘이 속한 달과 다음 달(연말 넘김 포함)', () => {
  assert.deepEqual(monthsFrom('2026-11-16'), [[2026, 11], [2026, 12]]);
  assert.deepEqual(monthsFrom('2026-12-31'), [[2026, 12], [2027, 1]]);
});

// Value: protects=숲나들e 안내 날짜 규칙을 달력에 옮기는 계산; fails_when=신청·발표·선착순 날짜나 이용월이 틀림; why_new=신규; seam=none; no_claim=숲나들e 안내가 바뀐 뒤의 일정
test('국립 주말추첨: 12월 4·9·10·15일에 신청 시작·마감·발표·선착순이 나오고 지난 11월 날짜는 빠진다', () => {
  const rows = calendarRows(ctx('2026-11-16'), groupByRule(status.forests, status.generatedAt));
  const get = (d) => rows.find((r) => r.date === d)?.cells.join(' ') || '';
  assert.match(get('2026-12-04'), /국립 주말추첨.*1월 이용분.*신청 시작.*09:00/s);
  assert.match(get('2026-12-09'), /신청 마감.*18:00/s);
  assert.match(get('2026-12-10'), /당첨 발표.*16:00/s);
  assert.match(get('2026-12-15'), /미당첨·미결제분 선착순 시작.*09:00/s);
  assert.ok(!rows.some((r) => r.date < '2026-11-16'), '지난 날짜 없음');
  assert.deepEqual(WEEKEND_LOTTERY.map((e) => e.day), [4, 9, 10, 15]);
});

test('12월분 공지 사례: 11/18·11/25 선착순 구간이 나오고, 유효 기간이 지나면 빠진다', () => {
  const g = groupByRule(status.forests, status.generatedAt);
  const rows = calendarRows(ctx('2026-11-16'), g);
  assert.match(rows.find((r) => r.date === '2026-11-18').cells.join(' '), /12\/23~12\/29/);
  assert.match(rows.find((r) => r.date === '2026-11-25').cells.join(' '), /12\/30~12\/31/);
  assert.match(page.body, /11\/10\(화\) 16:00 ~ 11\/14\(토\) 18:00/);
  const later = buildReservationGuide(ctx('2026-11-26'));
  assert.doesNotMatch(later.body, /12\/23~12\/29/);
  assert.equal(DEC_CASE.validThrough, '2026-11-25');
});

// Value: protects=공립·사립 규칙을 policy.mjs 계산으로만 보여 주고 국립 평일 선착순은 단정하지 않는 결정(11-16); fails_when=국립 휴양림 규칙이 단정되거나 곳 수가 안 맞음; why_new=신규; seam=none; no_claim=규칙 자체의 정확성
test('공립·사립은 규칙별로 한 번씩 묶이고 국립은 규칙표에 없다(평일 선착순은 확인 필요)', () => {
  const groups = groupByRule(status.forests, status.generatedAt);
  const n = groups.reduce((m, g) => m + g.forests.length, 0);
  assert.equal(n, status.forests.filter((f) => f.type !== '국립').length);
  assert.ok(groups.every((g) => g.forests.every((f) => f.type !== '국립')));
  const ids = groups.flatMap((g) => g.forests.map((f) => f.id));
  assert.equal(new Set(ids).size, ids.length, '한 곳은 한 묶음에만');
  assert.match(page.body, /평일 선착순의 오픈 요일·시각은 숲나들e 안내 페이지에 풀이가 없어 확인 필요/);
  const groupHtml = page.body.split('공립·사립 오픈 규칙')[1].split('성수기 추첨 경쟁률 기록')[0];
  for (const f of status.forests.filter((x) => x.type === '국립')) assert.ok(!groupHtml.includes('href="/forest/' + encodeURIComponent(f.id) + '"'), '국립 ' + f.name + ' 은 규칙표에 없다');
});

test('매월 규칙 묶음 수만큼 달력에 월별 오픈 행이 있다', () => {
  const groups = groupByRule(status.forests, status.generatedAt);
  const monthly = groups.filter((g) => g.cycle === 'MON');
  assert.ok(monthly.length > 0);
  const rows = calendarRows(ctx('2026-11-01'), groups);
  const total = rows.flatMap((r) => r.cells).filter((c) => /예약 오픈/.test(c)).length;
  assert.equal(total, monthly.length * 2, '이번 달·다음 달');
});

// Value: protects=이슈 규칙(공식 표현·광고·후기·예약 대행·매크로·미결제분 풀림 알림 금지); fails_when=금지 표현이 본문에 들어감; why_new=신규; seam=none; no_claim=표현의 정확성
test('금지 표현이 없고 비공식 안내·출처·확인일이 있다', () => {
  assert.doesNotMatch(text, /(?<!비)공식/, "'공식' 표현");
  assert.doesNotMatch(text, /제휴|광고|후기|별점|최저가|예약 대행|예약을 대신|매크로|자동 예약|대신 예약/);
  assert.doesNotMatch(page.body, /<img|naver|네이버/i);
  assert.doesNotMatch(text, /풀림|알림 받기/, '미결제분 풀림 알림은 이번 범위가 아니다');
  assert.match(page.body, /숲나들e와 무관한 비공식 안내/);
  assert.match(page.body, new RegExp(`안내 확인일 ${CHECKED}`));
  assert.match(page.body, /https:\/\/www\.foresttrip\.go\.kr\/rep\/drlts\/drltsUseGdnc\.do/);
  assert.match(page.body, /https:\/\/www\.foresttrip\.go\.kr\/pot\/cc\/bb\/selectFripRsrvtPolcyView\.do/);
});

// Value: protects=경쟁률 출처 구분(2024·2025 산림청 보도자료, 2026 언론 보도)과 단위가 다른 신청 수 비교 금지; fails_when=신청 수 노출, 기간 오표기, 출처 구분 뒤바뀜; why_new=신규; seam=none; no_claim=원문 수치의 정확성
test('경쟁률 기록: 연도별 값·출처 구분이 맞고 신청 수는 어디에도 없다', () => {
  assert.deepEqual(PEAK.map((y) => [y.year, y.overall, y.room, y.camp]), [[2024, 5.15, 6.6, 1.69], [2025, 6.28, 7.74, 1.83], [2026, 5.91, 6.88, 2.22]]);
  assert.deepEqual(PEAK.map((y) => y.basis), ['press', 'press', 'news']);
  for (const n of ['114,110', '114110', '138,827', '138827', '137,691', '137691', '126,896', '23,289']) assert.ok(!page.body.includes(n), `신청 수 ${n} 노출 금지`);
  assert.match(page.body, /<b>2024<\/b>\s*<div class="fsub">산림청 보도자료 기준/);
  assert.match(page.body, /<b>2025<\/b>\s*<div class="fsub">산림청 보도자료 기준/);
  assert.match(page.body, /<b>2026<\/b>\s*<div class="fsub">언론 보도 기준/);
  assert.match(page.body, /2024<\/b>: 성수기 7\.25~8\.24\(보도자료 표기\), 추첨 신청 6\/10~6\/17/);
  assert.match(page.body, /2025<\/b>: 성수기 7\/15~8\/24, 추첨 신청 6\/9~6\/16/);
  assert.match(page.body, /2026<\/b>: 성수기 7\/15~8\/24, 추첨 신청 기간은 확인 못 함/);
  assert.match(page.body, /newsId=156636770/);
  assert.match(page.body, /게시글 번호 3208681/);
  assert.match(page.body, /etoday\.co\.kr\/news\/view\/2595286/);
  assert.match(page.body, /mt\.co\.kr\/policy\/2026\/06\/18\/2026061811071722166/);
});

test('직접 계산: 세 해 단순 평균·객실/야영 배율·객실 최고 시설 추이', () => {
  const s = peakStats();
  assert.equal(s.overallAvg, 5.78);
  assert.equal(s.roomAvg, 7.07);
  assert.deepEqual(s.ratioRoomCamp.map((r) => r.x), [3.9, 4.2, 3.1]);
  assert.equal(s.topRoomSame, true);
  assert.deepEqual(s.topRoomPath, [77, 91.46, 92.96]);
  assert.match(page.body, /77 → 91\.46 → 92\.96대 1/);
});

test('/reservation 이 build-static·sitemap·llms·vercel rewrite·푸터와 연결된다', () => {
  const b = read('scripts/build-static.mjs');
  assert.match(b, /buildReservationGuide/);
  assert.match(b, /loc: resv\.urlPath/, 'sitemap');
  assert.match(b, /concat\(\{ name: resv\.name, path: resv\.urlPath/, 'llms.txt');
  assert.match(b, /href="\/reservation\/">예약 오픈·추첨 일정/, '푸터');
  const vercel = JSON.parse(read('../vercel.json'));
  assert.ok(vercel.rewrites.some((r) => r.source === '/reservation' && r.destination === '/reservation/index.html'));
  assert.equal(page.urlPath, '/reservation/');
});
