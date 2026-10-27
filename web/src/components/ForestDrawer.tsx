import { useEffect, useMemo, useRef } from 'react';
import { maplibregl, MAP_STYLE } from '../lib/maplibre';
import {
  addDaysISO, cellClass, dow, DOW, FLAG_LABELS, goodsPasses, holidayName, isoOf, isOpen, isWeekendStay, kindName,
  naverPlaceUrl, rateOf, RESERVE_URL, statusLabel, statusShort, type Filters, type Forest, type Status,
} from '../lib/data';
import { Reviews } from './Reviews';
import { RateBars } from './Rate';

interface Props {
  forest: Forest;
  status: Status;
  filters: Filters;
  onClose: () => void;
}

export function ForestDrawer({ forest: f, status, filters, onClose }: Props) {
  const start = isoOf(status.start);
  const mapBox = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      // 초점이 팝업 안에서만 돌도록 가둔다
      if (e.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), select, input, [tabindex]:not([tabindex="-1"])')]
        .filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      const inside = panel.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus(); }
    };
    addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [onClose]);

  useEffect(() => {
    if (!mapBox.current || f.lat == null || f.lng == null) return;
    const m = new maplibregl.Map({
      container: mapBox.current, style: MAP_STYLE,
      center: [f.lng, f.lat], zoom: 10, attributionControl: { compact: true },
    });
    new maplibregl.Marker({ color: '#1f5f3f' }).setLngLat([f.lng, f.lat]).addTo(m);
    return () => m.remove();
  }, [f]);

  // 데이터가 있는 마지막 날짜까지만 표시
  const lastIdx = useMemo(() => {
    let last = 0;
    for (const g of f.goods) for (let i = g.s.length - 1; i > last; i--) if (g.s[i] !== '.') { last = i; break; }
    return last;
  }, [f]);
  const firstIdx = useMemo(() => {
    let first = lastIdx;
    for (const g of f.goods) for (let i = 0; i < first; i++) if (g.s[i] !== '.') { first = i; break; }
    return first;
  }, [f, lastIdx]);
  const cols = Array.from({ length: lastIdx - firstIdx + 1 }, (_, k) => firstIdx + k);
  const template = `170px repeat(${cols.length}, 32px)`;
  const width = 170 + cols.length * 32;

  const kinds = [...new Set(f.goods.map((g) => g.kind))].sort();
  const openCount = f.goods.reduce((n, g) => n + [...g.s].filter((c) => c === 'A').length, 0);
  const matches = (g: Forest['goods'][number], i: number) => {
    if (!goodsPasses(g, filters)) return false;
    if (filters.weekend && !isWeekendStay(addDaysISO(start, i))) return false;
    for (let k = 0; k < filters.nights; k++) if (!isOpen(g.s[i + k], filters.wait)) return false;
    return true;
  };

  return (
    <div className="overlay" onClick={onClose}>
      <aside className="drawer" ref={panel} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="drawer-hd">
          <div style={{ flex: 1 }}>
            <h2 id="drawer-title">{f.name} <span className={`badge t-${f.type}`}>{f.type}</span></h2>
            <Reviews forest={f} />
            {kinds.map((k) => (
              <div key={k} className="drawer-rate"><span className="fsub">{kindName(k)} 예약률</span><RateBars rate={rateOf(f, [k])} /></div>
            ))}
            <div className="fsub">{f.addr || `${f.sidoName} · ${f.sigungu}`}</div>
            <div className="fsub">
              객실·사이트 {f.goods.length}개 · 예약가능 {openCount}건
              {f.checkin ? ` · 입실 ${f.checkin}` : ''}{f.checkout ? ` · 퇴실 ${f.checkout}` : ''}
              {f.tel ? <> · <a href={`tel:${f.tel}`}>{f.tel}</a></> : null}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="닫기" autoFocus>✕</button>
        </div>
        <div className="drawer-bd">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a className="btn primary" href={RESERVE_URL} target="_blank" rel="noreferrer">숲나들e에서 예약하기 <small>(로그인 필요)</small> ↗</a>
            {f.url && <a className="btn" href={f.url} target="_blank" rel="noreferrer">휴양림 홈페이지 ↗</a>}
            <a className="btn" href={naverPlaceUrl(f)} target="_blank" rel="noreferrer">네이버 리뷰·지도 ↗</a>
            <a className="btn" href={`https://map.kakao.com/?q=${encodeURIComponent(f.name)}`} target="_blank" rel="noreferrer">카카오맵</a>
          </div>
          {f.lat != null && <div className="minimap" ref={mapBox} />}
          {kinds.map((k) => {
            const list = f.goods.filter((g) => g.kind === k);
            return (
              <section key={k} className="panel">
                <div className="grid-tools"><b style={{ color: 'var(--ink)' }}>{kindName(k)}</b> {list.length}개 · 테두리 = 현재 검색 조건 충족</div>
                <div style={{ overflowX: 'auto' }}>
                  <div style={{ width }}>
                    <div className="ghead" style={{ gridTemplateColumns: template, width, position: 'static' }}>
                      <div className="gname">객실</div>
                      {cols.map((i) => {
                        const iso = addDaysISO(start, i);
                        const wd = dow(iso);
                        const hol = holidayName(iso);
                        return (
                          <div key={i} className={`gcell${hol ? ' hol' : wd === 0 ? ' sun' : wd === 6 ? ' sat' : ''}`} title={hol}>
                            <span>{i === firstIdx || iso.endsWith('-01') ? `${+iso.slice(5, 7)}/` : ''}{+iso.slice(8)}<br />{DOW[wd]}</span>
                          </div>
                        );
                      })}
                    </div>
                    {list.map((g) => (
                      <div key={g.id} className="grow-g" style={{ gridTemplateColumns: template, width }}>
                        <div className="gname" title={`${g.cls} ${g.name} · ${g.cap}인 · ${g.area} · ${g.flags.split('').map((c) => FLAG_LABELS[c]).join(', ')}`}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</span>
                          <span className="fsub">{g.cls} {g.cap ? `${g.cap}인` : ''}</span>
                        </div>
                        {cols.map((i) => {
                          const c = g.s[i] || '.';
                          return (
                            <div key={i} className={`gcell ${cellClass(c)}${matches(g, i) ? ' s-hit' : ''}`} title={`${addDaysISO(start, i)} ${statusLabel(c)}`}>
                              {statusShort(c)}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          })}
          <p className="fsub">
            객실별 정원·면적·편의시설은 숲나들e 공개 정보 기준입니다. 반려견 동반은 반려견 표시 객실만 가능합니다.
          </p>
        </div>
      </aside>
    </div>
  );
}
