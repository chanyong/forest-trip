import { addDaysISO, dow, FLAG_LABELS, SIDOS, type Filters, type Kind } from '../lib/data';

interface Props {
  filters: Filters;
  base: Filters;
  set: (p: Partial<Filters>) => void;
  reset: () => void;
  locate: () => void;
  hasOrigin: boolean;
}

const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export function FilterBar({ filters: f, base, set, reset, locate, hasOrigin }: Props) {
  const min = base.from;
  const max = base.to;

  // 빠른 기간: 이번 주말, 다음 주말, 2주, 전체
  const nextSat = (offsetWeeks: number) => {
    const d = (6 - dow(min) + 7) % 7;
    return addDaysISO(min, d + offsetWeeks * 7);
  };
  const quick = [
    { label: '이번 주말', from: addDaysISO(nextSat(0), -1), to: nextSat(0), weekend: true },
    { label: '다음 주말', from: addDaysISO(nextSat(1), -1), to: nextSat(1), weekend: true },
    { label: '2주', from: min, to: addDaysISO(min, 13), weekend: false },
    { label: '전체 기간', from: min, to: max, weekend: false },
  ];
  const clamp = (d: string) => (d < min ? min : d > max ? max : d);

  return (
    <section className="filters" aria-label="검색 조건">
      <div className="frow">
        <div className="field">
          <label htmlFor="f-from">체크인</label>
          <input id="f-from" type="date" min={min} max={max} value={f.from}
            onChange={(e) => e.target.value && set({ from: clamp(e.target.value), to: f.to < e.target.value ? clamp(e.target.value) : f.to })} />
          <span>~</span>
          <input aria-label="체크인 기간 끝" type="date" min={f.from} max={max} value={f.to}
            onChange={(e) => e.target.value && set({ to: clamp(e.target.value) })} />
        </div>
        {quick.map((q) => (
          <button key={q.label} className="chip ghost"
            aria-pressed={f.from === clamp(q.from) && f.to === clamp(q.to)}
            onClick={() => set({ from: clamp(q.from), to: clamp(q.to), weekend: q.weekend })}>
            {q.label}
          </button>
        ))}
        <div className="seg" role="group" aria-label="숙박 일수">
          {[1, 2, 3].map((n) => (
            <button key={n} aria-pressed={f.nights === n} onClick={() => set({ nights: n })}>{n}박</button>
          ))}
        </div>
        <button className="chip" aria-pressed={f.weekend} onClick={() => set({ weekend: !f.weekend })}
          title="체크인 다음 날이 토·일·공휴일인 숙박만">
          주말·연휴만
        </button>
        <button className="chip" aria-pressed={f.wait} onClick={() => set({ wait: !f.wait })} title="대기 신청 가능한 날짜 포함">
          대기 포함
        </button>
      </div>
      <div className="frow">
        {SIDOS.map((s) => (
          <button key={s.code} className="chip" aria-pressed={f.sidos.includes(s.code)}
            onClick={() => set({ sidos: toggle(f.sidos, s.code) })}>
            {s.name}
          </button>
        ))}
      </div>
      <div className="frow">
        {(['국립', '공립', '사립'] as const).map((t) => (
          <button key={t} className="chip" aria-pressed={f.types.includes(t)} onClick={() => set({ types: toggle(f.types, t) })}>{t}</button>
        ))}
        <span className="sep" />
        {([['01', '숙소'], ['02', '야영장']] as [Kind, string][]).map(([k, l]) => (
          <button key={k} className="chip" aria-pressed={f.kinds.includes(k)} onClick={() => set({ kinds: toggle(f.kinds, k) })}>{l}</button>
        ))}
        <span className="sep" />
        {['d', 'a', 'e', 'h'].map((k) => (
          <button key={k} className="chip" aria-pressed={f.flags.includes(k)} onClick={() => set({ flags: toggle(f.flags, k) })}>{FLAG_LABELS[k]}</button>
        ))}
        <div className="field">
          <label htmlFor="f-people">인원</label>
          <select id="f-people" value={f.people} onChange={(e) => set({ people: +e.target.value })}>
            <option value={0}>제한 없음</option>
            {[2, 3, 4, 5, 6, 8, 10, 12].map((n) => <option key={n} value={n}>{n}인 이상</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-q">검색</label>
          <input id="f-q" type="search" placeholder="휴양림·시군 이름" value={f.q} onChange={(e) => set({ q: e.target.value })} />
        </div>
        <button className="chip" aria-pressed={hasOrigin} onClick={locate}>📍 내 위치</button>
        <button className="chip ghost" onClick={reset}>⟳ 초기화</button>
      </div>
    </section>
  );
}
