// 수집 데이터 타입, 날짜 유틸, 필터 계산
export type Kind = '01' | '02'; // 01 숙소, 02 야영장

export interface Goods {
  id: string;
  kind: Kind;
  cls: string;
  name: string;
  cap: number;
  area: string;
  flags: string; // a 에어컨, d 반려견, e 전기, w 온수, h 장애인, v 바우처
  maxNights: number | null;
  s: string; // 날짜당 1글자: A 가능, 1~9 대기, F 완료, C 휴무, R 공사, . 정보 없음
}

export interface Forest {
  id: string;
  name: string;
  type: '국립' | '공립' | '사립' | string;
  sido: string;
  sidoName: string;
  sigungu: string;
  lat: number | null;
  lng: number | null;
  addr?: string | null;
  tel?: string | null;
  url?: string | null;
  checkin?: string | null;
  checkout?: string | null;
  goods: Goods[];
}

export interface Status {
  generatedAt: string;
  start: string; // YYYYMMDD
  days: number;
  forests: Forest[];
}

export interface Change {
  at: string;
  forest: string;
  goods: string;
  date: string;
  from: string;
}

export interface Meta {
  generatedAt: string;
  durationSec: number;
  ok: number;
  fail: number;
  totals: { forests: number; goods: number; available: number };
}

export const SIDOS: { code: string; name: string }[] = [
  { code: '1', name: '서울/인천/경기' },
  { code: '2', name: '강원' },
  { code: '3', name: '충북' },
  { code: '4', name: '대전/충남' },
  { code: '5', name: '전북' },
  { code: '6', name: '전남/광주' },
  { code: '7', name: '대구/경북' },
  { code: '8', name: '부산/경남' },
  { code: '9', name: '제주' },
];

export const FLAG_LABELS: Record<string, string> = {
  a: '에어컨', d: '반려견', e: '전기', w: '온수', h: '장애인시설', v: '바우처',
};

// ---- 날짜 ----
// 모든 날짜는 KST 기준 'YYYY-MM-DD' 문자열로 다룬다.
export const isoOf = (ymd: string) => `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
const toUTC = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
export const addDaysISO = (iso: string, n: number) => new Date(toUTC(iso) + n * 864e5).toISOString().slice(0, 10);
export const diffISO = (a: string, b: string) => Math.round((toUTC(b) - toUTC(a)) / 864e5);
export const dow = (iso: string) => new Date(toUTC(iso)).getUTCDay();
export const DOW = ['일', '월', '화', '수', '목', '금', '토'];
export const todayKST = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

// 공휴일(대체공휴일 포함). 매년 갱신 필요.
const HOLIDAYS: Record<string, string> = {
  '2026-01-01': '신정', '2026-02-16': '설날', '2026-02-17': '설날', '2026-02-18': '설날',
  '2026-03-01': '삼일절', '2026-03-02': '대체공휴일', '2026-05-05': '어린이날', '2026-05-24': '부처님오신날',
  '2026-05-25': '대체공휴일', '2026-06-03': '지방선거', '2026-06-06': '현충일', '2026-08-15': '광복절',
  '2026-08-17': '대체공휴일', '2026-09-24': '추석', '2026-09-25': '추석', '2026-09-26': '추석',
  '2026-10-03': '개천절', '2026-10-05': '대체공휴일', '2026-10-09': '한글날', '2026-12-25': '성탄절',
  '2027-01-01': '신정', '2027-02-06': '설날', '2027-02-07': '설날', '2027-02-08': '설날', '2027-02-09': '대체공휴일',
  '2027-03-01': '삼일절', '2027-05-05': '어린이날', '2027-05-13': '부처님오신날', '2027-06-06': '현충일',
  '2027-08-15': '광복절', '2027-08-16': '대체공휴일', '2027-09-14': '추석', '2027-09-15': '추석',
  '2027-09-16': '추석', '2027-10-03': '개천절', '2027-10-04': '대체공휴일', '2027-10-09': '한글날',
  '2027-10-11': '대체공휴일', '2027-12-25': '성탄절', '2027-12-27': '대체공휴일',
};
export const holidayName = (iso: string) => HOLIDAYS[iso];
export const isRestDay = (iso: string) => dow(iso) === 0 || dow(iso) === 6 || !!HOLIDAYS[iso];
// 체크인 다음 날이 쉬는 날이면 '주말 숙박'
export const isWeekendStay = (iso: string) => isRestDay(addDaysISO(iso, 1));

export const fmtDate = (iso: string, withDow = true) =>
  `${+iso.slice(5, 7)}.${+iso.slice(8, 10)}${withDow ? `(${DOW[dow(iso)]})` : ''}`;

// ---- 필터 ----
export type View = 'table' | 'map' | 'calendar' | 'grid';

export interface Filters {
  view: View;
  from: string;
  to: string;
  nights: number;
  sidos: string[];
  types: string[];
  kinds: Kind[];
  people: number;
  flags: string[];
  weekend: boolean;
  wait: boolean;
  q: string;
  sort: 'date' | 'count' | 'name' | 'dist';
}

// 오늘처럼 모든 객실이 '정보 없음'인 앞쪽 날짜는 건너뛴다
export function firstDataIdx(status: Status) {
  for (let i = 0; i < status.days; i++) {
    for (const f of status.forests) for (const g of f.goods) if (g.s[i] && g.s[i] !== '.') return i;
  }
  return 0;
}

export const defaultFilters = (start: string, days: number, skip = 0): Filters => ({
  view: 'table',
  from: addDaysISO(start, skip),
  to: addDaysISO(start, Math.max(0, days - 1)),
  nights: 1,
  sidos: [],
  types: [],
  kinds: [],
  people: 0,
  flags: [],
  weekend: false,
  wait: false,
  q: '',
  sort: 'date',
});

const LIST_KEYS = ['sidos', 'types', 'kinds', 'flags'] as const;

export function filtersFromURL(base: Filters): Filters {
  const p = new URLSearchParams(location.search);
  const f: Filters = { ...base };
  if (p.get('view')) f.view = p.get('view') as View;
  if (p.get('from')) f.from = p.get('from')!;
  if (p.get('to')) f.to = p.get('to')!;
  if (p.get('nights')) f.nights = Math.min(3, Math.max(1, +p.get('nights')!));
  for (const k of LIST_KEYS) if (p.get(k)) (f as any)[k] = p.get(k)!.split(',').filter(Boolean);
  if (p.get('people')) f.people = +p.get('people')!;
  f.weekend = p.get('weekend') === '1';
  f.wait = p.get('wait') === '1';
  if (p.get('q')) f.q = p.get('q')!;
  if (p.get('sort')) f.sort = p.get('sort') as Filters['sort'];
  return f;
}

export function filtersToURL(f: Filters, base: Filters) {
  const p = new URLSearchParams();
  if (f.view !== 'table') p.set('view', f.view);
  if (f.from !== base.from) p.set('from', f.from);
  if (f.to !== base.to) p.set('to', f.to);
  if (f.nights !== 1) p.set('nights', String(f.nights));
  for (const k of LIST_KEYS) if (f[k].length) p.set(k, f[k].join(','));
  if (f.people) p.set('people', String(f.people));
  if (f.weekend) p.set('weekend', '1');
  if (f.wait) p.set('wait', '1');
  if (f.q) p.set('q', f.q);
  if (f.sort !== 'date') p.set('sort', f.sort);
  const qs = p.toString();
  const forest = new URLSearchParams(location.search).get('forest');
  const extra = forest ? `${qs ? '&' : ''}forest=${forest}` : '';
  history.replaceState(null, '', `${location.pathname}${qs || extra ? '?' : ''}${qs}${extra}`);
}

export const isOpen = (c: string | undefined, wait: boolean) => c === 'A' || (wait && !!c && c >= '1' && c <= '9');

export interface GoodsResult {
  goods: Goods;
  hits: number[]; // 조건을 만족하는 체크인 날짜 인덱스
}

export interface ForestResult {
  forest: Forest;
  goods: GoodsResult[];
  hitDates: Map<number, number>; // 날짜 인덱스 -> 가능 객실 수
  total: number;
  first: number;
  dist?: number;
}

export function goodsPasses(g: Goods, f: Filters) {
  if (f.kinds.length && !f.kinds.includes(g.kind)) return false;
  if (f.people && g.cap < f.people) return false;
  for (const fl of f.flags) if (!g.flags.includes(fl)) return false;
  return true;
}

export function forestPasses(fo: Forest, f: Filters) {
  if (f.sidos.length && !f.sidos.includes(fo.sido)) return false;
  if (f.types.length && !f.types.includes(fo.type)) return false;
  if (f.q) {
    const q = f.q.replace(/\s/g, '');
    if (!(fo.name + fo.sigungu + fo.sidoName).replace(/\s/g, '').includes(q)) return false;
  }
  return true;
}

export function compute(status: Status, f: Filters, origin?: { lat: number; lng: number } | null): ForestResult[] {
  const start = isoOf(status.start);
  const lo = Math.max(0, diffISO(start, f.from));
  const hi = Math.min(status.days - 1, diffISO(start, f.to));
  const restIdx: boolean[] = [];
  for (let i = 0; i < status.days; i++) restIdx[i] = isWeekendStay(addDaysISO(start, i));

  const out: ForestResult[] = [];
  for (const fo of status.forests) {
    if (!forestPasses(fo, f)) continue;
    const goods: GoodsResult[] = [];
    const hitDates = new Map<number, number>();
    let total = 0;
    let first = Infinity;
    for (const g of fo.goods) {
      if (!goodsPasses(g, f)) continue;
      const hits: number[] = [];
      for (let i = lo; i <= hi; i++) {
        if (f.weekend && !restIdx[i]) continue;
        let ok = true;
        for (let k = 0; k < f.nights; k++) if (!isOpen(g.s[i + k], f.wait)) { ok = false; break; }
        if (ok) {
          hits.push(i);
          hitDates.set(i, (hitDates.get(i) || 0) + 1);
        }
      }
      if (hits.length) {
        goods.push({ goods: g, hits });
        total += hits.length;
        if (hits[0] < first) first = hits[0];
      }
    }
    const r: ForestResult = { forest: fo, goods, hitDates, total, first };
    if (origin && fo.lat != null && fo.lng != null) r.dist = haversine(origin, { lat: fo.lat, lng: fo.lng! });
    out.push(r);
  }
  const by = {
    date: (a: ForestResult, b: ForestResult) => a.first - b.first || b.total - a.total,
    count: (a: ForestResult, b: ForestResult) => b.total - a.total,
    name: (a: ForestResult, b: ForestResult) => a.forest.name.localeCompare(b.forest.name, 'ko'),
    dist: (a: ForestResult, b: ForestResult) => (a.dist ?? 1e9) - (b.dist ?? 1e9),
  }[f.sort];
  return out.sort((a, b) => (b.total ? 1 : 0) - (a.total ? 1 : 0) || by(a, b));
}

export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const statusLabel = (c: string) =>
  c === 'A' ? '예약가능' : c >= '1' && c <= '9' ? `대기${c}` : c === 'F' ? '완료' : c === 'C' ? '휴무' : c === 'R' ? '공사·점검' : '-';
export const statusShort = (c: string) =>
  c === 'A' ? '예' : c >= '1' && c <= '9' ? `대${c}` : c === 'F' ? '완' : c === 'C' ? '휴' : c === 'R' ? '공' : '';

export const RESERVE_URL = 'https://www.foresttrip.go.kr/rep/or/sssn/monthRsrvtStatus.do?hmpgId=FRIP&menuId=001004';
export const kindName = (k: string) => (k === '01' ? '숙소' : '야영장');

export const cellClass = (c: string) =>
  c === 'A' ? 's-A' : c >= '1' && c <= '9' ? 's-W' : c === 'F' ? 's-F' : c === 'C' ? 's-C' : c === 'R' ? 's-R' : 's-0';
