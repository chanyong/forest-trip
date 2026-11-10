// 문단 유사도 점검 (이슈 #22): 어절 2-gram 자카드 유사도(0~1). 1에 가까울수록 같은 문단이다.
// 휴양림 이름·주소·객실 이름처럼 페이지마다 다른 부분이 문단에 얼마나 들어 있는지 본다.
const grams = (t) => {
  const w = String(t).replace(/[‘’'“”",.()·~]/g, ' ').split(/\s+/).filter(Boolean);
  const s = new Set();
  for (let i = 0; i < w.length - 1; i++) s.add(w[i] + ' ' + w[i + 1]);
  return s;
};
export function similarity(a, b) {
  const A = grams(a), B = grams(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return n / (A.size + B.size - n);
}
/** @param {{id:string,text:string}[]} items @returns {{max:number,pair:[string,string]|null,mean:number}} */
export function pairwise(items) {
  let max = 0, pair = null, sum = 0, cnt = 0;
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const s = similarity(items[i].text, items[j].text);
    sum += s; cnt++;
    if (s > max) { max = s; pair = [items[i].id, items[j].id]; }
  }
  return { max, pair, mean: cnt ? sum / cnt : 0 };
}
