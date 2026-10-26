import { useEffect, useId, useRef, useState } from 'react';

interface Option<T extends string> { value: T; label: string }

interface Props<T extends string> {
  label: string;
  options: Option<T>[];
  value: T[];
  onChange: (v: T[]) => void;
  allLabel?: string;
}

// 여러 개를 고르는 드롭다운. 버튼에 선택 요약을 보여 주고, 펼치면 체크박스 목록이 나온다.
export function MultiSelect<T extends string>({ label, options, value, onChange, allLabel = '전체' }: Props<T>) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const names = options.filter((o) => value.includes(o.value)).map((o) => o.label);
  const summary = names.length === 0 ? allLabel : names.length === 1 ? names[0] : `${names[0]} 외 ${names.length - 1}`;
  const toggle = (v: T) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div className="dd" ref={box}>
      <button type="button" className={`dd-btn${names.length ? ' on' : ''}`} aria-haspopup="true" aria-expanded={open} aria-controls={id}
        onClick={() => setOpen((o) => !o)}>
        <span className="dd-k">{label}</span>
        <span className="dd-v">{summary}</span>
        <span className="dd-caret" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="dd-pop" id={id} role="group" aria-label={label}>
          {options.map((o) => (
            <label key={o.value} className="dd-opt">
              <input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} />
              <span>{o.label}</span>
            </label>
          ))}
          <div className="dd-foot">
            <button type="button" onClick={() => onChange([])} disabled={!value.length}>선택 해제</button>
            <button type="button" className="ok" onClick={() => setOpen(false)}>확인</button>
          </div>
        </div>
      )}
    </div>
  );
}

// 하나만 고르는 드롭다운은 모바일에서도 익숙한 기본 select를 쓴다.
export function Select<T extends string | number>({ label, value, options, onChange, id }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; id: string;
}) {
  const active = options[0] && value !== options[0].value;
  return (
    <div className={`field sel${active ? ' on' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={String(value)}
        onChange={(e) => onChange(options.find((o) => String(o.value) === e.target.value)!.value)}>
        {options.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
      </select>
    </div>
  );
}
