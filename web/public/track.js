/* 숲가자 GA4 전환 이벤트(이슈 #11). 모든 페이지에서 GA 설정 바로 뒤에 불러온다.
 * 새 추적 도구 없이 기존 gtag 만 쓴다. gtag 가 없는 곳(미리보기·로컬)에서는 아무것도 보내지 않는다.
 *  - affiliate_click {partner, item, link_domain}: 외부 예약 링크(숲나들e) 클릭. item 은 가장 가까운 data-ga-item(휴양림 이름), 없으면 'site'
 *  - outbound_click {link_domain, link_url}: 그 밖의 외부 사이트 이동. link_url 은 쿼리 없이 주소·경로만
 *  - feedback_open: 공통 '의견·질문 남기기' 버튼(ddalkkakrank.kr/feedback.js, #site-feedback 안 .open-btn)
 *  - alert_signup {method, site}: 공통 알림 모듈(alerts.js)이 신청 완료 때 보내는 alert_subscribe 를 받아 함께 보낸다
 * 검색(search)은 앱(src/lib/track.mjs)에서 보낸다. 검사: scripts/track.test.mjs
 */
(function () {
  'use strict';
  if (window.__supTrack) return;
  window.__supTrack = true;

  var PARTNERS = { 'foresttrip.go.kr': 'foresttrip' };

  function send(name, params) {
    try { if (typeof window.gtag === 'function') window.gtag('event', name, params || {}); } catch { /* 통계 오류는 무시 */ }
  }

  function partnerOf(host) {
    for (var d in PARTNERS) if (host === d || host.slice(-(d.length + 1)) === '.' + d) return PARTNERS[d];
    return '';
  }

  // 공통 알림 모듈의 신청 완료 이벤트(alert_subscribe)를 이 사이트의 핵심 이벤트 이름(alert_signup)으로도 보낸다
  var g = window.gtag;
  if (typeof g === 'function' && !g.__sup) {
    var wrapped = function (cmd, name, params) {
      var r = g.apply(this, arguments);
      if (cmd === 'event' && name === 'alert_subscribe') g('event', 'alert_signup', { method: 'email', site: (params && params.site) || location.hostname });
      return r;
    };
    wrapped.__sup = true;
    window.gtag = wrapped;
  }

  document.addEventListener('click', function (e) {
    var path = typeof e.composedPath === 'function' ? e.composedPath() : [];
    for (var i = 0; i < path.length; i++) {
      var n = path[i];
      if (n && n.classList && n.classList.contains('open-btn') && n.getRootNode && n.getRootNode().host && n.getRootNode().host.id === 'site-feedback') {
        send('feedback_open', {});
        return;
      }
    }
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var u;
    try { u = new URL(a.getAttribute('href'), location.href); } catch { return; }
    if ((u.protocol !== 'http:' && u.protocol !== 'https:') || u.hostname === location.hostname) return;
    var partner = partnerOf(u.hostname);
    if (partner) {
      var it = a.closest('[data-ga-item]');
      send('affiliate_click', { partner: partner, item: (it && it.getAttribute('data-ga-item')) || 'site', link_domain: u.hostname });
    } else {
      send('outbound_click', { link_domain: u.hostname, link_url: u.origin + u.pathname });
    }
  }, true);
})();
