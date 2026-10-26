import { useMemo, useState } from 'react';
import { Reviews } from './Reviews';
import { RateBars } from './Rate';
import { addDaysISO, diffISO, dow, DOW, fmtDate, holidayName, isoOf, type Filters, type ForestResult, type Goods, type Status } from '../lib/data';

interface Props {
  results: ForestResult[];
  status: Status;
  filters: Filters;
  onOpen: (id: string) => void;
}

export function CalendarView({ results, status, filters, onOpen }: Props) {
  const start = isoOf(status.start);
  const [picked, setPicked] = useState<number | null>(null);

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

  // 고른 날짜가 없거나 범위를 벗어나면 빈자리가 있는 첫 날을 보여 준다
  const firstHit = [...perDay.keys()].filter((i) => i >= lo && i <= hi).sort((a, b) => a - b)[0] ?? null;
  const sel = picked != null && picked >= lo && picked <= hi ? picked : firstHit;
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
                  const alpha = v ? 0.06 + 0.26 * (v.forests / maxForests) : 0;
                  return (
                    <button key={iso} className={cls} disabled={!inRange}
                      style={v ? { background: `color-mix(in srgb, var(--open) ${Math.round(alpha * 100)}%, var(--surface))` } : undefined}
                      onClick={() => setPicked(i)} aria-pressed={sel === i}
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
      <div className="daylist" aria-live="polite">
        {sel == null ? (
          <div className="fsub">날짜를 누르면 그날 체크인 가능한 휴양림과 객실을 보여 줍니다. 색이 진할수록 빈자리가 있는 휴양림이 많습니다.</div>
        ) : (
          <>
            <div className="dl-hd">
              <h3>{fmtDate(addDaysISO(start, sel))} 체크인 · {filters.nights}박</h3>
              <span className="fsub">휴양림 <b>{dayList.length}</b>곳 · 객실 <b>{dayList.reduce((n, r) => n + r.hitDates.get(sel)!, 0)}</b>개</span>
            </div>
            {dayList.length === 0 && <div className="fsub">조건에 맞는 빈자리가 없습니다.</div>}
            <div className="dl-cards">
              {dayList.map((r) => <DayCard key={r.forest.id} r={r} idx={sel} onOpen={onOpen} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const CHIP_MAX = 6;

// 휴양림 한 곳의 그날 빈 객실을 시설 종류별로 묶어 보여 준다
function DayCard({ r, idx, onOpen }: { r: ForestResult; idx: number; onOpen: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const groups = new Map<string, Goods[]>();
  for (const g of r.goods) if (g.hits.includes(idx)) {
    const k = g.goods.cls || '기타';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(g.goods);
  }
  const n = r.hitDates.get(idx) || 0;
  const many = [...groups.values()].some((l) => l.length > CHIP_MAX);
  return (
    <article className="dl-card">
      <header>
        <button className="fname" onClick={() => onOpen(r.forest.id)}>{r.forest.name}</button>
        <span className={`badge t-${r.forest.type}`}>{r.forest.type}</span>
        <span className="dl-n">{n}개 객실</span>
      </header>
      <div className="dl-meta">
        <span className="fsub">{r.forest.sidoName} · {r.forest.sigungu}</span>
        <Reviews forest={r.forest} compact />
        <RateBars rate={r.rate} />
      </div>
      <dl className="dl-groups">
        {[...groups].map(([cls, list]) => (
          <div key={cls}>
            <dt>{cls} <span>{list.length}</span></dt>
            <dd>
              {(all ? list : list.slice(0, CHIP_MAX)).map((g) => (
                <span key={g.id} className="gchip" title={`${g.name}${g.cap ? ` · ${g.cap}인` : ''}${g.area ? ` · ${g.area}` : ''}`}>
                  {g.name}{g.cap ? <small>{g.cap}인</small> : null}
                </span>
              ))}
              {!all && list.length > CHIP_MAX && <span className="gchip more">+{list.length - CHIP_MAX}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <footer>
        {many && <button className="link-btn" onClick={() => setAll((a) => !a)} aria-expanded={all}>{all ? '접기' : '객실 모두 보기'}</button>}
        <span className="sp" />
        <button className="link-btn" onClick={() => onOpen(r.forest.id)}>상세·예약 →</button>
      </footer>
    </article>
  );
}
