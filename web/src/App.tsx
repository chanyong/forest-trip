import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  compute, defaultFilters, firstDataIdx, filtersFromURL, filtersToURL, isoOf,
  type Change, type Filters, type Meta, type Status, type View,
} from './lib/data';
import { FilterBar } from './components/FilterBar';
import { Summary } from './components/Summary';
import { TableView } from './components/TableView';
import { CalendarView } from './components/CalendarView';
import { GridView } from './components/GridView';

// 지도 라이브러리(maplibre)는 필요할 때만 불러온다
const MapView = lazy(() => import('./components/MapView').then((m) => ({ default: m.MapView })));
const ForestDrawer = lazy(() => import('./components/ForestDrawer').then((m) => ({ default: m.ForestDrawer })));

const VIEWS: { id: View; label: string }[] = [
  { id: 'table', label: '목록' },
  { id: 'map', label: '지도' },
  { id: 'calendar', label: '달력' },
  { id: 'grid', label: '월간 그리드' },
];

export default function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [changes, setChanges] = useState<Change[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<Filters | null>(null);
  const [base, setBase] = useState<Filters | null>(null);
  const [forestId, setForestId] = useState<string | null>(() => new URLSearchParams(location.search).get('forest'));
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [theme, setTheme] = useState<string>(() => {
    try { return localStorage.getItem('theme') || ''; } catch { return ''; }
  });

  useEffect(() => {
    Promise.all([
      fetch('/data/status.json').then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }),
      fetch('/data/changes.json').then((r) => (r.ok ? r.json() : { items: [] })).catch(() => ({ items: [] })),
      fetch('/data/meta.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([s, c, m]: [Status, { items: Change[] }, Meta | null]) => {
      setStatus(s);
      setChanges(c.items || []);
      setMeta(m);
      const b = defaultFilters(isoOf(s.start), s.days, firstDataIdx(s));
      setBase(b);
      setFilters(filtersFromURL(b));
    }).catch((e) => setError(`데이터를 불러오지 못했습니다 (${e.message})`));
  }, []);

  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    try { theme ? localStorage.setItem('theme', theme) : localStorage.removeItem('theme'); } catch { /* 저장 불가 환경 */ }
  }, [theme]);

  useEffect(() => { if (filters && base) filtersToURL(filters, base); }, [filters, base]);

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if (forestId) p.set('forest', forestId); else p.delete('forest');
    const qs = p.toString();
    history.replaceState(null, '', `${location.pathname}${qs ? '?' + qs : ''}`);
  }, [forestId]);

  const results = useMemo(
    () => (status && filters ? compute(status, filters, origin) : []),
    [status, filters, origin],
  );

  const set = (patch: Partial<Filters>) => setFilters((f) => (f ? { ...f, ...patch } : f));

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => { setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude }); set({ sort: 'dist' }); },
      () => alert('위치 정보를 가져오지 못했습니다.'),
      { timeout: 8000 },
    );
  };

  const toggleTheme = () => {
    const dark = theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(dark ? 'light' : 'dark');
  };

  const closeDrawer = useCallback(() => setForestId(null), []);
  const forest = status && forestId ? status.forests.find((f) => f.id === forestId) : null;
  const withHits = results.filter((r) => r.total > 0);

  return (
    <>
      <header className="top">
        <div className="wrap">
          <a className="brand" href="/">
            <span className="brand-mark" aria-hidden>
              <svg viewBox="0 0 32 32"><path d="M16 3l-8 11h4.5l-6 8H13v6h6v-6h6.5l-6-8H24z" fill="#e8f3ea" /></svg>
            </span>
            <span>
              <h1 className="brand-name">숲빈자리<small className="hide-sm"> · 전국 자연휴양림 빈자리 찾기</small></h1>
            </span>
          </a>
          <span className="spacer" />
          {status && (
            <span className="stamp" title={status.generatedAt}>
              <span aria-hidden>🕒</span> 수집 {new Date(status.generatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button className="icon-btn" onClick={toggleTheme} aria-label="라이트/다크 모드 전환"><span aria-hidden>◐</span></button>
        </div>
      </header>

      <main className="wrap">
        {error && <div className="loading">{error}</div>}
        {!status && !error && <div className="loading">전국 휴양림 데이터를 불러오는 중…</div>}
        {status && filters && base && (
          <>
            <Summary status={status} changes={changes} meta={meta} onOpen={setForestId} />
            <FilterBar
              filters={filters}
              base={base}
              set={set}
              reset={() => setFilters({ ...base, view: filters.view })}
              locate={locate}
              hasOrigin={!!origin}
            />
            <div className="tabs" role="tablist">
              {VIEWS.map((v) => (
                <button key={v.id} role="tab" id={`tab-${v.id}`} aria-selected={filters.view === v.id} onClick={() => set({ view: v.id })}>
                  {v.label}
                </button>
              ))}
              <span className="count">
                조건에 맞는 휴양림 <b>{withHits.length}</b>곳 · 객실·날짜 <b>{withHits.reduce((n, r) => n + r.total, 0).toLocaleString()}</b>건
              </span>
            </div>
            <p className="mobile-count" aria-live="polite">
              조건에 맞는 휴양림 <b>{withHits.length}</b>곳 · 객실·날짜 <b>{withHits.reduce((n, r) => n + r.total, 0).toLocaleString()}</b>건
            </p>
            {filters.view === 'table' && <TableView results={results} status={status} filters={filters} set={set} onOpen={setForestId} />}
            {filters.view === 'map' && (
              <Suspense fallback={<div className="panel loading">지도를 불러오는 중…</div>}>
                <MapView results={results} status={status} filters={filters} origin={origin} onOpen={setForestId} locate={locate} />
              </Suspense>
            )}
            {filters.view === 'calendar' && <CalendarView results={results} status={status} filters={filters} onOpen={setForestId} />}
            {filters.view === 'grid' && <GridView results={results} status={status} filters={filters} onOpen={setForestId} />}
          </>
        )}
        <footer>
          <p>
            숲빈자리는 숲나들e(foresttrip.go.kr)에 공개된 월별 예약현황을 주기적으로 모아 보여 주는 <b>비공식 참고용</b> 서비스입니다.
            국립자연휴양림관리소 및 각 지자체와 제휴하지 않았습니다.
          </p>
          <p>
            실제 예약 가능 여부는 수집 시점 이후 바뀌었을 수 있습니다. 예약·결제·취소는 반드시{' '}
            <a href="https://www.foresttrip.go.kr" target="_blank" rel="noreferrer">숲나들e</a>에서 진행하세요.
            공휴일은 주말 판단에만 쓰이며 연 1회 갱신합니다.
          </p>
        </footer>
      </main>

      {forest && status && filters && (
        <Suspense fallback={null}>
          <ForestDrawer forest={forest} status={status} filters={filters} onClose={closeDrawer} />
        </Suspense>
      )}
    </>
  );
}
