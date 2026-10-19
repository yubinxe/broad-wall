// 부팅 감시(일반 스크립트) — 앱 번들을 직접 붙이고, 못 뜨면 한 번 자동으로 다시 열고, 그래도 안 되면 원인을 보여 준다.
(function () {
  var me = document.currentScript, RK = "bw.retry";
  var box = function () { return document.getElementById("boot"); };
  var reset = function () { ["meridian.v2.settings", "meridian.v2.watch", "meridian.v2.theme"].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} }); location.replace(location.pathname + "?r=" + Date.now() + location.hash); };
  var show = function (msg) { var b = box(); if (!b) return; b.className = "boot err"; b.innerHTML = "<b>화면을 그리지 못했습니다.</b><br>" + String(msg).replace(/[<>&]/g, "") + "<br><small>브라우저: " + navigator.userAgent.replace(/[<>&]/g, "") + "</small><br><button type=\"button\" id=\"bootReset\">화면 설정 초기화 후 다시 열기</button>"; var r = document.getElementById("bootReset"); if (r) r.onclick = reset; };
  // 네트워크가 잠깐 끊겨 번들을 못 받으면 한 번만 자동 새로고침(무한 반복 방지)
  var fail = function (msg) {
    if (window.__booted) return;
    var tried = false; try { tried = sessionStorage.getItem(RK) === "1"; sessionStorage.setItem(RK, "1"); } catch (e) { tried = true; }
    if (!tried) { var b = box(); if (b) b.innerHTML = "<b>Broad &amp; Wall</b><br>연결을 다시 시도하는 중…"; location.reload(); return; }
    show(msg);
  };
  window.__bootErr = show;
  window.addEventListener("error", function (e) { if (window.__booted || e.target !== window || !e.filename || e.filename.indexOf(location.origin) !== 0) return; show((e.message || "스크립트 오류") + " @ " + e.filename.split("/").slice(-2).join("/") + ":" + e.lineno); });
  var s = document.createElement("script"); s.type = "module"; s.src = me.getAttribute("data-app");
  s.onerror = function () { fail("앱 파일을 받지 못했습니다(네트워크 끊김 또는 차단)."); };
  document.head.appendChild(s);
  setTimeout(function () { fail("15초 안에 앱이 시작되지 않았습니다(느린 네트워크 또는 차단)."); }, 15000);
})();
