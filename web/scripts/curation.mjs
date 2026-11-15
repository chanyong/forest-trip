// 계절 큐레이션 랜딩(/season/<slug>/)과 지역·테마 허브(/hub/<slug>/) (이슈 #36)
// 입력은 수집 데이터(status.json)뿐이다. 새 수집·외부 소개문·이미지·네이버 리뷰·별점은 쓰지 않는다.
// 문장은 모두 계산값에서 만들고, 사실·출처·확인일을 적는다. 광고·제휴·예약 대행 표현은 없다.

const KIND_NAME = { '01': '숙소', '02': '야영장' };
const UNIT = { '01': '실', '02': '곳' };

/**
 * 계절 랜딩 설정(틀). show 는 [노출 시작, 노출 끝] (MM-DD, 끝이 시작보다 앞이면 해를 넘김).
 * 오늘(수집 시각 기준)이 노출 구간 밖이거나 수집 범위에 체크인 날짜가 없으면 페이지를 만들지 않는다
 * (sitemap·내부 링크에서도 함께 빠진다). 새 시즌은 이 배열에 한 줄을 더하면 된다.
 * from~to 는 체크인 날짜 범위(MM-DD).
 */
export const SEASONS = [
  { slug: 'autumn', name: '가을', h1: '가을 단풍철 11월 자연휴양림 빈자리', from: '10-01', to: '11-30', show: ['09-15', '11-20'], kinds: ['01', '02'],
    scope: '10~11월', limit: '단풍·낙엽 상황은 수집 항목에 없어 다루지 않습니다. 이 페이지는 남은 가을 체크인 날짜의 예약 현황만 보여 줍니다.' },
  { slug: 'winter', name: '겨울', h1: '겨울 12~2월 자연휴양림 숙소 빈자리', from: '12-01', to: '02-28', show: ['11-01', '02-20'], kinds: ['01'],
    scope: '12~2월', limit: '난방 방식·적설 정보는 수집 항목에 없어 표시하지 않습니다. 객실 상세는 숲나들e에서 확인하세요.' },
  { slug: 'year-end', name: '연말연시', h1: '연말연시 12/24~1/3 자연휴양림 숙소 빈자리', from: '12-24', to: '01-03', show: ['11-10', '01-03'], kinds: ['01'],
    scope: '12월 24일~1월 3일', limit: '연말연시는 연휴 전후로 예약이 몰려 수집 시점과 실제 상태가 달라지기 쉽습니다. 예약 직전에 숲나들e에서 다시 확인하세요.' },
  { slug: 'spring', name: '봄', h1: '봄 3~5월 자연휴양림 빈자리', from: '03-15', to: '05-31', show: ['02-20', '05-20'], kinds: ['01', '02'],
    scope: '3월 중순~5월', limit: '개화·산불 방지 입산 통제 같은 현장 사정은 수집 항목에 없습니다. 방문 전 휴양림에 확인하세요.' },
  { slug: 'summer', name: '여름', h1: '여름 휴가철 7~8월 자연휴양림 빈자리', from: '07-01', to: '08-31', show: ['06-01', '08-20'], kinds: ['01', '02'],
    scope: '7~8월', limit: '계곡·물놀이 시설 개방 여부는 수집 항목에 없습니다. 방문 전 휴양림에 확인하세요.' },
];

/** 노출 구간이 끝난 지 N일 이내(종료 안내 페이지를 남기는 기간). 노출 중이거나 아직 시작 전이면 false */
export const EXPIRED_DAYS = 60;
export function recentlyEnded(s, todayISO) {
  const y0 = +todayISO.slice(0, 4);
  for (const Y of [y0 - 1, y0]) {
    const end = `${s.show[1] < s.show[0] ? Y + 1 : Y}-${s.show[1]}`;
    const d = Math.round((Date.parse(todayISO) - Date.parse(end)) / 864e5);
    if (d > 0 && d <= EXPIRED_DAYS) return true;
  }
  return false;
}

/** 오늘이 노출 구간이면 체크인 범위 {from,to}(ISO), 아니면 null */
export function resolveSeason(s, todayISO) {
  const y0 = +todayISO.slice(0, 4);
  const ymd = (y, md) => `${y}-${md}`;
  for (const Y of [y0 - 1, y0]) {
    const ss = ymd(Y, s.show[0]);
    const se = ymd(s.show[1] < s.show[0] ? Y + 1 : Y, s.show[1]);
    if (todayISO < ss || todayISO > se) continue;
    const cy = s.from >= s.show[0] ? Y : Y + 1;
    return { from: ymd(cy, s.from), to: ymd(s.to >= s.from ? cy : cy + 1, s.to) };
  }
  return null;
}

// 야영장 유형 묶음: 객실 유형(cls) 이름의 낱말로 나눈다. 먼저 맞는 묶음이 이긴다.
export const CAMP_GROUPS = [
  { slug: 'caravan', name: '카라반', re: /캐라반|^카라반$/ },
  { slug: 'caravan-site', name: '카라반·캠핑카 사이트', re: /카라반|캠핑카/ },
  { slug: 'glamping', name: '글램핑·캐빈·캠핑하우스·트리하우스', re: /글램핑|캐빈|캠핑하우스|트리/ },
  { slug: 'pyeongsang', name: '평상', re: /평상/ },
  { slug: 'deck', name: '야영데크', re: /데크/ },
  { slug: 'auto', name: '오토캠핑장', re: /오토|자동차/ },
  { slug: 'nojee', name: '노지·백패킹', re: /노지|백패킹/ },
  { slug: 'extra', name: '바비큐장·오두막·원두막', re: /바비큐|오두막|원두막/ },
  { slug: 'etc', name: '그 밖의 야영장', re: /./ },
];
export const campGroupOf = (g) => CAMP_GROUPS.find((x) => x.re.test(String(g.cls || '')));

export const KIDS_MIN = 4, KIDS_MAX = 6; // 가족(4~6인) 숙소 비교 허브(주소 /hub/kids/ 유지): 숙소 객실 정원 범위
const num = (n) => Number(n).toLocaleString('en-US');
const range = (xs, fmt) => { if (!xs.length) return '-'; const lo = Math.min(...xs), hi = Math.max(...xs); return lo === hi ? fmt(lo) : `${fmt(lo)}~${fmt(hi)}`; };
const won = (n) => (n >= 10000 ? `${(n / 10000).toFixed(1).replace(/\.0$/, '')}만원` : `${n.toLocaleString()}원`);

/** 요금 4값 [비수기 평일, 비수기 주말, 성수기 평일, 성수기 주말]: 객실 중 가장 낮은 값(0·없음은 제외) */
export function fourPrices(goods) {
  return [0, 1, 2, 3].map((i) => { const xs = goods.map((g) => g.pr?.[i]).filter((p) => p > 0); return xs.length ? Math.min(...xs) : null; });
}
const priceCell = (p) => (p.every((x) => x == null) ? '<span class="fsub">-</span>'
  : `<span class="fsub">비수기</span> ${p[0] ? won(p[0]) : '-'} · ${p[1] ? won(p[1]) : '-'}<br><span class="fsub">성수기</span> ${p[2] ? won(p[2]) : '-'} · ${p[3] ? won(p[3]) : '-'}`);
const priceTh = (kind) => `${KIND_NAME[kind]} 1박 요금(객실 중 최저, 평일 · 주말)`;

/**
 * @param {object} c 빌드 문맥
 * c.status, c.start(ISO), c.first(첫 데이터 인덱스), c.todayISO, c.generatedAt(ISO), c.kstTime,
 * c.esc, c.mdw(iso), c.md(iso), c.dateOf(i), c.isWeekendStay(iso), c.forestUrl(f), c.regionName(sido), c.alertAttr(o)
 */
export function buildCuration(c) {
  const { status, esc } = c;
  const diff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
  const lastISO = c.dateOf(status.days - 1), firstISO = c.dateOf(c.first);
  const idxOf = (iso) => diff(c.start, iso);

  /** 휴양림 f 의 goods(조건 맞는 것만)로 날짜 구간 [lo,hi] 안 예약가능(A) 집계 */
  const tally = (goods, lo, hi) => {
    const byDate = new Map();
    for (const g of goods) for (let i = Math.max(lo, c.first); i <= hi && i < g.s.length; i++) if (g.s[i] === 'A') byDate.set(i, (byDate.get(i) || 0) + 1);
    const idx = [...byDate.keys()].sort((a, b) => a - b);
    return { n: idx.reduce((m, i) => m + byDate.get(i), 0), days: idx.length, nearest: idx.length ? c.dateOf(idx[0]) : null, weekendDays: idx.filter((i) => c.isWeekendStay(c.dateOf(i))).length };
  };
  const SOURCE = (extra = '') => `<p class="fsub" style="margin-top:20px">출처: 숲나들e에 공개된 월별 예약현황·객실 목록·요금표를 숲가자가 모아 계산한 값입니다. 확인일 ${esc(c.todayISO)}(수집일, ${esc(c.kstTime)} 기준). 요금은 비수기·성수기, 평일·주말 4가지 중 등록된 값이며 실제 결제 금액과 예약 가능 여부는 <a href="https://www.foresttrip.go.kr" target="_blank" rel="noopener">숲나들e</a>에서 확인하세요.${extra} 이 사이트는 숲나들e와 무관한 비공식 안내입니다.</p>`;
  const crumbLd = (name, urlPath) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: '숲가자', item: c.SITE + '/' }, { '@type': 'ListItem', position: 2, name: '휴양림', item: c.SITE + '/forest/' }, { '@type': 'ListItem', position: 3, name, item: c.SITE + urlPath }] });
  const listLd = (name, urlPath, forests) => ({ '@context': 'https://schema.org', '@type': 'CollectionPage', name, url: c.SITE + urlPath, inLanguage: 'ko',
    mainEntity: { '@type': 'ItemList', numberOfItems: Math.min(forests.length, 30), itemListElement: forests.slice(0, 30).map((f, i) => ({ '@type': 'ListItem', position: i + 1, name: f.name, url: c.SITE + c.forestUrl(f) })) } });
  const forestCell = (f) => `<a href="${c.forestUrl(f)}"><b>${esc(f.name)}</b></a><div class="fsub">${esc(f.sidoName)} ${esc(f.sigungu)} · ${esc(f.type)}</div>`;
  const table = (head, rows) => `<div style="overflow-x:auto"><table><thead><tr>${head.map((h) => (typeof h === 'string' ? `<th>${h}</th>` : `<th class="hide-sm">${h.t}</th>`)).join('')}</tr></thead><tbody>
${rows.join('\n')}
</tbody></table></div>`;
  const nearestTxt = (t) => (t.nearest ? `가까운 ${c.mdw(t.nearest)}${t.weekendDays ? ` · 주말 ${t.weekendDays}일` : ''}` : '');

  const pages = [];

  // ---- 계절 랜딩 ----
  for (const s of SEASONS) {
    const win = resolveSeason(s, c.todayISO);
    if (!win) continue;
    const from = win.from < firstISO ? firstISO : win.from, to = win.to > lastISO ? lastISO : win.to;
    if (from > to) continue; // 수집 범위에 이 시즌 날짜가 없다
    const lo = idxOf(from), hi = idxOf(to);
    const rows = [];
    for (const f of status.forests) {
      const goods = f.goods.filter((g) => s.kinds.includes(g.kind));
      const t = tally(goods, lo, hi);
      if (t.n) rows.push({ f, t, goods, price: fourPrices(goods.filter((g) => g.kind === s.kinds[0])) });
    }
    if (!rows.length) continue;
    rows.sort((a, b) => b.t.n - a.t.n || a.f.name.localeCompare(b.f.name, 'ko'));
    const totalN = rows.reduce((m, r) => m + r.t.n, 0);
    const weekendForests = rows.filter((r) => r.t.weekendDays).length;
    const byRegion = new Map();
    for (const r of rows) { const k = c.regionName(r.f.sido) || r.f.sidoName; const o = byRegion.get(k) || { forests: 0, n: 0 }; o.forests++; o.n += r.t.n; byRegion.set(k, o); }
    const regions = [...byRegion].sort((a, b) => b[1].forests - a[1].forests || b[1].n - a[1].n || a[0].localeCompare(b[0], 'ko'));
    const kindTxt = s.kinds.map((k) => KIND_NAME[k]).join('·');
    const top = rows[0];
    const priced = rows.filter((r) => r.price[1]).sort((a, b) => a.price[1] - b.price[1] || a.f.name.localeCompare(b.f.name, 'ko'));
    const cheapest = priced[0];
    const guide = [
      `${c.md(from)}~${c.md(to)} 체크인(${s.scope}) ${kindTxt} 가운데 숲나들e에 예약가능으로 나온 곳은 휴양림 ${rows.length}곳, 객실·날짜 ${num(totalN)}건입니다.`,
      `빈자리 건수가 가장 많은 곳은 ${top.f.name}(${num(top.t.n)}건, ${top.t.days}일)입니다.`,
      weekendForests ? `금·토·연휴 전날 체크인 빈자리가 있는 곳은 ${weekendForests}곳입니다.` : '이 기간에는 금·토·연휴 전날 체크인 빈자리가 있는 곳이 없습니다.',
      cheapest ? `표시된 ${KIND_NAME[s.kinds[0]]} 비수기 주말 요금 중 가장 낮은 값은 ${cheapest.f.name}의 ${won(cheapest.price[1])}입니다.` : '',
      `빈자리가 있는 휴양림 수는 ${regions.slice(0, 3).map(([n, o]) => `${n} ${o.forests}곳`).join(', ')} 순으로 많습니다.`,
      to < win.to ? `수집 범위가 ${c.md(lastISO)}까지라 그 뒤 날짜는 포함하지 않았습니다.` : '',
    ].filter(Boolean).join(' ');
    const urlPath = `/season/${s.slug}/`;
    const shown = rows.slice(0, 40);
    const appQs = new URLSearchParams({ from, to, ...(s.kinds.length === 1 ? { kinds: s.kinds[0] } : {}) }).toString();
    const alertFilters = [{ key: 'date', op: 'between', value: [from, to] }, ...(s.kinds.length === 1 ? [{ key: 'type', op: 'eq', value: KIND_NAME[s.kinds[0]] }] : [])];
    const body = `
<p class="crumb"><a href="/">홈</a> › <a href="/forest/">휴양림</a> › ${esc(s.name)} 모음</p>
<h1>${esc(s.h1)}</h1>
<p class="lead">${esc(c.md(from))}~${esc(c.md(to))} 체크인 ${esc(kindTxt)} 중 예약가능한 휴양림 <b>${rows.length}곳</b>을 빈자리 많은 순으로 모았습니다. 수집한 값을 그대로 계산해 보여 줍니다.</p>
<p class="stamp">마지막 갱신 ${esc(c.kstTime)} · 출처 숲나들e 월별 예약현황 · 1박 체크인 기준, 하루 여러 번 갱신</p>
<div class="actions">
  <a class="btn primary" href="/?${esc(appQs)}">조건 그대로 숲가자에서 보기</a>
  <button type="button" class="btn alert" data-alert="${c.alertAttr({ label: `${s.name} ${kindTxt} 빈자리`, filters: alertFilters })}">🔔 빈자리 알림 받기</button>
</div>
<h2>고르기 전에 확인할 값</h2>
<p>${esc(guide)}</p>
<p class="note">${esc(s.limit)}</p>
<h2>휴양림 비교 (${rows.length}곳 중 ${shown.length}곳)</h2>
${table(['휴양림', `빈자리(${kindTxt})`, priceTh(s.kinds[0])], shown.map(({ f, t, price }) => `<tr><td>${forestCell(f)}</td><td><span class="num">${num(t.n)}</span>건 · ${t.days}일<div class="fsub">${esc(nearestTxt(t))}</div></td><td>${priceCell(price)}</td></tr>`))}
${rows.length > shown.length ? `<p class="fsub">외 ${rows.length - shown.length}곳은 <a href="/?${esc(appQs)}">숲가자에서 보기</a></p>` : ''}
<h2>지역별 빈자리</h2>
${table(['지역', '빈자리 있는 휴양림', '객실·날짜 건수'], regions.map(([n, o]) => `<tr><td>${esc(n)}</td><td>${o.forests}곳</td><td>${num(o.n)}건</td></tr>`))}
${SOURCE(` 요금 열은 ${esc(KIND_NAME[s.kinds[0]])} 객실 중 가장 낮은 값이라 원하는 객실의 요금과 다를 수 있습니다.`)}
`;
    pages.push({ kind: 'season', slug: s.slug, name: `${s.name} 모음`, urlPath, forests: rows.map((r) => r.f), freq: 'daily', pri: '0.6',
      title: `${s.h1} · 숲가자`,
      description: `${c.md(from)}~${c.md(to)} 체크인 ${kindTxt} 예약 빈자리가 있는 휴양림 ${rows.length}곳의 빈자리 건수와 요금 4값을 비교합니다. 숲나들e 예약현황을 하루 여러 번 모아 갱신합니다.`,
      guide, body, jsonld: [crumbLd(s.h1, urlPath), listLd(s.h1, urlPath, rows.map((r) => r.f))] });
  }

  // ---- 허브 1: 수도권 근교 ----
  capital: {
    const fs_ = status.forests.filter((f) => f.sido === '1');
    if (!fs_.length) break capital; // 수집 데이터에 없으면 페이지를 만들지 않는다
    const lo = c.first, hi = status.days - 1;
    const rows = fs_.map((f) => {
      const lodging = f.goods.filter((g) => g.kind === '01'), camp = f.goods.filter((g) => g.kind === '02');
      return { f, lodging, camp, tl: tally(lodging, lo, hi), tc: tally(camp, lo, hi), price: fourPrices(lodging) };
    }).sort((a, b) => (b.tl.days + b.tc.days) - (a.tl.days + a.tc.days) || a.f.name.localeCompare(b.f.name, 'ko'));
    const types = ['국립', '공립', '사립'].map((t) => [t, fs_.filter((f) => f.type === t).length]).filter(([, n]) => n);
    const withBoth = rows.filter((r) => r.lodging.length && r.camp.length).length;
    const lodgingN = rows.reduce((m, r) => m + r.lodging.length, 0), campN = rows.reduce((m, r) => m + r.camp.length, 0);
    const cheap = rows.filter((r) => r.price[1]).sort((a, b) => a.price[1] - b.price[1] || a.f.name.localeCompare(b.f.name, 'ko'))[0];
    const openNow = rows.filter((r) => r.tl.days + r.tc.days > 0).length;
    const sigungu = new Map();
    for (const f of fs_) sigungu.set(f.sigungu, (sigungu.get(f.sigungu) || 0) + 1);
    const guide = `서울·인천·경기 지역 자연휴양림은 수집 데이터 기준 ${fs_.length}곳(${types.map(([t, n]) => `${t} ${n}곳`).join(', ')})이고, 숙소 ${num(lodgingN)}실과 야영장 ${num(campN)}곳이 있습니다. 숙소와 야영장을 모두 갖춘 곳은 ${withBoth}곳입니다. 시군구로는 ${[...sigungu].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko')).slice(0, 3).map(([n, k]) => `${n} ${k}곳`).join(', ')}에 많이 모여 있습니다. ${c.md(firstISO)}~${c.md(lastISO)} 체크인 중 예약가능 날짜가 하나라도 있는 곳은 ${openNow}곳입니다.${cheap ? ` 표시된 비수기 주말 숙소 요금 중 가장 낮은 값은 ${cheap.f.name}의 ${won(cheap.price[1])}입니다.` : ''}`;
    const urlPath = '/hub/capital/';
    const body = `
<p class="crumb"><a href="/">홈</a> › <a href="/forest/">휴양림</a> › 수도권 근교</p>
<h1>수도권 근교 자연휴양림 ${fs_.length}곳 비교</h1>
<p class="lead">서울·인천·경기에 있는 자연휴양림을 시설·요금·지금 빈자리 기준으로 한 표에 모았습니다. 날짜별 빈자리는 <a href="/vacancy/gyeonggi/this-weekend/">이번 주말 경기·서울·인천 빈자리</a>에서 볼 수 있습니다.</p>
<p class="stamp">마지막 갱신 ${esc(c.kstTime)} · 출처 숲나들e 객실 목록·요금·월별 예약현황</p>
<h2>한눈에 보기</h2>
<p>${esc(guide)}</p>
<h2>휴양림 비교표</h2>
${table(['휴양림', '시설', priceTh('01'), `빈자리(${c.md(firstISO)}~${c.md(lastISO)})`], rows.map(({ f, lodging, camp, tl, tc, price }) => `<tr><td>${forestCell(f)}</td><td>${lodging.length ? `숙소 ${lodging.length}실` : ''}${lodging.length && camp.length ? '<br>' : ''}${camp.length ? `야영장 ${camp.length}곳` : ''}</td><td>${priceCell(price)}</td><td>${tl.days ? `숙소 <span class="num">${tl.days}</span>일` : ''}${tl.days && tc.days ? '<br>' : ''}${tc.days ? `야영 <span class="num">${tc.days}</span>일` : ''}${tl.days + tc.days ? '' : '<span class="fsub">없음</span>'}</td></tr>`))}
${SOURCE(' 빈자리 일수는 예약가능(A)인 객실·사이트가 하나라도 있는 체크인 날짜 수이고, 요금 열은 숙소 객실 중 가장 낮은 값입니다.')}
`;
    pages.push({ kind: 'hub', slug: 'capital', name: '수도권 근교', urlPath, forests: rows.map((r) => r.f), freq: 'daily', pri: '0.7',
      title: `수도권 근교 자연휴양림 ${fs_.length}곳 비교 (서울·인천·경기) · 숲가자`,
      description: `서울·인천·경기 자연휴양림 ${fs_.length}곳의 시설 규모, 1박 요금 4값, 앞으로 예약가능한 날짜 수를 한 표로 비교합니다. 숲나들e 데이터를 하루 여러 번 갱신합니다.`,
      guide, body, jsonld: [crumbLd('수도권 근교 자연휴양림', urlPath), listLd('수도권 근교 자연휴양림', urlPath, rows.map((r) => r.f))] });
  }

  // ---- 허브 2: 가족(4~6인) 숙소 비교 (정원 4~6인 숙소 객실 기준) ----
  kids: {
    const lo = c.first, hi = status.days - 1;
    const rows = [];
    for (const f of status.forests) {
      const goods = f.goods.filter((g) => g.kind === '01' && g.cap >= KIDS_MIN && g.cap <= KIDS_MAX);
      if (goods.length) rows.push({ f, goods, t: tally(goods, lo, hi), price: fourPrices(goods) });
    }
    rows.sort((a, b) => b.goods.length - a.goods.length || a.f.name.localeCompare(b.f.name, 'ko'));
    if (!rows.length) break kids; // 이 크기 객실이 없으면 페이지를 만들지 않는다(topRow 없음)
    const shown = rows.slice(0, 30);
    const topRow = rows[0];
    const totalRooms = rows.reduce((m, r) => m + r.goods.length, 0);
    const guide = `이 목록은 정원 ${KIDS_MIN}~${KIDS_MAX}인 숙소 객실(가족 단위로 쓰는 크기)을 기준으로 골랐습니다. 이 크기 객실이 있는 휴양림은 ${rows.length}곳, 객실은 모두 ${num(totalRooms)}실이며 아래 표에는 객실 수가 많은 ${shown.length}곳을 실었습니다. 이 크기 객실이 가장 많은 곳은 ${topRow.f.name}으로 ${topRow.goods.length}실(${range(topRow.goods.map((g) => g.cap), (n) => `${n}인`)})입니다. 아이 연령별 적합 여부나 안전 시설은 수집 항목에 없으므로 판단하지 않습니다.`;
    const urlPath = '/hub/kids/';
    const body = `
<p class="crumb"><a href="/">홈</a> › <a href="/forest/">휴양림</a> › 가족(${KIDS_MIN}~${KIDS_MAX}인) 숙소 비교</p>
<h1>가족(${KIDS_MIN}~${KIDS_MAX}인) 숙소 비교: 자연휴양림 정원 ${KIDS_MIN}~${KIDS_MAX}인 객실</h1>
<p class="lead">가족 단위로 묵을 수 있는 정원 ${KIDS_MIN}~${KIDS_MAX}인 숙소 객실을 기준으로, 객실 수·면적·요금·지금 빈자리를 비교했습니다.</p>
<p class="stamp">마지막 갱신 ${esc(c.kstTime)} · 출처 숲나들e 객실 목록·요금·월별 예약현황</p>
<h2>선택 기준과 한눈에 보기</h2>
<p>${esc(guide)}</p>
<h2>휴양림 비교표 (${rows.length}곳 중 ${shown.length}곳)</h2>
${table(['휴양림', `정원 ${KIDS_MIN}~${KIDS_MAX}인 객실`, priceTh('01'), '빈자리'], shown.map(({ f, goods, t, price }) => { const ar = goods.map((g) => /([\d.]+)\s*㎡/.exec(g.area || '')).filter(Boolean).map((m) => Number(m[1])).filter((n) => n > 0); return `<tr><td>${forestCell(f)}</td><td>${goods.length}실<div class="fsub">${esc(range(goods.map((g) => g.cap), (n) => `${n}인`))}${ar.length ? ` · ${esc(range(ar, (n) => `${n}㎡`))}` : ''}</div></td><td>${priceCell(price)}</td><td>${t.days ? `<span class="num">${t.days}</span>일<div class="fsub">${esc(nearestTxt(t))}</div>` : '<span class="fsub">없음</span>'}</td></tr>`; }))}
${SOURCE(` 요금·빈자리는 정원 ${KIDS_MIN}~${KIDS_MAX}인 객실만 센 값입니다.`)}
`;
    pages.push({ kind: 'hub', slug: 'kids', name: `가족(${KIDS_MIN}~${KIDS_MAX}인) 숙소 비교`, urlPath, forests: shown.map((r) => r.f), freq: 'daily', pri: '0.7',
      title: `가족(${KIDS_MIN}~${KIDS_MAX}인) 숙소 비교: 자연휴양림 정원 ${KIDS_MIN}~${KIDS_MAX}인 객실 · 숲가자`,
      description: `정원 ${KIDS_MIN}~${KIDS_MAX}인 숙소 객실 수가 많은 자연휴양림 ${shown.length}곳의 객실 크기, 1박 요금 4값, 예약 빈자리를 비교합니다.`,
      guide, body, jsonld: [crumbLd('가족 숙소 비교', urlPath), listLd('가족 숙소 비교', urlPath, shown.map((r) => r.f))] });
  }

  // ---- 허브 3: 야영장 유형별 ----
  camping: {
    const lo = c.first, hi = status.days - 1;
    const groups = CAMP_GROUPS.map((gr) => {
      const rows = [];
      for (const f of status.forests) {
        const goods = f.goods.filter((g) => g.kind === '02' && campGroupOf(g) === gr);
        if (goods.length) rows.push({ f, goods, t: tally(goods, lo, hi), price: fourPrices(goods) });
      }
      rows.sort((a, b) => b.goods.length - a.goods.length || a.f.name.localeCompare(b.f.name, 'ko'));
      return { gr, rows, sites: rows.reduce((m, r) => m + r.goods.length, 0) };
    }).filter((g) => g.rows.length);
    if (!groups.length) break camping; // 야영장 데이터가 없으면 페이지를 만들지 않는다
    const allForests = [...new Set(groups.flatMap((g) => g.rows.map((r) => r.f)))];
    const guide = `야영장이 있는 휴양림은 ${allForests.length}곳이고, 객실 유형 이름으로 ${groups.length}가지로 나눴습니다: ${groups.map((g) => `${g.gr.name} ${g.rows.length}곳(${num(g.sites)}개)`).join(', ')}. 유형 구분은 숲나들e에 등록된 유형 이름의 낱말을 기준으로 한 것이라 같은 이름이라도 시설이 다를 수 있고, 유형 이름이 '카라반'인 것과 '카라반 사이트·캠핑카'인 것은 요금대가 크게 달라 나눠 적었습니다. 사이트 크기·바닥·부대시설은 수집 항목에 없어 비교하지 않았습니다.`;
    const urlPath = '/hub/camping/';
    const sections = groups.map(({ gr, rows, sites }) => {
      const shown = rows.slice(0, 15);
      const ps = rows.flatMap((r) => r.goods.map((g) => g.pr?.[1]).filter((p) => p > 0));
      return `<h2 id="${gr.slug}">${esc(gr.name)} <span class="fsub">${rows.length}곳 · ${num(sites)}개${ps.length ? ` · 비수기 주말 1박 ${esc(range(ps, won))}` : ''}</span></h2>
${table(['휴양림', '사이트 수', { t: '인원' }, priceTh('02'), '빈자리'], shown.map(({ f, goods, t, price }) => `<tr><td>${forestCell(f)}</td><td>${goods.length}${UNIT['02']}</td><td class="hide-sm">${esc(range(goods.map((g) => g.cap).filter((n) => n > 0), (n) => `${n}인`))}</td><td>${priceCell(price)}</td><td>${t.days ? `<span class="num">${t.days}</span>일<div class="fsub">${esc(nearestTxt(t))}</div>` : '<span class="fsub">없음</span>'}</td></tr>`))}
${rows.length > shown.length ? `<p class="fsub">외 ${rows.length - shown.length}곳은 <a href="/forest/">휴양림 전체 목록</a>에서 찾을 수 있습니다.</p>` : ''}`;
    }).join('\n');
    const body = `
<p class="crumb"><a href="/">홈</a> › <a href="/forest/">휴양림</a> › 야영장 유형별</p>
<h1>자연휴양림 야영장 유형별 비교</h1>
<p class="lead">카라반, 글램핑·캐빈, 오토캠핑장, 야영데크 등 숲나들e에 등록된 야영장 유형별로 어느 휴양림에 몇 개 있는지, 요금과 빈자리는 어떤지 모았습니다.</p>
<p class="stamp">마지막 갱신 ${esc(c.kstTime)} · 출처 숲나들e 객실 목록·요금·월별 예약현황</p>
<nav class="chips" aria-label="유형" style="margin-top:14px">${groups.map(({ gr }) => `<a href="#${gr.slug}">${esc(gr.name)}</a>`).join('')}</nav>
<h2>한눈에 보기</h2>
<p>${esc(guide)}</p>
${sections}
${SOURCE(' 빈자리는 해당 유형 사이트 중 예약가능(A)이 하나라도 있는 체크인 날짜 수입니다.')}
`;
    pages.push({ kind: 'hub', slug: 'camping', name: '야영장 유형별', urlPath, forests: allForests, freq: 'daily', pri: '0.7',
      title: '자연휴양림 야영장 유형별 비교: 카라반·글램핑·오토캠핑·야영데크 · 숲가자',
      description: `야영장이 있는 자연휴양림 ${allForests.length}곳을 카라반·글램핑·오토캠핑장·야영데크 등 유형별로 나눠 사이트 수, 1박 요금 4값, 예약 빈자리를 비교합니다.`,
      guide, body, jsonld: [crumbLd('자연휴양림 야영장 유형별', urlPath), listLd('자연휴양림 야영장 유형별', urlPath, allForests)] });
  }

  // ---- 연결: 칩 내비게이션과 휴양림별 관련 링크 ----
  const chipNav = (currentPath, label = '시즌·테마 모음') => `<p class="fsub" style="margin:14px 0 0">${label}</p><nav class="chips" aria-label="${label}" style="margin-top:4px">${pages.map((p) => `<a href="${p.urlPath}"${p.urlPath === currentPath ? ' aria-current="page"' : ''}>${esc(p.name)}</a>`).join('')}</nav>`;
  for (const p of pages) p.body = p.body.replace(/(<p class="stamp">[^\n]*<\/p>)/, `$1\n${chipNav(p.urlPath)}`);
  // 노출이 막 끝난 시즌: 이미 색인·공유된 주소가 404 가 되지 않도록 종료 안내 페이지를 남긴다(noindex, sitemap·내비·llms 제외)
  const expired = [];
  for (const sn of SEASONS) {
    if (pages.some((p) => p.slug === sn.slug) || !recentlyEnded(sn, c.todayISO)) continue;
    const urlPath = `/season/${sn.slug}/`;
    const live = pages.filter((p) => p.kind === 'season');
    expired.push({ slug: sn.slug, urlPath, name: `${sn.name} 모음(종료)`,
      title: `${sn.name} 자연휴양림 모음은 종료되었습니다 · 숲가자`,
      description: `${sn.name} 체크인 날짜 모음은 노출 기간이 끝나 내렸습니다. 지금 볼 수 있는 모음과 전체 빈자리 목록으로 안내합니다.`,
      body: `
<p class="crumb"><a href="/">홈</a> › <a href="/forest/">휴양림</a> › ${esc(sn.name)} 모음</p>
<h1>${esc(sn.name)} 모음은 종료되었습니다</h1>
<p class="lead">${esc(sn.name)} 체크인(${esc(sn.scope)}) 모음은 노출 기간이 끝나 더 이상 갱신하지 않습니다.</p>
${live.length ? `<p>지금 볼 수 있는 모음: ${live.map((p) => `<a href="${p.urlPath}">${esc(p.name)}</a>`).join(' · ')}</p>` : ''}
<p><a href="/forest/">전국 휴양림 빈자리 전체 목록</a> 또는 <a href="/">숲가자 홈</a>에서 날짜·지역 조건으로 찾을 수 있습니다.</p>
<p class="fsub">이 사이트는 숲나들e와 무관한 비공식 안내입니다. 예약과 결제는 <a href="https://www.foresttrip.go.kr" target="_blank" rel="noopener">숲나들e</a>에서 하세요.</p>
`, jsonld: [] });
  }
  const memberOf = new Map(); // 휴양림 id → 이 휴양림이 실린 페이지
  for (const p of pages) for (const f of p.forests) { if (!memberOf.has(f.id)) memberOf.set(f.id, []); memberOf.get(f.id).push(p); }
  const relatedHtml = (f) => {
    const mine = (memberOf.get(f.id) || []).filter((p) => p.kind === 'hub' || p.kind === 'season');
    if (!mine.length) return '';
    return `<h2>이 휴양림이 실린 모음</h2><ul class="flist">${mine.map((p) => `<li><a href="${p.urlPath}">${esc(p.name)}</a></li>`).join('')}</ul>`;
  };
  return { pages, expired, chipNav, relatedHtml };
}
