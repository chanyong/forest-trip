import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { addDaysISO, fmtDate, isoOf, type Filters, type ForestResult, type Status } from '../lib/data';

interface Props {
  results: ForestResult[];
  status: Status;
  filters: Filters;
  origin: { lat: number; lng: number } | null;
  onOpen: (id: string) => void;
  locate: () => void;
}

// OpenFreeMap: 무료·무키 벡터 타일
const STYLE = 'https://tiles.openfreemap.org/styles/positron';

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const level = (n: number) => (n === 0 ? 'z' : n < 5 ? 'l' : n < 30 ? 'm' : 'h');

export function MapView({ results, status, origin, onOpen, locate }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [bounds, setBounds] = useState<maplibregl.LngLatBounds | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const start = isoOf(status.start);
  const located = useMemo(() => results.filter((r) => r.forest.lat != null && r.forest.lng != null), [results]);

  useEffect(() => {
    if (!box.current) return;
    const m = new maplibregl.Map({
      container: box.current,
      style: STYLE,
      center: [127.8, 36.2],
      zoom: 6.2,
      minZoom: 5,
      maxZoom: 15,
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    const upd = () => setBounds(m.getBounds());
    m.on('load', upd);
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
      const first = r.total ? fmtDate(addDaysISO(start, r.first)) : '빈자리 없음';
      const popup = new maplibregl.Popup({ offset: 16, closeButton: false }).setHTML(
        `<b>${esc(r.forest.name)}</b> <small>${esc(r.forest.type)}</small><br/>` +
        `<small>${esc(r.forest.sigungu)}</small><br/>` +
        `가능 ${r.total}건 · 가장 가까운 날 ${first}`,
      );
      const mk = new maplibregl.Marker({ element: el }).setLngLat([r.forest.lng!, r.forest.lat!]).setPopup(popup).addTo(m);
      el.addEventListener('click', () => setSel(r.forest.id));
      markers.current.push(mk);
    }
  }, [located, sel, start]);

  useEffect(() => {
    if (origin && map.current) map.current.flyTo({ center: [origin.lng, origin.lat], zoom: 8.5 });
  }, [origin]);

  const inView = located
    .filter((r) => !bounds || bounds.contains([r.forest.lng!, r.forest.lat!]))
    .sort((a, b) => b.total - a.total);

  const focus = (r: ForestResult) => {
    setSel(r.forest.id);
    map.current?.flyTo({ center: [r.forest.lng!, r.forest.lat!], zoom: Math.max(map.current.getZoom(), 9.5) });
  };

  return (
    <div className="panel">
      <div className="mapbox">
        <div className="map" ref={box} />
        <div className="mapside">
          <div className="hd">지도 영역 안 {inView.length}곳 · 빈자리 많은 순 <button className="chip ghost" style={{ float: 'right', height: 26 }} onClick={locate}>📍 내 주변</button></div>
          {inView.map((r) => (
            <button key={r.forest.id} className={`item${sel === r.forest.id ? ' on' : ''}`} onClick={() => focus(r)} onDoubleClick={() => onOpen(r.forest.id)}>
              <b>{r.forest.name}</b> <span className={`badge t-${r.forest.type}`}>{r.forest.type}</span>
              <div className="fsub">
                {r.forest.sigungu} · {r.total ? `${r.total}건 · ${fmtDate(addDaysISO(start, r.first))}부터` : '빈자리 없음'}
                {r.dist != null ? ` · ${r.dist.toFixed(0)}km` : ''}
              </div>
              {sel === r.forest.id && (
                <span className="btn" style={{ marginTop: 6, height: 30 }} onClick={(e) => { e.stopPropagation(); onOpen(r.forest.id); }}>상세 보기 →</span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="legend">
        <span><i style={{ background: '#1f7a4a' }} />30건 이상</span>
        <span><i style={{ background: '#3aa86c' }} />5~29건</span>
        <span><i style={{ background: '#e0a43a' }} />1~4건</span>
        <span><i style={{ background: '#9aa29c' }} />없음</span>
        <span>숫자 = 조건에 맞는 객실·날짜 수</span>
        {results.length > located.length && <span>위치 정보 없는 휴양림 {results.length - located.length}곳은 목록에서 확인하세요</span>}
      </div>
    </div>
  );
}
