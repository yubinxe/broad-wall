// 부팅 감시(일반 스크립트) — 모듈이 못 뜨면 빈 화면 대신 원인을 보여 준다.
(function () {
  var box = function () { return document.getElementById("boot"); };
  var show = function (msg) { var b = box(); if (!b) return; b.className = "boot err"; b.innerHTML = "<b>화면을 그리지 못했습니다.</b><br>" + String(msg).replace(/[<>&]/g, "") + "<br><small>새로고침(⌘⇧R) 후에도 같으면 이 문구를 캡처해 보내 주세요. 브라우저: " + navigator.userAgent.replace(/[<>&]/g, "") + "</small>"; };
  window.__bootErr = show;
  window.addEventListener("error", function (e) { if (!window.__booted) show((e.message || "스크립트 오류") + (e.filename ? " @ " + e.filename.split("/").slice(-2).join("/") + ":" + e.lineno : "")); }, true);
  window.addEventListener("unhandledrejection", function (e) { if (!window.__booted) show(e.reason && e.reason.message || e.reason); });
  setTimeout(function () { if (!window.__booted) show("10초 안에 앱이 시작되지 않았습니다(모듈 로드 실패 또는 차단)."); }, 10000);
})();
