// /data/ai/weekend.json 본문 생성(이슈 #44, AI 검색 최적화). 수집 데이터가 바뀔 때마다 build-static.mjs 가 같이 만든다(AI 불필요, 비용 0).
// 입력은 build-static 이 이미 집계한 값이라 이 함수는 계산 없이 모양만 정한다. 숫자는 예약가능(A) 객실 수 그대로다.
const TOP = 30; // 주말별 빈자리 많은 휴양림 상위
const DATES = 6; // 휴양림마다 날짜 상한

/**
 * @param {object} o
 * @param {string} o.site
 * @param {string} o.generatedAt  수집 시각(KST ISO)
 * @param {Record<'this'|'next', {from: string, to: string, name: string, regions: {slug: string, name: string, forests: number}[], list: {f: {id: string, name: string, type: string, sidoName: string, sigungu: string}, n: number, byDate: {iso: string, wd: string, a: number, b: number}[]}[]}>} o.weekends
 *   regions[0] 은 전국(slug all)이어야 한다. list 는 전국 기준 빈자리 많은 순.
 */
export function buildWeekendJson(o) {
  const S = o.site;
  const one = (key, slugPath) => {
    const w = o.weekends[key];
    const all = w.regions.find((r) => r.slug === 'all');
    return {
      label: w.name,
      checkinFrom: w.from,
      checkinTo: w.to,
      forestsWithVacancy: all.forests,
      roomsAvailable: w.list.reduce((m, x) => m + x.n, 0),
      page: `${S}/vacancy/all/${slugPath}/`,
      regions: w.regions.filter((r) => r.slug !== 'all').map((r) => ({
        slug: r.slug, name: r.name, forestsWithVacancy: r.forests, page: `${S}/vacancy/${r.slug}/${slugPath}/`,
      })),
      top: w.list.slice(0, TOP).map(({ f, n, byDate }) => ({
        id: f.id, name: f.name, type: f.type, region: f.sidoName, sigungu: f.sigungu, rooms: n,
        url: `${S}/forest/${encodeURIComponent(f.id)}`,
        dates: byDate.slice(0, DATES).map((d) => ({ date: d.iso, weekday: d.wd, lodging: d.a, camping: d.b })),
      })),
    };
  };
  return {
    site: 'supgaja.com',
    generatedAt: o.generatedAt,
    source: '숲나들e 월별 예약현황(1박 체크인 기준). 수집 시점의 상태이며 예약 전 숲나들e 에서 다시 확인해야 한다',
    notes: '주말 = 금·토·연휴 전날 체크인. lodging 숙소·camping 야영장 예약가능 객실 수. top 은 빈자리 많은 휴양림 상위 30곳',
    thisWeekend: one('this', 'this-weekend'),
    nextWeekend: one('next', 'next-weekend'),
  };
}
