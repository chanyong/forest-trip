import { fmtWon, kindName, type KindPrice } from '../lib/data';

// 휴양림의 주말 1박 평균 요금. 숙소·야영장이 다 있으면 둘 다 짧게 보여 준다.
export function Price({ prices }: { prices: KindPrice[] }) {
  if (!prices.length) return null;
  const full = prices.map((p) => `${kindName(p.kind)} ${fmtWon(p.won)}`).join(' · ');
  const text = prices.length === 1
    ? `${prices[0].kind === '01' ? '숙소' : '야영'} 주말 ${fmtWon(prices[0].won)}`
    : prices.map((p) => `${p.kind === '01' ? '숙소' : '야영'} ${fmtWon(p.won).replace('원', '')}`).join(' · ');
  return (
    <span className="gprice" title={`주말 1박 평균 요금(비수기 주말 기준) · ${full}`}>
      <span aria-hidden>{text}</span>
      <span className="sr-only">주말 1박 평균 요금 {full}</span>
    </span>
  );
}
