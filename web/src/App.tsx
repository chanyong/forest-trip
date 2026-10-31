import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  compute, defaultFilters, firstDataIdx, filtersFromURL, filtersToURL, freshIndex, isoOf,
  type Change, type Filters, type Forest, type Meta, type Status, type View,
} from './lib/data';
import { alertFromFilters, openAlerts } from './lib/alerts';
import { useFavs } from './lib/favs';
import { FilterBar } from './components/FilterBar';
import { Summary } from './components/Summary';
import { TableView } from './components/TableView';
import { CalendarView } from './components/CalendarView';
import { GridView } from './components/GridView';
import network from './lib/network.json';

// 지도 라이브러리(maplibre)는 필요할 때만 불러온다
const MapView = lazy(() => import('./components/MapView').then((m) => ({ default: m.MapView })));
const ForestDrawer = lazy(() => import('./components/ForestDrawer').then((m) => ({ default: m.ForestDrawer })));

// index.html에서 미리 시작한 요청을 처음 한 번만 쓰고, 다시 시도할 때는 새로 요청한다
const takeStatusReq = (): Promise<Response> => {
  const w = window as unknown as { __statusReq?: Promise<Response> };
  const req = w.__statusReq;
  w.__statusReq = undefined;
  return req ? req.catch(() => fetch('/data/status.json')) : fetch('/data/status.json');
};

// 네트워크가 멈춰도 로딩 화면에 갇히지 않도록 일정 시간이 지나면 실패로 처리한다
const LOAD_TIMEOUT_MS = 30000;
const withTimeout = <T,>(p: Promise<T>) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('응답 시간 초과')), LOAD_TIMEOUT_MS))]);

// 수집 주기는 약 3시간. 6시간 넘게 묵으면 수집이 밀린 것으로 보고 알린다
const STALE_MIN = 360;
const ago = (min: number) => (min < 1 ? '방금 전' : min < 60 ? `${min}분 전` : min < 1440 ? `${Math.floor(min / 60)}시간 전` : `${Math.floor(min / 1440)}일 전`);

// 탭 아이콘 (24px 선 아이콘, 색은 CSS의 탭 색을 따른다)
const ICONS: Record<View, ReactNode> = {
  table: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1.2" /><circle cx="4.5" cy="12" r="1.2" /><circle cx="4.5" cy="18" r="1.2" /></>,
  map: <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /><path d="M8 14.5h2M14 14.5h2" /></>,
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
};

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

  const load = useCallback(() => {
    setError('');
    Promise.all([
      withTimeout(takeStatusReq().then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })),
      fetch('/data/changes.json').then((r) => (r.ok ? r.json() : { items: [] })).catch(() => ({ items: [] })),
      fetch('/data/meta.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([s, c, m]: [Status, { items: Change[] }, Meta | null]) => {
      setStatus(s);
      setChanges(c.items || []);
      setMeta(m);
      const b = defaultFilters(isoOf(s.start), s.days, firstDataIdx(s));
      setBase(b);
      setFilters((f) => f ?? filtersFromURL(b));
    }).catch((e) => setError(`데이터를 불러오지 못했습니다 (${e.message})`));
  }, []);
  useEffect(load, [load]);

  // '몇 분 전' 표시를 1분마다 갱신
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    try { theme ? localStorage.setItem('theme', theme) : localStorage.removeItem('theme'); } catch { /* 저장 불가 환경 */ }
  }, [theme]);

  useEffect(() => { if (filters && base) filtersToURL(filters, base); }, [filters, base]);

  const opener = useRef<HTMLElement | null>(null);
  const pushed = useRef(false);
  const urlWithForest = (id: string | null) => {
    const p = new URLSearchParams(location.search);
    if (id) p.set('forest', id); else p.delete('forest');
    const qs = p.toString();
    return `${location.pathname}${qs ? '?' + qs : ''}`;
  };
  const openForest = useCallback((id: string) => {
    opener.current = document.activeElement as HTMLElement | null;
    setForestId(id);
    history.pushState({ forest: id }, '', urlWithForest(id));
    pushed.current = true;
  }, []);
  useEffect(() => {
    const onPop = () => {
      const id = new URLSearchParams(location.search).get('forest');
      setForestId(id);
      if (!id) { pushed.current = false; requestAnimationFrame(() => opener.current?.focus?.()); }
    };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  const { favs, toggle: toggleFav } = useFavs();
  const fresh = useMemo(() => (status ? freshIndex(status, changes) : null), [status, changes]);
  const results = useMemo(
    () => (status && filters ? compute(status, filters, origin, { favs, fresh: fresh?.fresh, latestAt: fresh?.latestAt }) : []),
    [status, filters, origin, favs, fresh],
  );

  // 빈자리 이메일 알림: 지금 조건으로 공통 알림 창을 연다. 알림 모듈이 아직 없으면 안내만 보여 준다
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  const askAlert = useCallback((fo?: Forest | null) => {
    if (!status || !filters) return;
    const req = alertFromFilters(status, filters, favs, fo);
    if ('error' in req) { setNotice(req.error); return; }
    openAlerts(req).then((ok) => { if (!ok) setNotice('빈자리 이메일 알림은 곧 제공됩니다. 준비되면 이 버튼으로 바로 신청할 수 있어요.'); });
  }, [status, filters, favs]);

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

  const closeDrawer = useCallback(() => {
    if (pushed.current) { history.back(); return; } // popstate에서 닫힘
    setForestId(null);
    history.replaceState(null, '', urlWithForest(null));
    requestAnimationFrame(() => opener.current?.focus?.());
  }, []);
  const forest = status && forestId ? status.forests.find((f) => f.id === forestId) : null;
  const withHits = results.filter((r) => r.total > 0);

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!filters) return;
    const i = VIEWS.findIndex((v) => v.id === filters.view);
    const n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: VIEWS.length - 1 }[e.key];
    if (n == null) return;
    e.preventDefault();
    const next = VIEWS[(n + VIEWS.length) % VIEWS.length].id;
    set({ view: next });
    requestAnimationFrame(() => document.getElementById(`tab-${next}`)?.focus());
  };

  return (
    <>
      <a className="skip" href="#main">본문 바로가기</a>
      <header className="top">
        <div className="wrap">
          <a className="brand" href="/">
            <span className="brand-mark" aria-hidden>
              <svg viewBox="0 0 32 32"><path d="M16 3l-8 11h4.5l-6 8H13v6h6v-6h6.5l-6-8H24z" fill="#e8f3ea" /></svg>
            </span>
            <span>
              <h1 className="brand-name">숲가자<small className="hide-sm"> · 전국 자연휴양림 예약 빈자리 찾기</small></h1>
            </span>
          </a>
          <span className="spacer" />
          {status && (() => {
            const age = Math.max(0, Math.round((now - Date.parse(status.generatedAt)) / 60000));
            const stale = age > STALE_MIN;
            return (
              <span className={`stamp${stale ? ' stale' : ''}`}
                title={`숲나들e 예약현황을 약 3시간마다 모읍니다. 그 사이 예약이 바뀌었을 수 있으니 예약 전에 숲나들e에서 다시 확인하세요.${stale ? ' 최근 수집이 지연되고 있습니다.' : ''}`}>
                <span aria-hidden>{stale ? '⚠' : '🕒'}</span> 수집<span className="stamp-date"> {new Date(status.generatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} ·</span>
                <span className="stamp-ago"> {ago(age)}</span>
              </span>
            );
          })()}
          <a className="faq-link" href="/faq.html" title="자주 묻는 질문"><span aria-hidden>?</span><span className="faq-l">자주 묻는 질문</span><span className="faq-s">FAQ</span></a>
          <button className="icon-btn" onClick={toggleTheme} aria-label="라이트/다크 모드 전환"><span aria-hidden>◐</span></button>
        </div>
      </header>

      <main className="wrap" id="main" tabIndex={-1}>
        {error && (
          <div className="loading" role="alert">
            <p>{error}</p>
            <p className="fsub">네트워크 상태를 확인한 뒤 다시 시도해 주세요.</p>
            <button className="btn primary" onClick={load}>다시 시도</button>
          </div>
        )}
        {!status && !error && (
          <div className="skeleton" aria-busy="true" aria-label="전국 휴양림 데이터를 불러오는 중">
            <div className="sk-row">{[0, 1, 2, 3].map((i) => <div key={i} className="sk sk-stat" />)}</div>
            <div className="sk sk-bar" />
            <div className="sk sk-bar short" />
            <div className="sk sk-panel" />
            <p className="fsub" style={{ textAlign: 'center' }}>전국 휴양림 데이터를 불러오는 중…</p>
          </div>
        )}
        {status && filters && base && (
          <>
            <Summary status={status} changes={changes} meta={meta} onOpen={openForest} />
            <p className="basis">
              마지막 갱신 {new Date(status.generatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {' · '}출처 숲나들e 월별 예약현황 · 기준 1박 체크인 날짜, 약 3시간마다 갱신
            </p>
            <FilterBar
              favCount={favs.size}
              filters={filters}
              base={base}
              set={set}
              reset={() => setFilters({ ...base, view: filters.view })}
              locate={locate}
              hasOrigin={!!origin}
            />
            <div className="tabs" role="tablist" aria-label="보기 방식" onKeyDown={onTabKey}>
              {VIEWS.map((v) => (
                <button key={v.id} role="tab" id={`tab-${v.id}`} className={`v-${v.id}`} aria-selected={filters.view === v.id} aria-controls="view-panel"
                  tabIndex={filters.view === v.id ? 0 : -1} onClick={() => set({ view: v.id })}>
                  <span className="tab-ico" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONS[v.id]}</svg>
                  </span>
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
            <div className="alert-bar">
              <span>원하는 자리가 없나요? 지금 조건(지역·휴양림·날짜·시설)에 새 빈자리가 생기면 이메일로 알려 드려요.</span>
              <button className="alert-btn" onClick={() => askAlert()}><span aria-hidden>🔔</span> 빈자리 알림 받기</button>
            </div>
            {filters.mine && favs.size === 0 && (
              <p className="hint">아직 내 휴양림이 없습니다. 목록이나 상세 화면의 ☆를 눌러 자주 보는 휴양림을 추가하세요(이 브라우저에만 저장).</p>
            )}
            <div role="tabpanel" id="view-panel" aria-labelledby={`tab-${filters.view}`}>
            {withHits.length === 0 ? (
              <div className="panel empty">
                <p><b>조건에 맞는 빈자리가 없습니다.</b></p>
                <p className="fsub">기간을 넓히거나, 지역·상세 조건을 줄이거나, '대기 포함'을 켜 보세요.</p>
                <div className="empty-actions">
                  <button className="btn" onClick={() => askAlert()}><span aria-hidden>🔔</span> 빈자리 나면 알림 받기</button>
                  {!filters.wait && <button className="btn" onClick={() => set({ wait: true })}>대기 포함하기</button>}
                  <button className="btn primary" onClick={() => setFilters({ ...base, view: filters.view })}>조건 초기화</button>
                </div>
              </div>
            ) : <>
            {filters.view === 'table' && <TableView results={results} status={status} filters={filters} set={set} onOpen={openForest} favs={favs} toggleFav={toggleFav} fresh={fresh} />}
            {filters.view === 'map' && (
              <Suspense fallback={<div className="panel loading">지도를 불러오는 중…</div>}>
                <MapView results={results} status={status} filters={filters} origin={origin} onOpen={openForest} locate={locate} />
              </Suspense>
            )}
            {filters.view === 'calendar' && <CalendarView results={results} status={status} filters={filters} onOpen={openForest} />}
            {filters.view === 'grid' && <GridView results={results} status={status} filters={filters} onOpen={openForest} />}
            </>}
            </div>
          </>
        )}
        <footer>
          <nav className="netband" aria-label="운영자의 다른 서비스">
            <div className="netband-in">
              <h2>운영자의 다른 서비스</h2>
              <ul>
                {network.sites.filter((s) => s.url !== network.self).map((s) => (
                  <li key={s.url}>
                    <a href={`${s.url}/?utm_source=${network.utm.source}&utm_medium=${network.utm.medium}`} target="_blank" rel="noopener">
                      <span className="nb-i" aria-hidden="true">{s.icon}</span>
                      <span className="nb-t">
                        <b>{s.name}</b>
                        <span>{s.desc}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
          <p>
            숲가자는 숲나들e(foresttrip.go.kr)에 공개된 월별 예약현황을 주기적으로 모아 보여 주는 <b>비공식 참고용</b> 서비스입니다.
            국립자연휴양림관리소 및 각 지자체와 제휴하지 않았습니다.
          </p>
          <p>
            실제 예약 가능 여부는 수집 시점 이후 바뀌었을 수 있습니다. 예약·결제·취소는 반드시{' '}
            <a href="https://www.foresttrip.go.kr" target="_blank" rel="noreferrer">숲나들e</a>에서 진행하세요.
            공휴일은 주말 판단에만 쓰이며 연 1회 갱신합니다.
          </p>
          <p>
            <b>개인정보 처리 안내</b> · 회원가입·로그인이 없습니다. 테마와 내 휴양림(즐겨찾기)은 이 브라우저에만 저장되고, '내 위치'는 브라우저 안에서 거리 계산에만 씁니다.
            방문 통계(Google Analytics 쿠키)와 빈자리 알림 신청 때 받는 이메일 등 자세한 내용은 <a href="/privacy">개인정보처리방침</a>을 보세요.
          </p>
          <nav className="links" aria-label="사이트 링크">
            <a href="/forest/">휴양림별 빈자리</a>
            <a href="/vacancy/all/this-weekend/">이번 주말 빈자리</a>
            <a href="/faq.html">자주 묻는 질문</a>
            <a href="/privacy">개인정보처리방침</a>
            <a href="/terms">이용약관</a>
            <a href="https://github.com/chanyong/forest-trip/issues" target="_blank" rel="noreferrer">문의·수집 중단 요청</a>
            <a href="https://github.com/chanyong/forest-trip" target="_blank" rel="noreferrer">소스 코드</a>
            <a href="https://www.foresttrip.go.kr" target="_blank" rel="noreferrer">숲나들e</a>
          </nav>
        </footer>
      </main>

      {forest && status && filters && (
        <Suspense fallback={null}>
          <ForestDrawer forest={forest} status={status} filters={filters} onClose={closeDrawer}
            fav={favs.has(forest.id)} toggleFav={() => toggleFav(forest.id)} onAlert={() => askAlert(forest)} />
        </Suspense>
      )}
      {notice && <div className="toast" role="status" onClick={() => setNotice('')}>{notice}</div>}
    </>
  );
}
