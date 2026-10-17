// BROAD & WALL 앱 — 셸 · 티커 · 해시 라우터 · 부팅. 화면은 js/screens/*.js
import * as Q from "./quant.js";
import * as C from "./charts.js";
import * as V from "./vault.js";
import { $, $$, D, setMarket, esc } from "./core.js";
import { lobby, profile, strategies } from "./screens/home.js";
import { backtest, models, scenario } from "./screens/analysis.js";
import { portfolio } from "./screens/private.js";
import { publicView, dataView, connect, migrate } from "./screens/info.js";
import { desk } from "./screens/desk.js";

// ── 셸 ──
const NAV = [["", "1면", ""], ["desk", "투자 데스크", ""], ["profile", "투자성향", "A"], ["strategies", "전략", "B"], ["backtest", "검증", "C"], ["models", "예측", "D"], ["scenario", "위기", "E"], ["portfolio", "내 원장", "F"], ["public", "공개면", ""], ["data", "자료실", ""], ["connect", "증권 연결", ""]];
// 섹션 머리 문구 — 화면 모듈을 건드리지 않고 지면 문구만 바꾼다(null = 화면 원문 유지)
const COPY = {
  profile: ["A면 · 투자자 프로필", "당신이 견딜 수 있는 손실은 얼마인가", "여덟 개의 질문으로 감내할 수 있는 최대 낙폭을 정합니다. 답변은 이 브라우저에만 남고, 금융회사의 법정 적합성 진단을 대신하지 않습니다."],
  strategies: ["B면 · 전략 편람", "여섯 개의 규칙, 하나의 원칙", "모든 전략은 월말에 알 수 있는 정보만으로 다음 달 비중을 정합니다. 파라미터는 1973–1999년 학습 구간에서만 골랐고, 그 뒤의 구간은 손대지 않았습니다."],
  backtest: ["C면 · 검증 보고서", null, null],
  models: ["D면 · 예측 실험실", "다섯 개의 모델, 정직한 성적표", "다음 달 미국 주식의 방향을 맞힐 수 있는가. 매년 1월 그때까지의 자료로만 다시 학습시키는 워크포워드 방식으로 검증했고, 기준선을 넘지 못하면 그대로 적습니다."],
  scenario: ["E면 · 위기의 기록", "그해, 그 비중이었다면", "오일쇼크부터 2022년 금리 급등까지 실제 위기 구간의 월간 수익을 지금 비중에 그대로 대입합니다. 월평균 지수라 일중 최저점보다 낙폭이 작게 나옵니다."],
  data: ["자료실", "숫자의 출처를 밝힙니다", null],
  connect: ["증권 연결 데스크", "연결되지 않은 것은 연결됐다고 쓰지 않습니다", null],
  migrate: ["이관 안내", "지난 판의 기록을 옮깁니다", null],
};
function shell() {
  document.body.insertAdjacentHTML("afterbegin", `
  <div class="tape" role="marquee" aria-label="월간 지표 테이프(지연 데이터)"><div class="clock mono"><i id="nyDot"></i><span id="nyClock">NEW YORK —</span></div><div class="rail"><div class="run mono" id="tapeRun"></div></div></div>
  <header class="mast"><div class="wrap top">
    <span class="ear">${new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(new Date())}<br><i>Discipline over Prediction</i></span>
    <a class="np" href="#/" aria-label="BROAD &amp; WALL 1면">Broad &amp; Wall</a>
    <span class="ear r"><span class="ear-t">퀀트 리서치 데스크<br><i>월간판 · 투자 권유 아님</i></span><button class="menu-btn" aria-expanded="false" aria-controls="nav">섹션</button><button class="theme-btn" id="themeBtn" aria-label="밝기 전환">◐</button></span>
  </div>
    <nav class="main" id="nav" aria-label="섹션">${NAV.map(([h, t, rn]) => `<a href="#/${h}" data-r="${h}" class="${h === "portfolio" ? "lock" : ""}">${rn ? `<em>${rn}</em>` : ""}${t}</a>`).join("")}<a href="/classic/" title="이전 버전(보존)">지난 판</a></nav>
  </header>
  <main id="main" tabindex="-1"></main>
  <footer class="colophon"><div class="wrap">
    <div><b class="np-s">Broad &amp; Wall</b>퀀트 리서치 데스크 — 투자 판단을 돕는 교육·분석 지면입니다. 투자 권유가 아니며, 과거 성과는 미래 수익을 보장하지 않습니다. 모든 시세는 <strong>월간 지연 데이터</strong>이며 실시간이 아닙니다.</div>
    <div><b>데이터</b>Robert Shiller · Federal Reserve H.15 · World Bank · BLS (ODC-PDDL). <a href="#/data">출처·품질 검증</a></div>
    <div><b>보안</b>보유 자산은 이 브라우저 안에서만 암호화 저장됩니다. 공개 화면에는 금액·계좌 정보가 나오지 않습니다. <a href="#/connect">연동 상태</a></div>
  </div></footer>`);
  $(".menu-btn").onclick = (e) => { const n = $("#nav"); n.classList.toggle("open"); e.currentTarget.setAttribute("aria-expanded", n.classList.contains("open")); };
  $("#themeBtn").onclick = () => { const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); document.documentElement.dataset.theme = cur === "dark" ? "light" : "dark"; try { localStorage.setItem("meridian.v2.theme", document.documentElement.dataset.theme); } catch {} };
  try { const t = localStorage.getItem("meridian.v2.theme"); if (t) document.documentElement.dataset.theme = t; } catch {}
  clock(); setInterval(clock, 15000);
}
function clock() { // 뉴욕 현지 시각(브라우저 시계 기준). 정규장 판정은 공휴일을 반영하지 않는다.
  const now = new Date(), p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false }).formatToParts(now).map((x) => [x.type, x.value]));
  const mins = Number(p.hour) * 60 + Number(p.minute), open = !["Sat", "Sun"].includes(p.weekday) && mins >= 570 && mins < 960;
  $("#nyClock").textContent = `NEW YORK ${p.weekday.toUpperCase()} ${p.hour}:${p.minute} ET · NYSE ${open ? "정규장 시간" : "장 마감 시간"}`;
  $("#nyDot").className = open ? "on" : "";
}
function tape() {
  const t = D.dates.length - 1, v = Q.viewAt(D, t), row = (l, val, ch) => `<span>${l}<b>${val}</b><em class="${ch >= 0 ? "up" : "dn"}">${ch >= 0 ? "▲" : "▼"} ${C.pct(ch)}</em></span>`;
  const items = [
    row("S&amp;P 500", D.px.EQ[t].toLocaleString("en-US", { maximumFractionDigits: 0 }), D.px.EQ[t] / D.px.EQ[t - 1] - 1),
    row("GOLD $/oz", D.px.GD[t].toLocaleString("en-US", { maximumFractionDigits: 0 }), D.px.GD[t] / D.px.GD[t - 1] - 1),
    `<span>UST 10Y<b>${D.y10[t].toFixed(2)}%</b><em class="${D.y10[t] - D.y10[t - 1] >= 0 ? "up" : "dn"}">${(D.y10[t] - D.y10[t - 1] >= 0 ? "+" : "") + (D.y10[t] - D.y10[t - 1]).toFixed(2)}%p</em></span>`,
    `<span>US CPI YoY<b>${C.pctU(v.cpi(t - 1) / v.cpi(t - 13) - 1)}</b><em class="lag">(${D.dates[t - 1]} 발표분)</em></span>`,
    row("S&amp;P 12M", "", v.cumRet("EQ", 12)), row("GOLD 12M", "", v.cumRet("GD", 12)),
    `<span class="lag">월간 데이터 · ${D.end} 기준 · 실시간 아님</span>`,
  ].join("");
  $("#tapeRun").innerHTML = items + items;
}

// ── 라우터 ──
const ROUTES = { "": lobby, desk, profile, strategies, backtest, models, scenario, portfolio, public: publicView, data: dataView, connect, migrate };
function route() {
  const [name, arg] = location.hash.replace(/^#\/?/, "").split("/");
  const fn = ROUTES[name] || lobby, main = $("#main");
  $$("nav.main a").forEach((a) => (a.dataset.r === name ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  $("#nav").classList.remove("open");
  document.body.dataset.route = ROUTES[name] ? name : "";
  const draw = () => { main.innerHTML = ""; fn(main, arg); edit(main, name); scrollTo({ top: 0 }); document.title = (fn.title || "1면") + " — BROAD & WALL"; };
  document.startViewTransition ? document.startViewTransition(draw) : draw();
}


function edit(main, name) { // 섹션 문구 교체(첫 kicker · h1 · lede)
  const c = COPY[name]; if (!c) return; const [k, h, l] = c, put = (sel, v) => { const e = main.querySelector(sel); if (e && v) e.textContent = v; };
  put(".kicker", k); put("h1", h); put(".lede", l);
}
new MutationObserver(() => $$(".scroll:not([tabindex])").forEach((e) => { e.tabIndex = 0; e.setAttribute("role", "region"); e.setAttribute("aria-label", "표 — 가로 스크롤"); })).observe(document.documentElement, { childList: true, subtree: true });

// ── 부팅 ──
(async () => {
  shell();
  try { setMarket(await (await fetch("data/market.json")).json()); }
  catch (e) { $("#main").innerHTML = `<div class="wrap page"><p class="note warn">시장 데이터를 불러오지 못했습니다: ${esc(e.message)}</p></div>`; return; }
  tape(); addEventListener("hashchange", route); addEventListener("vault:lock", () => { if (location.hash.startsWith("#/portfolio")) route(); }); route();
})();
