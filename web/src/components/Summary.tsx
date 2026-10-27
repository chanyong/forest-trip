import { useMemo } from 'react';
import { addDaysISO, diffISO, dow, fmtDate, isoOf, statusLabel, type Change, type Meta, type Status } from '../lib/data';

interface Props {
  status: Status;
  changes: Change[];
  meta: Meta | null;
  onOpen: (id: string) => void;
}

export function Summary({ status, changes, onOpen }: Props) {
  const start = isoOf(status.start);
  const stats = useMemo(() => {
    let goods = 0, open = 0, weekend = 0, weekendForests = 0;
    const fri = addDaysISO(start, (5 - dow(start) + 7) % 7);
    const iFri = diffISO(start, fri), iSat = iFri + 1;
    for (const f of status.forests) {
      let any = false;
      for (const g of f.goods) {
        goods++;
        for (const c of g.s) if (c === 'A') open++;
        if (g.s[iFri] === 'A' || g.s[iSat] === 'A') { weekend++; any = true; }
      }
      if (any) weekendForests++;
    }
    return { goods, open, weekend, weekendForests, fri };
  }, [status, start]);

  const index = useMemo(() => {
    const m = new Map<string, { forest: string; goods: string; cls: string }>();
    for (const f of status.forests) for (const g of f.goods) m.set(g.id, { forest: f.name, goods: g.name, cls: g.cls });
    return m;
  }, [status]);

  const recent = changes
    .filter((c) => c.date >= start.replaceAll('-', '') && index.has(c.goods))
    .slice(0, 12);

  return (
    <>
      <section className="summary" aria-label="요약">
        <div className="stat stat-static"><div className="k">수집 휴양림</div><div className="v">{status.forests.length}<small>곳</small></div></div>
        <div className="stat stat-static"><div className="k">객실·사이트</div><div className="v">{stats.goods.toLocaleString()}<small>개</small></div></div>
        <div className="stat"><div className="k">예약가능 객실·날짜</div><div className="v">{stats.open.toLocaleString()}<small>건 · {status.days}일</small></div></div>
        <div className="stat">
          <div className="k">이번 주말 {fmtDate(stats.fri, false)}~{fmtDate(addDaysISO(stats.fri, 1), false)} 체크인</div>
          <div className="v">{stats.weekend.toLocaleString()}<small>객실 · {stats.weekendForests}곳</small></div>
        </div>
      </section>
      {recent.length > 0 && (
        <section className="changes" aria-label="최근 새로 열린 자리">
          <h2>최근 새로 열린 자리 <span>직전 수집 대비 완료·대기 → 예약가능</span></h2>
          <div className="change-row">
            {recent.map((c) => {
              const g = index.get(c.goods)!;
              const iso = isoOf(c.date);
              return (
                <button key={c.goods + c.date + c.at} className="change-card" onClick={() => onOpen(c.forest)}>
                  <div className="t">{g.forest}</div>
                  <div className="m">{g.cls} {g.goods}</div>
                  <div><span className="d">{fmtDate(iso)}</span> <span className="m">{statusLabel(c.from)} → 예약가능</span></div>                </button>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
