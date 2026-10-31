// 운영자의 다른 서비스(하단 상호 링크) 목록을 만든다. 데이터는 network.json 한 곳.
// 웹(App.tsx)·정적 페이지 생성(scripts/build-static.mjs)·테스트(scripts/network.test.mjs)가 같이 쓴다. (이슈 #2)
// - 현재 사이트(self)는 뺀다.
// - utm 은 URL API 로 붙인다: 주소에 경로·쿼리(?)가 있어도 &로 이어 붙어 깨지지 않는다.
const key = (u) => new URL(u).href;

export function networkLinks(network) {
  const self = key(network.self);
  return network.sites
    .filter((s) => key(s.url) !== self)
    .map((s) => {
      const u = new URL(s.url);
      u.searchParams.set('utm_source', network.utm.source);
      u.searchParams.set('utm_medium', network.utm.medium);
      return { ...s, href: u.toString() };
    });
}
