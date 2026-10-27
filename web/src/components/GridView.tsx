import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  addDaysISO, cellClass, diffISO, dow, DOW, fmtWon, goodsPasses, holidayName, isoOf, kindName, statusLabel, statusShort, weekendPriceOf,
  type Filters, type ForestResult, type Goods, type Status,
} from '../lib/data';

interface Props {
  results: ForestResult[];
  status: Status;
  filters: Filters;
  onOpen: (id: string) => void;
}

type Row =
  | { t: 'f'; r: ForestResult; n: number }
  | { t: 'g'; r: ForestResult; g: Goods; hits: Set<number> };

// 모바일에서는 이름 열을 좁혀 날짜 칸이 더 보이게 한다
const NAME_W = typeof matchMedia !== 'undefined' && matchMedia('(max-width: 640px)').matches ? 150 : 300;
const CELL_W = 34;
const ROW_H = 28;


export function GridView({ results, status, filters, onOpen }: Props) {
  const start = isoOf(status.start);
  const [onlyHits, setOnlyHits] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const scroller = useRef<HTMLDivElement>(null);

  const lo = Math.max(0, diffISO(start, filters.from));
  const hi = Math.min(status.days - 1, diffISO(start, filters.to));
  const cols = useMemo(() => Array.from({ length: hi - lo + 1 }, (_, k) => lo + k), [lo, hi]);

  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const r of results) {
      const hitMap = new Map(r.goods.map((g) => [g.goods.id, new Set(g.hits)]));
      const list = onlyHits
        ? r.goods.map((g) => g.goods)
        : r.forest.goods.filter((g) => goodsPasses(g, filters));
      if (!list.length) continue;
      out.push({ t: 'f', r, n: list.length });
      if (collapsed.has(r.forest.id)) continue;
      for (const g of list) out.push({ t: 'g', r, g, hits: hitMap.get(g.id) || new Set() });
    }
    return out;
  }, [results, onlyHits, collapsed, filters]);

  const v = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_H,
    overscan: 12,
  });

  const template = `${NAME_W}px repeat(${cols.length}, ${CELL_W}px)`;
  const width = NAME_W + cols.length * CELL_W;

  const toggle = (id: string) => setCollapsed((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allCollapsed = rows.length > 0 && rows.every((r) => r.t === 'f');

  const exportCSV = () => {
    const head = ['휴양림', '구분', '지역', '시설', '객실', '정원', '주말요금', ...cols.map((i) => addDaysISO(start, i))];
    const lines = [head];
    for (const r of results) {
      const list = onlyHits ? r.goods.map((g) => g.goods) : r.forest.goods.filter((g) => goodsPasses(g, filters));
      for (const g of list) {
        lines.push([r.forest.name, r.forest.type, `${r.forest.sidoName} ${r.forest.sigungu}`, g.cls, g.name, String(g.cap), String(g.pr?.[1] ?? ''),
          ...cols.map((i) => statusLabel(g.s[i] || '.'))]);
      }
    }
    const csv = '﻿' + lines.map((l) => l.map((c) => `"${c.replaceAll('"', '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `숲빈자리_${addDaysISO(start, lo)}_${addDaysISO(start, hi)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="panel">
      <div className="grid-tools">
        <label><input type="checkbox" checked={onlyHits} onChange={(e) => setOnlyHits(e.target.checked)} /> 빈자리 있는 객실만</label>
        <button className="chip ghost" onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(results.map((r) => r.forest.id)))}>
          {allCollapsed ? '모두 펼치기' : '모두 접기'}
        </button>
        <span className="legend-s">
          <span><b className="s-A">예</b>예약가능</span>
          <span><b className="s-W">대1</b>대기</span>
          <span><b className="s-F">완</b>완료</span>
          <span><b className="s-C">휴</b>휴무</span>
          <span><b className="s-R">공</b>공사·점검</span>
          <span><b className="s-P">추</b>추첨·우선예약</span>
          <span><b className="s-A s-hit" />조건 충족 체크인</span>
        </span>
        <span className="sp" />
        <button className="btn" onClick={exportCSV}>CSV 내보내기</button>
      </div>
      {rows.length === 0 ? (
        <div className="empty">조건에 맞는 객실이 없습니다.</div>
      ) : (
        <div className="gscroll" ref={scroller}>
          <div style={{ width }}>
            <div className="ghead" style={{ gridTemplateColumns: template, width }}>
              <div className="gname">휴양림 / 객실</div>
              {cols.map((i) => {
                const iso = addDaysISO(start, i);
                const wd = dow(iso);
                const hol = holidayName(iso);
                const showMonth = i === lo || iso.endsWith('-01');
                return (
                  <div key={i} className={`gcell${hol ? ' hol' : wd === 0 ? ' sun' : wd === 6 ? ' sat' : ''}`} title={hol || undefined}>
                    <span>{showMonth ? `${+iso.slice(5, 7)}/` : ''}{+iso.slice(8)}<br />{DOW[wd]}</span>
                  </div>
                );
              })}
            </div>
            <div className="gtable" style={{ height: v.getTotalSize(), width }}>
              {v.getVirtualItems().map((vi) => {
                const row = rows[vi.index];
                const style = { position: 'absolute' as const, top: 0, left: 0, width, transform: `translateY(${vi.start}px)`, gridTemplateColumns: template };
                if (row.t === 'f') {
                  const f = row.r.forest;
                  // 숙소와 야영장은 요금 차이가 커서 시설별로 따로 평균 낸다
                  const prices = (['01', '02'] as const)
                    .filter((k) => !filters.kinds.length || filters.kinds.includes(k))
                    .map((k) => [k, weekendPriceOf(f, [k])] as const)
                    .filter(([, p]) => p != null);
                  return (
                    <div key={'f' + f.id} className="grow-f" style={style}>
                      <div className="gname forest" title={f.name}>
                        <button onClick={() => toggle(f.id)} aria-label="접기/펼치기">{collapsed.has(f.id) ? '▸' : '▾'}</button>
                        <button onClick={() => onOpen(f.id)}>{f.name}</button>
                        <span className="fsub">{row.n}</span>
                        {prices.length > 0 && (
                          <span className="gprice" title={`주말 1박 평균 요금(비수기 주말 기준) · ${prices.map(([k, p]) => `${kindName(k)} ${fmtWon(p!)}`).join(' · ')}`}>
                            {prices.length === 1 ? `주말 ${fmtWon(prices[0][1]!)}` : prices.map(([k, p]) => `${k === '01' ? '숙소' : '야영'} ${fmtWon(p!).replace('원', '')}`).join(' · ')}
                          </span>
                        )}
                      </div>
                      {cols.map((i) => {
                        const n = row.r.hitDates.get(i);
                        return <div key={i} className={`gcell${n ? ' s-A fcount' : ''}`}>{n || ''}</div>;
                      })}
                    </div>
                  );
                }
                const g = row.g;
                return (
                  <div key={g.id} className="grow-g" style={style}>
                    <div className="gname" title={`${g.cls} ${g.name} ${g.cap}인 ${g.area}${g.pr ? ` · 주말 ${fmtWon(g.pr[1])}` : ''}`}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</span>
                      <span className="fsub">{g.cls}{g.cap ? ` ${g.cap}인` : ''}</span>
                    </div>
                    {cols.map((i) => {
                      const c = g.s[i] || '.';
                      return (
                        <div key={i} className={`gcell ${cellClass(c)}${row.hits.has(i) ? ' s-hit' : ''}`} title={`${addDaysISO(start, i)} ${statusLabel(c)}`}>
                          {statusShort(c)}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
