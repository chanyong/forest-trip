import { useState } from 'react';
import { addDaysISO, fmtDate, holidayName, isoOf, isRestDay, kindName, SORTS, type Filters, type ForestResult, type Status } from '../lib/data';
import { Reviews } from './Reviews';

interface Props {
  results: ForestResult[];
  status: Status;
  filters: Filters;
  set: (p: Partial<Filters>) => void;
  onOpen: (id: string) => void;
}

const PAGE = 60;

export function DateChips({ idx, start, max = 10 }: { idx: number[]; start: string; max?: number }) {
  const shown = idx.slice(0, max);
  return (
    <div className="dchips">
      {shown.map((i) => {
        const iso = addDaysISO(start, i);
        const rest = isRestDay(addDaysISO(iso, 1));
        return (
          <span key={i} className={`dchip${rest ? ' rest' : ''}`} title={holidayName(iso) || undefined}>
            {fmtDate(iso)}
          </span>
        );
      })}
      {idx.length > max && <span className="dchip more">+{idx.length - max}</span>}
    </div>
  );
}

export function TableView({ results, status, filters, set, onOpen }: Props) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);
  const [showEmpty, setShowEmpty] = useState(false);
  const start = isoOf(status.start);
  const rows = showEmpty ? results : results.filter((r) => r.total > 0);
  const emptyCount = results.length - results.filter((r) => r.total > 0).length;

  const sortBtn = (k: Filters['sort'], label: string) => (
    <button aria-pressed={filters.sort === k} onClick={() => set({ sort: k })}>{label}{filters.sort === k ? ' ↓' : ''}</button>
  );

  if (!rows.length) {
    return (
      <div className="panel empty">
        조건에 맞는 빈자리가 없습니다. 기간을 넓히거나 '대기 포함'을 켜 보세요.
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="grid-tools">
        <span>휴양림 {rows.length}곳</span>
        <span className="sp" />
        <label className="field sel">
          <span>정렬</span>
          <select value={filters.sort} onChange={(e) => set({ sort: e.target.value as Filters['sort'] })}>
            {SORTS.filter((o) => o.value !== 'dist' || rows.some((r) => r.dist != null)).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>
      <table className="ftable">
        <thead>
          <tr>
            <th>{sortBtn('name', '휴양림')}</th>
            <th>{sortBtn('date', '가장 가까운 날짜')}</th>
            <th>{sortBtn('count', '가능 건수')}</th>
            <th>예약 가능 체크인 날짜</th>
            <th><span className="sr-only">거리·객실별 보기</span>{filters.sort === 'dist' ? '거리' : ''}</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((r) => {
            const f = r.forest;
            const dates = [...r.hitDates.keys()].sort((a, b) => a - b);
            const isOpen = open.has(f.id);
            const kinds = [...new Set(r.goods.map((g) => kindName(g.goods.kind)))];
            return (
              <tr key={f.id} className={r.total ? '' : 'dim'}>
                <td style={{ minWidth: 200 }}>
                  <button className="fname" onClick={() => onOpen(f.id)}>{f.name}</button>{' '}
                  <span className={`badge t-${f.type}`}>{f.type}</span>
                  <div className="fsub">{f.sidoName} · {f.sigungu}{kinds.length ? ` · ${kinds.join('/')}` : ''}</div>
                  <Reviews forest={f} />
                </td>
                <td className="c-first" data-label="가장 가까운 날" style={{ whiteSpace: 'nowrap' }}>
                  {r.total ? <b>{fmtDate(addDaysISO(start, r.first))}</b> : <span className="fsub">없음</span>}
                </td>
                <td className="c-count" data-label="가능">
                  <span className="num">{r.total}<span className="m-only">건</span></span>
                  <div className="fsub">{r.goods.length}개 객실</div>
                </td>
                <td style={{ width: '50%' }}>
                  {r.total > 0 && <DateChips idx={dates} start={start} />}
                  {isOpen && (
                    <div className="gsub">
                      {r.goods.map((g) => (
                        <div className="grow" key={g.goods.id}>
                          <div className="gn">
                            <b>{g.goods.name}</b> {g.goods.cls}
                            <div className="fsub">{g.goods.cap ? `${g.goods.cap}인` : ''}{g.goods.area ? ` · ${g.goods.area}` : ''}</div>
                          </div>
                          <DateChips idx={g.hits} start={start} max={14} />
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                  {r.dist != null && filters.sort === 'dist' && <div className="fsub">{r.dist.toFixed(0)}km</div>}
                  {r.total > 0 && (
                    <button className="expand" aria-expanded={isOpen} aria-label={`${f.name} 객실별 날짜 ${isOpen ? '접기' : '보기'}`} onClick={() => setOpen((s) => { const n = new Set(s); n.has(f.id) ? n.delete(f.id) : n.add(f.id); return n; })}>
                      {isOpen ? '접기' : '객실별'}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="grid-tools">
        {rows.length > limit && <button className="btn" onClick={() => setLimit((l) => l + PAGE)}>더 보기 ({rows.length - limit}곳)</button>}
        <span className="sp" />
        {emptyCount > 0 && (
          <label><input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} /> 빈자리 없는 휴양림 {emptyCount}곳도 보기</label>
        )}
      </div>
    </div>
  );
}
