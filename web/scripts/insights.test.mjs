// 데이터 인사이트(/insights): 마감률 계산, 표본 부족 숨김, 짧은 이력 표기, 사이트 연결 (이슈 #23)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeStats, closedRate, historySeries, dowSentence, insightsBody, MIN_CELLS } from './insights.mjs';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const esc = (s) => String(s ?? '');

// 2026-11-01 은 일요일. 인덱스 i -> 날짜
const dateOf = (i) => new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10);
const dow = (iso) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))).getUTCDay();
const opts = { first: 0, dow, dateOf, regionName: (c) => ({ 2: '강원' }[c]) };

// Value: protects=마감률 산식(예약완료+대기 ÷ 예약가능+대기+예약완료, 휴무·기간 밖 제외); fails_when=분모에 C/R/P/. 가 섞이거나 대기가 빠짐; why_new=신규; seam=none; no_claim=실제 수집 데이터
test('마감률: 예약완료+대기만 분자, 휴무·공사·추첨·기간 밖은 분모에서 제외', () => {
  const status = { forests: [{ id: 'F1', name: 'A휴양림', sido: '2', sidoName: '강원', sigungu: '평창', goods: [{ kind: '01', s: 'AF3CRP.A' }] }] };
  const st = computeStats(status, opts);
  assert.deepEqual(st.total, { open: 2, full: 1, wait: 1 });
  assert.equal(closedRate({ open: 150, full: 100, wait: 50 }), 50);
  assert.equal(closedRate({ open: 10, full: 10, wait: 0 }), null, '표본 부족이면 null');
  assert.equal(st.firstISO, '2026-11-01');
  assert.equal(st.lastISO, '2026-11-08');
  // 11-01 일(A)·11-08 일(A) / 11-02 월(F) / 11-03 화(대기)
  assert.equal(st.byDow['01'][0].open, 2); // i=0, i=7 모두 일요일
  assert.equal(st.byDow['01'][1].full, 1);
  assert.equal(st.byDow['01'][2].wait, 1);
  assert.ok(st.byMonth.has('2026-11'));
  assert.equal(st.byRegion.get('강원').open, 2);
});

// Value: protects=표본 부족 행을 숨기고 짧은 이력 한계를 적음; fails_when=적은 표본의 비율이 그대로 노출되거나 이력 일수가 틀림; why_new=신규; seam=none; no_claim=해석의 정확성
test('표본 부족은 숨기고, 이력이 짧다고 적고 추세를 단정하지 않는다', () => {
  const big = 'F'.repeat(MIN_CELLS) + 'A'.repeat(MIN_CELLS); // 한 객실에 긴 문자열(칸 수 확보용)
  const status = { forests: [{ id: 'F1', name: '큰휴양림', sido: '2', sidoName: '강원', sigungu: '평창', goods: [{ kind: '01', s: big }] }, { id: 'F2', name: '작은휴양림', sido: '2', sidoName: '강원', sigungu: '홍천', goods: [{ kind: '01', s: 'FFFF' }] }] };
  const stats = computeStats(status, opts);
  const series = historySeries([
    { date: '20261107', f: { F1: [10, 5, 50, null], F2: [1, 2, null, null] } },
    { date: '20261108', f: { F1: [12, 5, 50, null], F2: [1, 2, null, null] } },
  ]);
  assert.deepEqual(series[0], { date: '20261107', forests: 2, lodging: 11, camp: 7 });
  const html = insightsBody({ esc, DOW, forestUrl: (f) => `/forest/${f.id}`, kstTime: '11/10 09:00', rangeText: '11/1 ~ 12/1', forestCount: 2, stats, series });
  assert.match(html, /표본 부족/);
  assert.match(html, /수집 이력이 2일뿐입니다/);
  assert.match(html, /추세를 해석하지 않고/);
  assert.match(html, /\(예약완료 \+ 대기\) ÷ \(예약가능 \+ 대기 \+ 예약완료\)/, '산식 표기');
  assert.match(html, /<a href="\/forest\/F1">큰휴양림<\/a>/);
  assert.doesNotMatch(html, /작은휴양림/, '표본 부족 휴양림은 순위에 안 넣음');
  assert.doesNotMatch(html, /undefined|NaN/);
  assert.match(html, /supgaja@gmail\.com/);
  assert.match(dowSentence(stats.byDow['01'], DOW), /2개 미만|마감률이 가장 높은/);
});

// Value: protects=새 페이지가 sitemap·llms.txt·vercel.json 에 연결되고 푸터 사업자 정보를 가짐; fails_when=연결 누락; why_new=신규; seam=빌드 산출물(dist) 또는 소스; no_claim=배포 환경
test('/insights 가 sitemap·llms.txt·vercel rewrite 와 연결된다', () => {
  const root = path.resolve(WEB, '..');
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  assert.ok(vercel.rewrites.some((r) => r.source === '/insights' && r.destination === '/insights/index.html'));
  assert.match(fs.readFileSync(path.join(WEB, 'public/sitemap.xml'), 'utf8'), /https:\/\/supgaja\.com\/insights\//);
  const dist = path.join(WEB, 'dist');
  if (!fs.existsSync(path.join(dist, 'insights/index.html'))) return; // 빌드 전이면 소스 검사까지만
  const page = fs.readFileSync(path.join(dist, 'insights/index.html'), 'utf8');
  assert.match(page, /<link rel="canonical" href="https:\/\/supgaja\.com\/insights\/"/);
  assert.match(page, /사업자등록번호: 311-11-67514/);
  assert.match(page, /수집 이력이 \d+일뿐입니다|수집 이력이 하루뿐/);
  assert.match(fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8'), /supgaja\.com\/insights\//);
  assert.match(fs.readFileSync(path.join(dist, 'llms.txt'), 'utf8'), /supgaja\.com\/insights\//);
});
