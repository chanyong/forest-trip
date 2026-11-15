// 이슈 #36: 계절 큐레이션 랜딩(/season/)·지역·테마 허브(/hub/): 노출 구간, 사실만 담기, 금지 표현, 유사도, 내부 링크
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { buildCuration, resolveSeason, SEASONS, fourPrices, campGroupOf, CAMP_GROUPS } from './curation.mjs';
import { pairwise } from './similarity.mjs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const status = JSON.parse(read('public/data/status.json'));
const HOLIDAYS = JSON.parse(read('src/lib/holidays.json'));
const SITE = 'https://supgaja.com';

const isoOf = (y) => `${y.slice(0, 4)}-${y.slice(4, 6)}-${y.slice(6, 8)}`;
const toUTC = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const addDays = (iso, n) => new Date(toUTC(iso) + n * 864e5).toISOString().slice(0, 10);
const dow = (iso) => new Date(toUTC(iso)).getUTCDay();
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const isRest = (iso) => dow(iso) === 0 || dow(iso) === 6 || !!HOLIDAYS[iso];
const start = isoOf(status.start);
const kstDay = new Date(Date.parse(status.generatedAt) + 9 * 3600e3).toISOString().slice(0, 10);
let first = 0;
outer: for (let i = 0; i < status.days; i++) for (const f of status.forests) for (const g of f.goods) if (g.s[i] && g.s[i] !== '.') { first = i; break outer; }

const ctxFor = (todayISO) => ({
  status, start, first, SITE, todayISO, kstTime: '11/15 15:40',
  esc: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  alertAttr: (o) => JSON.stringify({ site: 'supgaja.com', ...o }).replace(/"/g, '&quot;'),
  forestUrl: (f) => `/forest/${encodeURIComponent(f.id)}`,
  md: (iso) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`,
  mdw: (iso) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}(${DOW[dow(iso)]})`,
  dateOf: (i) => addDays(start, i), isWeekendStay: (iso) => isRest(addDays(iso, 1)),
  regionName: (c) => ({ 1: '경기·서울·인천', 2: '강원' }[c]),
});
const cur = buildCuration(ctxFor(kstDay));
const bySlug = (cu, k) => cu.pages.find((p) => p.slug === k);
const textOf = (p) => p.body.replace(/<[^>]+>/g, ' ');

// Value: protects=시즌 노출 구간(해를 넘기는 겨울·연말 포함)과 만료; fails_when=지난 시즌이 계속 노출되거나 다음 시즌이 일찍·늦게 열림; why_new=신규; seam=none; no_claim=실제 노출 일정
test('resolveSeason: 노출 구간 안이면 체크인 범위, 밖이면 null(해 넘김 포함)', () => {
  const get = (slug) => SEASONS.find((s) => s.slug === slug);
  assert.deepEqual(resolveSeason(get('autumn'), '2026-11-15'), { from: '2026-10-01', to: '2026-11-30' });
  assert.equal(resolveSeason(get('autumn'), '2026-11-21'), null, '단풍 막바지: 11-20 이후 내려감');
  assert.equal(resolveSeason(get('autumn'), '2026-09-14'), null, '노출 시작 전');
  assert.deepEqual(resolveSeason(get('winter'), '2026-11-15'), { from: '2026-12-01', to: '2027-02-28' });
  assert.deepEqual(resolveSeason(get('winter'), '2027-01-10'), { from: '2026-12-01', to: '2027-02-28' }, '해를 넘겨도 같은 겨울');
  assert.equal(resolveSeason(get('winter'), '2027-02-21'), null);
  assert.deepEqual(resolveSeason(get('year-end'), '2026-12-30'), { from: '2026-12-24', to: '2027-01-03' });
  assert.equal(resolveSeason(get('year-end'), '2027-01-04'), null);
  assert.equal(resolveSeason(get('summer'), '2026-11-15'), null, '여름은 아직 숨김');
  assert.ok(resolveSeason(get('summer'), '2027-06-02'), '여름은 6월부터 노출');
  assert.ok(resolveSeason(get('spring'), '2027-02-25'), '봄은 2월 말부터 노출');
});

test('지금 데이터: 가을·겨울·연말연시 랜딩과 허브 3개가 생기고 봄·여름·반려견은 없다', () => {
  assert.deepEqual(cur.pages.filter((p) => p.kind === 'season').map((p) => p.slug).sort(), ['autumn', 'winter', 'year-end']);
  assert.deepEqual(cur.pages.filter((p) => p.kind === 'hub').map((p) => p.slug).sort(), ['camping', 'capital', 'kids']);
  assert.ok(!bySlug(cur, 'pet') && !cur.pages.some((p) => /반려/.test(p.title + p.name)), '공식 확인된 출처가 없어 반려견 허브는 만들지 않는다');
});

test('노출 구간 밖이거나 수집 범위에 날짜가 없으면 시즌 페이지를 만들지 않는다', () => {
  const later = buildCuration(ctxFor('2027-03-01')); // 봄 노출 구간이지만 수집 범위(~1월 말) 밖
  assert.ok(!bySlug(later, 'spring'), '봄: 수집 범위 밖이면 만들지 않음');
  assert.ok(!bySlug(later, 'autumn') && !bySlug(later, 'winter'));
  assert.equal(later.pages.filter((p) => p.kind === 'hub').length, 3, '허브는 시즌과 무관하게 유지');
});

test('수도권 허브는 경기·서울·인천 전부(25곳), 모든 휴양림 링크가 실제 id 와 맞는다', () => {
  const cap = bySlug(cur, 'capital');
  const n = status.forests.filter((f) => f.sido === '1').length;
  assert.equal(cap.forests.length, n);
  assert.match(cap.title, new RegExp(`${n}곳`));
  const ids = new Set(status.forests.map((f) => f.id));
  for (const p of cur.pages) {
    const links = [...p.body.matchAll(/href="\/forest\/([^"/]+)"/g)].map((m) => decodeURIComponent(m[1]));
    assert.ok(links.length > 0, p.slug);
    for (const id of links) assert.ok(ids.has(id), `${p.slug}: ${id}`);
  }
});

test('시즌 랜딩: 빈자리 표·요금 4값·지역 표·출처와 확인일이 있다', () => {
  for (const slug of ['autumn', 'winter', 'year-end']) {
    const p = bySlug(cur, slug);
    assert.match(p.body, /평일 · 주말/, `${slug}: 요금 4값(평일·주말 × 비수기·성수기) 머리글`);
    assert.match(p.body, /비수기<\/span> [\d.,]+(만)?원 · /, `${slug}: 요금 값`);
    assert.match(p.body, /성수기<\/span> /);
    assert.match(p.body, /<h2>지역별 빈자리<\/h2>/);
    assert.match(p.body, /출처: 숲나들e/);
    assert.match(p.body, new RegExp(`확인일 ${kstDay}`));
    assert.match(p.body, /data-alert=/);
    assert.ok(p.jsonld.some((x) => x['@type'] === 'BreadcrumbList') && p.jsonld.some((x) => x['@type'] === 'CollectionPage' && x.mainEntity['@type'] === 'ItemList'));
  }
  // 겨울: 난방·적설 정보는 없다고 적고 있는 것처럼 쓰지 않는다
  const w = bySlug(cur, 'winter');
  assert.match(textOf(w), /난방 방식·적설 정보는 수집 항목에 없어/);
  assert.doesNotMatch(textOf(w).replace('난방 방식·적설 정보는 수집 항목에 없어 표시하지 않습니다', ''), /난방|눈꽃|설경/);
});

// Value: protects=이슈 규칙(공식 표현·광고·후기·실적·네이버 별점·이미지·예약 대행 금지); fails_when=금지 표현이 본문에 들어감; why_new=신규; seam=none; no_claim=표현의 정확성
test('금지 표현·이미지·네이버 별점이 없다', () => {
  for (const p of cur.pages) {
    const t = textOf(p) + p.title + p.description;
    assert.doesNotMatch(t, /(?<!비)공식/, `${p.slug}: '공식' 표현`);
    assert.doesNotMatch(t, /추천|인기|제휴|광고|후기|최고|최저가|예약 대행|예약을 대신|투자|별점|리뷰|수상|만족도/, p.slug);
    assert.doesNotMatch(p.body, /<img|naver|네이버/i, p.slug);
    assert.match(p.body, /숲나들e와 무관한 비공식 안내/, p.slug);
  }
});

test('아이와 함께 허브: 기준(정원 4~6인 숙소)이 적혀 있고 아이 안전·연령 적합 단정이 없다', () => {
  const k = bySlug(cur, 'kids');
  assert.match(k.guide, /정원 4~6인/);
  assert.match(k.guide, /수집 항목에 없으므로 판단하지 않습니다/);
  assert.doesNotMatch(textOf(k), /안전합니다|안심|아이에게 좋/);
  assert.ok(k.forests.length <= 30);
  assert.match(k.body, /편의 표시\(객실 수\)/);
  assert.match(k.body, /<th class="hide-sm">편의 표시/, '좁은 화면에서는 보조 열을 숨김');
});

test('야영장 허브: 유형 묶음이 야영장 사이트를 빠짐없이 한 번씩 센다', () => {
  const camp = status.forests.flatMap((f) => f.goods).filter((g) => g.kind === '02');
  const counts = new Map();
  for (const g of camp) counts.set(campGroupOf(g).slug, (counts.get(campGroupOf(g).slug) || 0) + 1);
  assert.equal([...counts.values()].reduce((a, b) => a + b, 0), camp.length);
  assert.equal(campGroupOf({ cls: '평상데크' }).slug, 'pyeongsang');
  assert.equal(campGroupOf({ cls: 'B지구(자동차) 야영데크' }).slug, 'deck');
  assert.equal(campGroupOf({ cls: '무궁화오토캠핑A' }).slug, 'auto');
  assert.equal(CAMP_GROUPS.at(-1).slug, 'etc');
  const page = bySlug(cur, 'camping');
  for (const [slug, n] of counts) assert.match(page.body, new RegExp(`id="${slug}"`), `${slug}(${n}개) 구역`);
});

test('요금 4값: 객실 중 가장 낮은 값, 0·없음은 제외', () => {
  assert.deepEqual(fourPrices([{ pr: [40000, 60000, 0, 80000] }, { pr: [30000, 70000, 90000, 100000] }]), [30000, 60000, 90000, 80000]);
  assert.deepEqual(fourPrices([{ pr: [0, 0, 0, 0] }, {}]), [null, null, null, null]);
});

// Value: protects=similarity.mjs 기준(반복 문장 금지); fails_when=시즌·허브 선택 가이드 문단끼리 같은 틀 그대로 반복됨; why_new=신규; seam=none; no_claim=문장 품질
test('선택 가이드 문단 유사도가 기준(0.5) 미만이다', () => {
  const r = pairwise(cur.pages.map((p) => ({ id: p.slug, text: p.guide })));
  assert.ok(r.max < 0.5, `최대 ${r.max.toFixed(2)} (${r.pair})`);
  const rs = pairwise(cur.pages.filter((p) => p.kind === 'season').map((p) => ({ id: p.slug, text: p.guide })));
  assert.ok(rs.max < 0.5, `시즌끼리 최대 ${rs.max.toFixed(2)}`);
});

test('연결: 칩 내비는 모든 페이지에, 휴양림 관련 링크는 실린 휴양림에만 나온다', () => {
  const cap = bySlug(cur, 'capital');
  for (const p of cur.pages) for (const q of cur.pages) assert.ok(p.body.includes(`href="${q.urlPath}"`), `${p.slug} → ${q.slug}`);
  assert.match(cur.chipNav(cap.urlPath), /aria-current="page"/);
  const inCap = cap.forests[0], notCap = status.forests.find((f) => f.sido !== '1');
  assert.match(cur.relatedHtml(inCap), /\/hub\/capital\//);
  assert.doesNotMatch(cur.relatedHtml(notCap), /\/hub\/capital\//);
});

test('build-static·llms·vercel.json·FAQ 가 새 페이지를 연결한다', () => {
  const b = read('scripts/build-static.mjs');
  assert.match(b, /buildCuration/);
  assert.match(b, /\[\.\.\.fixed, \.\.\.urls, \.\.\.curUrls\]/, 'sitemap');
  assert.match(b, /guides: cur\.pages\.map/, 'llms.txt');
  assert.match(b, /cur\.relatedHtml\(f\)/, '휴양림 상세');
  assert.match(b, /cur\.chipNav\(''\)/, '목록·지역 랜딩');
  const v = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
  assert.ok(v.rewrites.some((r) => r.source === '/season/:s'));
  assert.ok(v.rewrites.some((r) => r.source === '/hub/:h'));
  const faq = read('public/faq.html');
  for (const h of ['/hub/capital/', '/hub/kids/', '/hub/camping/']) assert.ok(faq.includes(`href="${h}"`), h);
  if (!existsSync(new URL('../dist/sitemap.xml', import.meta.url))) return;
  const sm = read('dist/sitemap.xml'), llms = read('dist/llms.txt');
  for (const p of cur.pages) {
    assert.ok(sm.includes(`<loc>${SITE}${p.urlPath}</loc>`), `sitemap ${p.urlPath}`);
    assert.ok(llms.includes(`${SITE}${p.urlPath}`), `llms ${p.urlPath}`);
    assert.ok(existsSync(new URL(`../dist${p.urlPath}index.html`, import.meta.url)), `dist ${p.urlPath}`);
  }
});
