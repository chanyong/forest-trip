// 빈자리 이메일 알림: 운영자 사이트 공통 알림 모듈(https://ddalkkakrank.kr/alerts.js, 버튼을 처음 누를 때 불러옴)을 연다.
// 중앙 서버는 https://supgaja.com/alerts-feed.json(빌드 때 scripts/build-static.mjs 가 생성)을 주기적으로 읽어
// 아래 filters(모두 만족)에 맞는 항목이 새로 생기면 메일을 보낸다. 피드 attrs: forest(이름에서 '자연휴양림' 뺀 것),
// forestId, region(서울/인천/경기 등 sidoName), date(YYYY-MM-DD 체크인), type(숙소|야영장), weekday, weekend, people(최대 정원), rooms.
import { fmtDate, kindName, SIDOS, type Filters, type Forest, type Status, forestPasses, defaultFilters } from './data';

export interface AlertFilter { key: string; op: 'eq' | 'in' | 'lte' | 'gte' | 'between'; value: unknown }
export interface AlertRequest { site: 'supgaja.com'; label: string; filters: AlertFilter[] }

type SiteAlertsApi = { open: (o: AlertRequest) => void };

export const ALERTS_SRC = 'https://ddalkkakrank.kr/alerts.js';
const api = () => (window as unknown as { SiteAlerts?: SiteAlertsApi }).SiteAlerts;

// 알림 모듈은 버튼을 처음 누를 때 한 번만 불러온다(첫 화면을 가볍게, 모듈이 아직 없을 때 콘솔 오류도 피함)
let loading: Promise<boolean> | null = null;
function loadAlerts(): Promise<boolean> {
  if (api()?.open) return Promise.resolve(true);
  if (!loading) {
    loading = new Promise<boolean>((resolve) => {
      const s = document.createElement('script');
      s.src = ALERTS_SRC;
      s.async = true;
      const t = setTimeout(() => resolve(false), 8000);
      s.onload = () => { clearTimeout(t); resolve(!!api()?.open); };
      s.onerror = () => { clearTimeout(t); resolve(false); };
      document.head.appendChild(s);
    }).then((ok) => { if (!ok) loading = null; return ok; }); // 실패하면 다음 클릭 때 다시 시도
  }
  return loading;
}

// alerts.js 가 아직 없거나 못 불러와도 오류 없이 false 를 돌려준다(호출 쪽에서 '곧 제공' 안내)
export async function openAlerts(req: AlertRequest): Promise<boolean> {
  try {
    if (!(await loadAlerts())) return false;
    api()!.open(req);
    return true;
  } catch { /* 모듈 오류는 무시하고 안내로 대체 */ }
  return false;
}

const MAX_FORESTS = 40;

// 지금 화면 조건(필터·즐겨찾기·열린 휴양림)을 알림 조건으로 바꾼다. 범위가 너무 넓으면 error 를 돌려준다.
export function alertFromFilters(status: Status, f: Filters, favs: Set<string>, forest?: Forest | null): AlertRequest | { error: string } {
  const filters: AlertFilter[] = [];
  const label: string[] = [];
  let ids: string[] | null = null;
  if (forest) ids = [forest.id];
  else {
    const narrowed = f.q || f.mine || f.types.length;
    if (narrowed) {
      const base = { ...defaultFilters('2000-01-01', 1), q: f.q, types: f.types, sidos: f.sidos };
      ids = status.forests.filter((fo) => forestPasses(fo, base) && (!f.mine || favs.has(fo.id))).map((fo) => fo.id);
      if (!ids.length) return { error: '조건에 맞는 휴양림이 없습니다. 검색어나 내 휴양림을 확인해 주세요.' };
      if (ids.length > MAX_FORESTS) ids = null; // 너무 많으면 지역 조건만 쓴다
    }
  }
  if (ids) {
    filters.push(ids.length === 1 ? { key: 'forestId', op: 'eq', value: ids[0] } : { key: 'forestId', op: 'in', value: ids });
    const names = ids.map((id) => status.forests.find((x) => x.id === id)?.name || id);
    label.push(names.length <= 2 ? names.join(', ') : `${names[0]} 외 ${names.length - 1}곳${f.mine ? '(내 휴양림)' : ''}`);
  } else if (f.sidos.length) {
    const regions = SIDOS.filter((s) => f.sidos.includes(s.code)).map((s) => s.name);
    filters.push(regions.length === 1 ? { key: 'region', op: 'eq', value: regions[0] } : { key: 'region', op: 'in', value: regions });
    label.push(`${regions.join('·')} 휴양림`);
  } else {
    label.push('전국 휴양림');
  }
  filters.push({ key: 'date', op: 'between', value: [f.from, f.to] });
  label.push(f.from === f.to ? fmtDate(f.from) : `${fmtDate(f.from)}~${fmtDate(f.to)}`);
  if (f.weekend) { filters.push({ key: 'weekend', op: 'eq', value: true }); label.push('주말·연휴'); }
  if (f.kinds.length === 1) { filters.push({ key: 'type', op: 'eq', value: kindName(f.kinds[0]) }); label.push(kindName(f.kinds[0])); }
  if (f.people) { filters.push({ key: 'people', op: 'gte', value: f.people }); label.push(`${f.people}인 이상`); }
  // 전국 + 긴 기간은 알림이 너무 많아진다
  const days = (Date.parse(f.to) - Date.parse(f.from)) / 864e5 + 1;
  if (!ids && !f.sidos.length && days > 14 && !f.weekend) {
    return { error: '알림 범위가 너무 넓어요. 지역이나 휴양림을 고르거나, 기간을 2주 이내(또는 주말만)로 좁혀 주세요.' };
  }
  return { site: 'supgaja.com', label: label.join(' · '), filters };
}
