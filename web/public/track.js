/* 숲가자 GA4 전환 이벤트(이슈 #11). 모든 페이지에서 GA 설정 바로 뒤에 불러온다.
 * 새 추적 도구 없이 기존 gtag 만 쓴다. gtag 가 없는 곳(미리보기·로컬)에서는 아무것도 보내지 않는다.
 *  - affiliate_click {partner, item, link_domain}: 예약 링크(숲나들e, data-ga-item 을 단 링크나 그 안쪽) 클릭. item 은 data-ga-item 값(휴양림 이름 또는 'site')
 *  - outbound_click {link_domain, link_url}: 그 밖의 외부 사이트 이동. link_url 은 쿼리 없이 주소·경로만
 *  - feedback_open: 공통 '의견·질문 남기기' 버튼(ddalkkakrank.kr/feedback.js, #site-feedback 안 .open-btn)
 *  - alert_signup {method, site}: 공통 알림 모듈(alerts.js)이 신청 완료 때 보내는 alert_subscribe 를 받아 함께 보낸다
 * 검색(search)은 앱(src/lib/track.mjs)에서 보낸다. 검사: scripts/track.test.mjs
 * 주소의 검색어 매개변수(q)는 GA 로 보내지 않는다(이슈 #11 대표 결정 A): page_location 을 q 뺀 주소로 set 하고
 * 주소가 바뀔 때(pushState·replaceState·popstate)마다 다시 set 한다. 첫 page_view 는 index.html 의 config 가 같은 방식으로 뺀다.
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

  // 주소에서 q 만 뺀다. 다른 매개변수는 글자 그대로(utm_* 인코딩을 바꾸지 않으려고 문자열로 거른다), 해시도 그대로. 읽을 수 없는 주소는 그대로
  function pageLocation(href) {
    try {
      var u = new URL(href);
      if (!u.searchParams.has('q')) return href;
      u.search = u.search.slice(1).split('&').filter(function (p) {
        var k = p.split('=')[0].replace(/\+/g, ' ');
        try { k = decodeURIComponent(k); } catch { /* 그대로 비교 */ }
        return k !== 'q';
      }).join('&');
      return u.href;
    } catch { return href; }
  }

  var lastLoc = '';
  function syncLoc(href) {
    var v = pageLocation(href);
    if (v === lastLoc || typeof window.gtag !== 'function') return;
    try { window.gtag('set', { page_location: v }); lastLoc = v; } catch { /* 통계 오류는 무시 */ }
  }
  syncLoc(location.href);
  // 주소가 바뀌기 전에 새 주소로 set 해 두고(향상된 측정의 기록 기반 page_view 가 먼저 읽도록), 끝나면 실제 주소로 맞춘다
  ['pushState', 'replaceState'].forEach(function (m) {
    var orig = window.history && window.history[m];
    if (typeof orig !== 'function') return;
    window.history[m] = function (state, title, url) {
      if (url != null) { try { syncLoc(new URL(String(url), location.href).href); } catch { /* 실제 주소로 아래에서 맞춤 */ } }
      try { return orig.apply(this, arguments); } finally { syncLoc(location.href); }
    };
  });
  window.addEventListener('popstate', function () { syncLoc(location.href); }, true);

  // event 에 page_location 이 없고 지금 주소에 q 가 있으면 q 뺀 주소를 넣는다(alerts.js·앱 등 다른 모듈 이벤트까지)
  function withLoc(params) {
    var v = pageLocation(location.href);
    if (v === location.href || (params && params.page_location !== undefined)) return params;
    var o = {};
    for (var k in params || {}) o[k] = params[k];
    o.page_location = v;
    return o;
  }

  // 공통 알림 모듈의 신청 완료 이벤트(alert_subscribe)를 이 사이트의 핵심 이벤트 이름(alert_signup)으로도 보낸다
  var g = window.gtag;
  if (typeof g === 'function' && !g.__sup) {
    var wrapped = function (cmd, name, params) {
      var args = Array.prototype.slice.call(arguments);
      var p = cmd === 'event' ? withLoc(params) : params;
      if (p !== params) args[2] = p;
      var r = g.apply(this, args);
      if (cmd === 'event' && name === 'alert_subscribe') g('event', 'alert_signup', withLoc({ method: 'email', site: (params && params.site) || location.hostname }));
      return r;
    };
    wrapped.__sup = true;
    window.gtag = wrapped;
  }

  function linkClick(e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var u;
    try { u = new URL(a.getAttribute('href'), location.href); } catch { return; }
    if ((u.protocol !== 'http:' && u.protocol !== 'https:') || u.hostname === location.hostname) return;
    // 예약 링크로 표시한 것(data-ga-item)만 affiliate_click. 같은 foresttrip.go.kr 이라도 휴양림 홈페이지 링크는 outbound_click
    var partner = partnerOf(u.hostname);
    var it = partner ? a.closest('[data-ga-item]') : null;
    if (it) {
      send('affiliate_click', { partner: partner, item: it.getAttribute('data-ga-item') || 'site', link_domain: u.hostname });
    } else {
      send('outbound_click', { link_domain: u.hostname, link_url: u.origin + u.pathname });
    }
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
    linkClick(e);
  }, true);
  // 가운데 버튼으로 새 탭에 연 링크(click 이 생기지 않는다)도 같은 링크 이벤트로 센다
  document.addEventListener('auxclick', function (e) { if (e.button === 1) linkClick(e); }, true);
})();
