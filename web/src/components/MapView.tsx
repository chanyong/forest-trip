import { useEffect, useMemo, useRef, useState } from 'react';
import { maplibregl, MAP_STYLE } from '../lib/maplibre';
import { addDaysISO, compactNum, fmtDate, isoOf, reviewTotal, type Filters, type ForestResult, type Status } from '../lib/data';
import { Reviews } from './Reviews';
import { RateBars } from './Rate';

interface Props {
  results: ForestResult[];
  status: Status;
  filters: Filters;
  origin: { lat: number; lng: number } | null;
  onOpen: (id: string) => void;
  locate: () => void;
}


const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const level = (n: number) => (n === 0 ? 'z' : n < 5 ? 'l' : n < 30 ? 'm' : 'h');

export function MapView({ results, status, filters, origin, onOpen, locate }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [bounds, setBounds] = useState<maplibregl.LngLatBounds | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [order, setOrder] = useState<'count' | 'review'>('count');
  const start = isoOf(status.start);
  const located = useMemo(() => results.filter((r) => r.forest.lat != null && r.forest.lng != null), [results]);

  useEffect(() => {
    if (!box.current) return;
    const m = new maplibregl.Map({
      container: box.current,
      style: MAP_STYLE,
      center: [127.8, 36.2],
      zoom: 6.2,
      minZoom: 5,
      maxZoom: 15,
      attributionControl: { compact: true },
      // 터치 기기에서는 두 손가락으로만 지도를 움직여 페이지 스크롤이 막히지 않게 한다
      cooperativeGestures: matchMedia('(pointer: coarse)').matches,
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    const upd = () => setBounds(m.getBounds());
    m.on('load', () => {
      upd();
      box.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
    });
    m.on('moveend', upd);
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((mk) => mk.remove());
    markers.current = [];
    // 빈자리 많은 곳이 위에 보이도록 적은 순서로 추가
    const sorted = [...located].sort((a, b) => a.total - b.total);
    for (const r of sorted) {
      const el = document.createElement('div');
      el.className = `pin ${level(r.total)}${sel === r.forest.id ? ' sel' : ''}`;
      el.textContent = r.total ? String(r.total > 999 ? '999+' : r.total) : '';
      el.title = `${r.forest.name} · ${r.total}건`;
      // 마커는 마우스·터치용. 키보드·화면 읽기 사용자는 같은 내용을 옆 목록에서 쓴다
      el.setAttribute('aria-hidden', 'true');
      const first = r.total ? fmtDate(addDaysISO(start, r.first)) : '빈자리 없음';
      const popup = new maplibregl.Popup({ offset: 16, closeButton: false }).setHTML(
        `<b>${esc(r.forest.name)}</b> <small>${esc(r.forest.type)}</small><br/>` +
        `<small>${esc(r.forest.sigungu)}</small>` +
        (r.forest.naver ? ` <small>· 네이버 ${r.forest.naver.s ? '★' + r.forest.naver.s.toFixed(2) + ' ' : ''}리뷰 ${compactNum(r.forest.naver.v)}</small>` : '') + '<br/>' +
        `가능 ${r.total}건 · 가장 가까운 날 ${first}` +
        (r.rate.we != null ? `<br/><small>예약률 주말 ${r.rate.we}% · 평일 ${r.rate.wd ?? '-'}%</small>` : ''),
      );
      const mk = new maplibregl.Marker({ element: el }).setLngLat([r.forest.lng!, r.forest.lat!]).setPopup(popup).addTo(m);
      el.tabIndex = -1; // 키보드 초점은 옆 목록으로만 받는다
      el.addEventListener('click', () => setSel(r.forest.id));
      markers.current.push(mk);
    }
  }, [located, sel, start]);

  // 지역 조건이 바뀌면 해당 휴양림들이 다 보이게 화면을 맞춘다
  const sidoKey = filters.sidos.join(',');
  useEffect(() => {
    const m = map.current;
    if (!m || !sidoKey) return;
    const pts = located.filter((r) => r.total > 0);
    const list = pts.length ? pts : located;
    if (!list.length) return;
    const b = new maplibregl.LngLatBounds();
    for (const r of list) b.extend([r.forest.lng!, r.forest.lat!]);
    m.fitBounds(b, { padding: 40, maxZoom: 10, duration: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidoKey]);

  useEffect(() => {
    if (origin && map.current) map.current.flyTo({ center: [origin.lng, origin.lat], zoom: 8.5 });
  }, [origin]);

  const inView = located
    .filter((r) => !bounds || bounds.contains([r.forest.lng!, r.forest.lat!]))
    .sort(order === 'review' ? (a, b) => reviewTotal(b.forest) - reviewTotal(a.forest) : (a, b) => b.total - a.total);

  const focus = (r: ForestResult) => {
    setSel(r.forest.id);
    map.current?.flyTo({ center: [r.forest.lng!, r.forest.lat!], zoom: Math.max(map.current.getZoom(), 9.5) });
  };

  return (
    <div className="panel">
      <div className="mapbox">
        <div className="map" ref={box} />
        <div className="mapside">
          <div className="hd">
            <span>지도 영역 안 <b>{inView.length}</b>곳</span>
            <select aria-label="목록 정렬" value={order} onChange={(e) => setOrder(e.target.value as 'count' | 'review')}>
              <option value="count">빈자리 많은 순</option>
              <option value="review">리뷰 많은 순</option>
            </select>
            <button className="chip ghost" onClick={locate}><span aria-hidden>📍</span> 내 주변</button>
          </div>
          {inView.map((r) => (
            <div key={r.forest.id} className={`item${sel === r.forest.id ? ' on' : ''}`}>
              <button className="item-main" onClick={() => focus(r)}>
                <b>{r.forest.name}</b> <span className={`badge t-${r.forest.type}`}>{r.forest.type}</span>
                <span className="fsub" style={{ display: 'block' }}>
                  {r.forest.sigungu} · {r.total ? `${r.total}건 · ${fmtDate(addDaysISO(start, r.first))}부터` : '빈자리 없음'}
                  {r.dist != null ? ` · ${r.dist.toFixed(0)}km` : ''}
                </span>
                <span className="sr-only"> 지도에서 보기</span>
              </button>
              <div className="item-sub">
                <RateBars rate={r.rate} />
              </div>
              <div className="item-sub">
                <Reviews forest={r.forest} />
                <button className="link-btn" onClick={() => onOpen(r.forest.id)}>상세 보기 →</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="legend">
        <span><i style={{ background: '#1f7a4a' }} />30건 이상</span>
        <span><i style={{ background: '#23824f' }} />5~29건</span>
        <span><i style={{ background: '#a5650a' }} />1~4건</span>
        <span><i style={{ background: '#9aa29c' }} />없음</span>
        <span>숫자 = 조건에 맞는 객실·날짜 수</span>
        {results.length > located.length && <span>위치 정보 없는 휴양림 {results.length - located.length}곳은 목록에서 확인하세요</span>}
      </div>
    </div>
  );
}
