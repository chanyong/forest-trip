import { useState } from 'react';
import { addDaysISO, dow, FLAG_LABELS, RATE_CONDS, SIDOS, type Filters, type Kind } from '../lib/data';
import { MultiSelect, Select } from './Dropdown';

interface Props {
  filters: Filters;
  base: Filters;
  set: (p: Partial<Filters>) => void;
  reset: () => void;
  locate: () => void;
  hasOrigin: boolean;
  favCount: number;
}

const TYPES = ['국립', '공립', '사립'].map((t) => ({ value: t, label: t }));
const KINDS: { value: Kind; label: string }[] = [{ value: '01', label: '숙소' }, { value: '02', label: '야영장' }];
const FLAGS = ['d', 'a', 'e', 'h'].map((k) => ({ value: k, label: FLAG_LABELS[k] }));
const SIDO_OPTS = SIDOS.map((s) => ({ value: s.code, label: s.name }));
const PEOPLE = [0, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => ({ value: n, label: n ? `${n}인 이상` : '제한 없음' }));
const NIGHTS = [1, 2, 3].map((n) => ({ value: n, label: `${n}박` }));

export function FilterBar({ filters: f, base, set, reset, locate, hasOrigin, favCount }: Props) {
  const [more, setMore] = useState(false);
  const min = base.from;
  const max = base.to;
  const clamp = (d: string) => (d < min ? min : d > max ? max : d);

  // 빠른 기간: 이번 주말, 다음 주말, 2주, 전체
  const nextSat = (offsetWeeks: number) => addDaysISO(min, (6 - dow(min) + 7) % 7 + offsetWeeks * 7);
  const quick = [
    { value: 'all', label: '전체 기간', from: min, to: max, weekend: false },
    { value: 'w0', label: '이번 주말', from: addDaysISO(nextSat(0), -1), to: nextSat(0), weekend: true },
    { value: 'w1', label: '다음 주말', from: addDaysISO(nextSat(1), -1), to: nextSat(1), weekend: true },
    { value: '2w', label: '앞으로 2주', from: min, to: addDaysISO(min, 13), weekend: false },
    { value: '4w', label: '앞으로 4주', from: min, to: addDaysISO(min, 27), weekend: false },
  ].map((q) => ({ ...q, from: clamp(q.from), to: clamp(q.to) }));
  const period = quick.find((q) => q.from === f.from && q.to === f.to)?.value ?? 'custom';
  const periodOpts = [...quick, ...(period === 'custom' ? [{ value: 'custom', label: '직접 선택' }] : [])];

  // 모바일에서 접혀 있는 보조 필터 중 켜진 개수
  const extra = [f.types.length, f.kinds.length, f.flags.length, f.people, f.weRate, f.wdRate].filter(Boolean).length;

  return (
    <section className={`filters${more ? ' more' : ''}`} aria-label="검색 조건">
      <div className="frow">
        <div className="field date">
          <label htmlFor="f-from">체크인</label>
          <input id="f-from" type="date" min={min} max={max} value={f.from}
            onChange={(e) => e.target.value && set({ from: clamp(e.target.value), to: f.to < e.target.value ? clamp(e.target.value) : f.to })} />
          <span aria-hidden>~</span>
          <input aria-label="체크인 기간 끝" type="date" min={f.from} max={max} value={f.to}
            onChange={(e) => e.target.value && set({ to: clamp(e.target.value) })} />
        </div>
        <Select id="f-period" label="기간" value={period} options={periodOpts}
          onChange={(v) => { const q = quick.find((x) => x.value === v); if (q) set({ from: q.from, to: q.to, weekend: q.weekend }); }} />
        <Select id="f-nights" label="숙박" value={f.nights} options={NIGHTS} onChange={(n) => set({ nights: n })} />
        <button className="chip" aria-pressed={f.weekend} onClick={() => set({ weekend: !f.weekend })}
          title="체크인 다음 날이 토·일·공휴일인 숙박만">
          주말·연휴만
        </button>
        <button className="chip" aria-pressed={f.wait} onClick={() => set({ wait: !f.wait })} title="대기 신청 가능한 날짜 포함">
          대기 포함
        </button>
        <button className="chip" aria-pressed={f.mine} onClick={() => set({ mine: !f.mine })}
          title="☆로 저장한 휴양림만 보기(이 브라우저에 저장)">
          <span aria-hidden>{f.mine ? '★' : '☆'}</span> 내 휴양림{favCount ? ` ${favCount}` : ''}
        </button>
        <span className="frow-sp" />
        <button className="chip" aria-pressed={hasOrigin} onClick={locate}><span aria-hidden>📍</span> 내 위치</button>
      </div>
      <div className="frow">
        <MultiSelect label="지역" options={SIDO_OPTS} value={f.sidos} onChange={(v) => set({ sidos: v })} allLabel="전국" />
        <div className="field search">
          <label htmlFor="f-q">검색</label>
          <input id="f-q" type="search" placeholder="휴양림·시군 이름" value={f.q} onChange={(e) => set({ q: e.target.value })} />
        </div>
        <button className="chip more-btn" aria-expanded={more} onClick={() => setMore((m) => !m)}>
          상세 조건{extra ? ` ${extra}` : ''} {more ? '▴' : '▾'}
        </button>
        <div className="frow-extra">
          <MultiSelect label="운영" options={TYPES} value={f.types} onChange={(v) => set({ types: v })} />
          <MultiSelect label="시설" options={KINDS} value={f.kinds} onChange={(v) => set({ kinds: v })} />
          <MultiSelect label="편의" options={FLAGS} value={f.flags} onChange={(v) => set({ flags: v })} allLabel="상관없음" />
          <Select id="f-people" label="인원" value={f.people} options={PEOPLE} onChange={(n) => set({ people: n })} />
          <Select id="f-we" label="주말예약률" value={f.weRate} options={RATE_CONDS} onChange={(v) => set({ weRate: v })} />
          <Select id="f-wd" label="평일예약률" value={f.wdRate} options={RATE_CONDS} onChange={(v) => set({ wdRate: v })} />
        </div>
        <button className="chip ghost" onClick={reset}><span aria-hidden>⟳</span> 초기화</button>
      </div>
    </section>
  );
}
