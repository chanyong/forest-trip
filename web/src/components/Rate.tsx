import type { Rate } from '../lib/data';

const tone = (v: number) => (v >= 90 ? 'hot' : v >= 70 ? 'warm' : v >= 40 ? 'mid' : 'cool');

function Bar({ label, v }: { label: string; v: number | null }) {
  if (v == null) return <span className="rate-item na">{label} -</span>;
  return (
    <span className={`rate-item ${tone(v)}`}>
      <span className="rate-k">{label}</span>
      <span className="rate-bar" aria-hidden><i style={{ width: `${v}%` }} /></span>
      <b>{v}%</b>
    </span>
  );
}

// 수집 기간 동안 예약을 받는 날 중 이미 예약된 비율(주말 = 금·토·공휴일 전날 체크인)
export function RateBars({ rate }: { rate: Rate }) {
  if (rate.we == null && rate.wd == null) return null;
  return (
    <span className="rate" title="수집 기간 중 예약 받는 날 대비 이미 예약된 비율. 주말은 체크인 다음 날이 토·일·공휴일인 숙박">
      <span className="sr-only">예약률</span>
      <Bar label="주말" v={rate.we} />
      <Bar label="평일" v={rate.wd} />
    </span>
  );
}
