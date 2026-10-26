import { useMemo, useState } from 'react';
import { addDaysISO, diffISO, dow, DOW, fmtDate, holidayName, isoOf, type Filters, type ForestResult, type Status } from '../lib/data';

interface Props {
  results: ForestResult[];
  status: Status;
  filters: Filters;
  onOpen: (id: string) => void;
}

export function CalendarView({ results, status, filters, onOpen }: Props) {
  const start = isoOf(status.start);
  const [sel, setSel] = useState<number | null>(null);

  // 날짜 인덱스별: 가능한 휴양림 수, 객실 수
  const perDay = useMemo(() => {
    const m = new Map<number, { forests: number; goods: number }>();
    for (const r of results) for (const [i, n] of r.hitDates) {
      const v = m.get(i) || { forests: 0, goods: 0 };
      v.forests++; v.goods += n;
      m.set(i, v);
    }
    return m;
  }, [results]);
  const maxForests = Math.max(1, ...[...perDay.values()].map((v) => v.forests));

  const lo = Math.max(0, diffISO(start, filters.from));
  const hi = Math.min(status.days - 1, diffISO(start, filters.to));
  const months: string[] = [];
  for (let d = addDaysISO(start, lo).slice(0, 7); d <= addDaysISO(start, hi).slice(0, 7);) {
    months.push(d);
    const [y, mo] = d.split('-').map(Number);
    d = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
  }

  const dayList = sel != null
    ? results.filter((r) => r.hitDates.has(sel)).sort((a, b) => b.hitDates.get(sel)! - a.hitDates.get(sel)!)
    : [];

  return (
    <div className="panel">
      <div className="cal-wrap">
        {months.map((ym) => {
          const first = `${ym}-01`;
          const lead = dow(first);
          const [y, mo] = ym.split('-').map(Number);
          const nDays = new Date(Date.UTC(y, mo, 0)).getUTCDate();
          return (
            <div className="cal" key={ym}>
              <h3>{y}년 {mo}월</h3>
              <div className="cal-grid">
                {DOW.map((d, i) => <div key={d} className={`cal-dow${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}`}>{d}</div>)}
                {Array.from({ length: lead }, (_, i) => <div key={'o' + i} className="cal-day off" />)}
                {Array.from({ length: nDays }, (_, k) => {
                  const iso = `${ym}-${String(k + 1).padStart(2, '0')}`;
                  const i = diffISO(start, iso);
                  const inRange = i >= lo && i <= hi;
                  const v = perDay.get(i);
                  const hol = holidayName(iso);
                  const wd = dow(iso);
                  const cls = `cal-day${wd === 0 || hol ? ' sun' : wd === 6 ? ' sat' : ''}${!inRange ? ' na' : ''}${sel === i ? ' sel' : ''}`;
                  const alpha = v ? 0.12 + 0.6 * (v.forests / maxForests) : 0;
                  return (
                    <button key={iso} className={cls} disabled={!inRange}
                      style={v ? { background: `color-mix(in srgb, var(--open) ${Math.round(alpha * 100)}%, var(--surface))` } : undefined}
                      onClick={() => setSel(i)}
                      aria-label={`${iso} 체크인 ${v ? `${v.forests}곳 ${v.goods}객실` : '빈자리 없음'}`}>
                      <span className="dn">{k + 1}</span>
                      {hol && <span className="hn">{hol}</span>}
                      {inRange && <span className="cv">{v ? <>{v.forests}<small>곳</small></> : <small>-</small>}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="daylist">
        {sel == null ? (
          <div className="fsub">날짜를 누르면 그날 체크인 가능한 휴양림과 객실을 보여 줍니다. 색이 진할수록 빈자리가 있는 휴양림이 많습니다.</div>
        ) : (
          <>
            <h3>{fmtDate(addDaysISO(start, sel))} 체크인 · {filters.nights}박 · {dayList.length}곳</h3>
            {dayList.length === 0 && <div className="fsub">조건에 맞는 빈자리가 없습니다.</div>}
            {dayList.map((r) => (
              <div className="row" key={r.forest.id}>
                <button className="fname" onClick={() => onOpen(r.forest.id)}>{r.forest.name}</button>
                <span className={`badge t-${r.forest.type}`}>{r.forest.type}</span>
                <span className="fsub">{r.forest.sigungu}</span>
                <span className="fsub" style={{ flexBasis: '100%' }}>
                  {r.goods.filter((g) => g.hits.includes(sel)).map((g) => `${g.goods.name}(${g.goods.cls}${g.goods.cap ? ' ' + g.goods.cap + '인' : ''})`).join(', ')}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
