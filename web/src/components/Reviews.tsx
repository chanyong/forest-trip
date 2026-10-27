import { compactNum, naverPlaceUrl, type Forest } from '../lib/data';

// 네이버 플레이스 리뷰 요약. 누르면 네이버 리뷰 페이지로 이동한다.
export function Reviews({ forest, compact = false }: { forest: Forest; compact?: boolean }) {
  const n = forest.naver;
  if (!n) return null;
  const label = `네이버 리뷰: 방문자 ${n.v.toLocaleString()}개, 블로그 ${n.b.toLocaleString()}개${n.s ? `, 별점 ${n.s}` : ''} (새 창)`;
  return (
    <a className="rv" href={naverPlaceUrl(forest)} target="_blank" rel="noreferrer" title={label}
      onClick={(e) => e.stopPropagation()}>
      <span className="rv-n" aria-hidden>N</span>
      <span className="sr-only">네이버</span>
      {n.s ? <span className="rv-s"><span aria-hidden>★</span><span className="sr-only">별점 </span>{n.s.toFixed(2)}</span> : null}
      {n.v > 0 && <span>리뷰 {compactNum(n.v)}</span>}
      {(!compact || !n.v) && <span className="rv-b">블로그 {compactNum(n.b)}</span>}
      <span className="sr-only">(새 창)</span>
    </a>
  );
}
