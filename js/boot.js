// 부팅 감시(일반 스크립트) — 모듈이 못 뜨면 빈 화면 대신 원인을 보여 준다.
(function () {
  var box = function () { return document.getElementById("boot"); };
  var show = function (msg) { var b = box(); if (!b) return; b.className = "boot err"; b.innerHTML = "<b>화면을 그리지 못했습니다.</b><br>" + String(msg).replace(/[<>&]/g, "") + "<br><small>새로고침(⌘⇧R) 후에도 같으면 이 문구를 캡처해 보내 주세요. 브라우저: " + navigator.userAgent.replace(/[<>&]/g, "") + "</small><br><button type=\"button\" id=\"bootReset\">화면 설정 초기화 후 다시 열기</button>"; var r = document.getElementById("bootReset"); if (r) r.onclick = reset; };
  // 화면 설정만 지우고(암호화 원장 meridian.v2.vault 보존) 캐시를 피해 다시 연다
  var reset = function () { ["meridian.v2.settings", "meridian.v2.watch", "meridian.v2.theme"].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} }); location.replace(location.pathname + "?r=" + Date.now() + location.hash); };
  window.__bootErr = show;
  // 확장 프로그램(일반 창에서만 켜짐)·외부 리소스 오류는 무시하고, 이 사이트 스크립트의 오류만 보여 준다
  var mine = function (f) { return !f || f.indexOf(location.origin) === 0; };
  window.addEventListener("error", function (e) { if (window.__booted || e.target !== window || !mine(e.filename) || !e.filename) return; show((e.message || "스크립트 오류") + " @ " + e.filename.split("/").slice(-2).join("/") + ":" + e.lineno); });
  window.addEventListener("unhandledrejection", function (e) { var st = (e.reason && e.reason.stack) || ""; if (!window.__booted && st.indexOf(location.origin) >= 0) show(e.reason.message || e.reason); });
  setTimeout(function () { if (!window.__booted) show("10초 안에 앱이 시작되지 않았습니다(모듈 로드 실패 또는 차단)."); }, 10000);
})();
