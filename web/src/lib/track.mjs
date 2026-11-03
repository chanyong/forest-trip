// GA4 이벤트 보내기(이슈 #11). 링크 클릭·알림 신청·의견 버튼은 public/track.js 가 모든 페이지에서 맡고,
// 여기서는 앱 안에서만 생기는 검색(search)을 보낸다. gtag 가 없으면(미리보기·로컬) 아무것도 하지 않는다.

const MAX_TERM = 40;

// 검색어에서 개인정보로 보일 수 있는 부분을 지운다: 이메일, 전화번호·긴 숫자(6자리 이상)
export function cleanSearchTerm(q) {
  let s = String(q ?? '').replace(/\s+/g, ' ').trim();
  s = s.replace(/[^\s@]+@[^\s@]+/g, '').replace(/\d[\d\s.-]{4,}\d/g, '').replace(/\s+/g, ' ').trim();
  return s.slice(0, MAX_TERM);
}

export function track(name, params = {}) {
  try {
    const g = typeof window !== 'undefined' ? window.gtag : undefined;
    if (typeof g === 'function') g('event', name, params);
  } catch { /* 통계 오류는 무시 */ }
}

// 앱의 검색어가 바뀔 때마다 부른다. 주소로 들어온 처음 검색어(skip)만 건너뛰고, 사용자가 한 번 바꾸면 그 뒤로는 모두 보낸다.
// skip: undefined(처음) → 처음 검색어 → null(바뀐 뒤). 다음 skip 과 보낼지(send)를 돌려준다.
export function searchStep(skip, q) {
  if (skip === undefined) return { skip: q, send: false };
  if (skip !== null && q === skip) return { skip, send: false };
  return { skip: null, send: true };
}

// 검색 실행: 같은 검색어를 연달아 보내지 않는다(검색어를 비우면 다시 보낸다). 보낸 검색어(정리된 것)를 돌려주고, 안 보냈으면 ''.
let last = '';
export function trackSearch(q, results) {
  const term = cleanSearchTerm(q);
  if (!term) { last = ''; return ''; }
  if (term === last) return '';
  last = term;
  track('search', { search_term: term, results });
  return term;
}
