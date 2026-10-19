// 1면 · A 성향 · B 전략
import * as Q from "../quant.js";
import * as C from "../charts.js";
import { $, $$, esc, settings, saveSettings, market, D, cache, run, bench, profileResult, currentWeights, norm, costForm, bindCost, refresh } from "../core.js";
import * as R from "../profile.js";
import * as V from "../vault.js";
import { thermometer } from "../desk.js";
import { brief } from "../brief.js";
import * as T from "../topics.js";

// ── 1면 (로비) — 브리핑 · 1면 오늘의 쟁점 · 2면 경제·증시 · 3면 국제·지정학. 쟁점마다 판단 근거(과거 사례·지표)를 붙인다 ──
const ago = (t) => { const m = Math.round((Date.now() - t) / 6e4); return m < 60 ? `${Math.max(m, 1)}분 전` : m < 1440 ? `${Math.round(m / 60)}시간 전` : `${Math.round(m / 1440)}일 전`; };
export function lobby(el) {
  const t = D.dates.length - 1, v = Q.viewAt(D, t);
  const today = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(new Date());
  const ch = (a) => D.px[a][t] / D.px[a][t - 1] - 1, cls = (x) => (x >= 0 ? "pos" : "neg"), th = thermometer(D, market);
  el.innerHTML = `<div class="wrap front">
  <div class="dateline"><span>제1권 · 제${D.end.replace("-", "")}호</span><span>뉴욕 · 서울 &nbsp;|&nbsp; ${today}</span><span>시세 실시간 · 지표 ${D.end} 월간</span></div>
  <section class="brief" id="brief" aria-label="오늘의 브리핑"></section>
  <div class="fp"><article class="lead" id="p1" aria-label="1면 오늘의 쟁점"><p class="kicker">1면 · 오늘의 쟁점</p><span class="spin"></span></article>
  <aside class="rail">
    <h4>시장 요약 <small>월간 · ${D.end}</small></h4>
    <table class="mkt"><tbody>
      <tr><td>S&amp;P 500</td><td>${D.px.EQ[t].toLocaleString("en-US", { maximumFractionDigits: 0 })} <b class="${cls(ch("EQ"))}">${C.pct(ch("EQ"))}</b></td></tr>
      <tr><td>금 ($/oz)</td><td>${D.px.GD[t].toLocaleString("en-US", { maximumFractionDigits: 0 })} <b class="${cls(ch("GD"))}">${C.pct(ch("GD"))}</b></td></tr>
      <tr><td>미 국채 10년</td><td>${D.y10[t].toFixed(2)}%</td></tr>
      <tr><td>미 CPI 전년비</td><td>${C.pctU(v.cpi(t - 1) / v.cpi(t - 13) - 1)} <small>(${D.dates[t - 1]})</small></td></tr>
    </tbody></table>
    <h4 style="margin-top:22px">이번 달 규칙 신호 <small>주식·채권·금</small></h4>
    <table class="mkt sig"><tbody>
    ${Object.keys(Q.STRATEGIES).filter((k) => k !== "eq").map((k) => { const w = norm(currentWeights(k)); return `<tr><td><a href="#/backtest/${k}">${Q.STRATEGIES[k].name}</a></td><td>${[w.EQ, w.BD, w.GD].map((x) => Math.round(x * 100)).join(" · ")}</td></tr>`; }).join("")}
    </tbody></table>
    <div class="deskbox"><h4>투자 데스크 <small>이번 달 점검</small></h4>
    <ul><li>S&amp;P 500 고점 대비 <b>${th.now.dd > -0.0005 ? "최고치" : C.pct(th.now.dd)}</b></li><li>주식 추세 <b class="${cls(th.now.trendEQ)}">${th.now.trendEQ >= 0 ? "10개월선 위" : "10개월선 아래"}</b></li><li>실질금리 <b>${C.pct(th.now.real, 2)}</b></li><li>12개월 수익 1위 <b>${Q.ASSET_LABEL[th.rank[0]]}</b></li></ul>
    <a class="btn sm" href="#/desk">리밸런싱 주문서 →</a> <a class="btn sm ghost" href="#/risk" style="margin-top:6px">리스크 상황실 →</a></div>
  </aside></div>
  <section class="pg" id="p2" aria-label="2면 경제·증시"><h2 class="pg-h"><span>2면</span>경제 · 증시 <small>금리 · 무역 · 신용 · 원자재 · 반도체 · 환율</small></h2><div class="pg-g"><span class="spin"></span></div></section>
  <section class="pg" id="p3" aria-label="3면 국제·지정학"><h2 class="pg-h"><span>3면</span>국제 · 지정학 <small>전쟁 · 정치·시위 · 감염병</small></h2><div class="pg-g"><span class="spin"></span></div></section>
  <p class="cap">쟁점 분류는 언론사 RSS 제목의 키워드 일치로만 합니다. 판단 근거는 이 사이트의 월간 자료(미국 주식·10년 국채·금)와 과거 사례 계산이며 예측·투자 권유가 아닙니다. 기사 원문·저작권은 각 언론사에 있습니다.</p>
  </div>`;
  const newsP = fetch("/api/news?topic=all").then((r) => r.json());
  let quotes = null; const onQ = (e) => { quotes = e.detail; el.querySelectorAll("[data-live]").forEach(live); };
  const root = el.firstElementChild; addEventListener("bw:quotes", onQ); new MutationObserver((_, o) => { if (!root.isConnected) { removeEventListener("bw:quotes", onQ); o.disconnect(); } }).observe(el, { childList: true });
  const live = (n) => { // 시세 응답이 오면 환율·관심종목 칸을 채운다
    if (!quotes) return; const k = n.dataset.live;
    if (k === "fx") { const r = quotes.fx?.rates || {}; n.innerHTML = r.KRW ? `원/달러 <b>${r.KRW.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}</b> · 엔/달러 <b>${r.JPY?.toFixed(2) ?? "—"}</b> <small>(ECB ${esc(quotes.fx.date || "")})</small>` : "환율 응답 없음"; }
    if (k === "wl") { const ps = (quotes.prices || []).slice(0, 5); n.innerHTML = ps.length ? `<b>관심종목 오늘</b> — ` + ps.map((p) => `${esc(p.name || p.symbol)} <b class="${p.chg == null ? "" : p.chg >= 0 ? "pos" : "neg"}">${p.chg == null ? Number(p.price).toLocaleString("en-US", { maximumFractionDigits: 2 }) : (p.chg >= 0 ? "+" : "") + (p.chg * 100).toFixed(1) + "%"}</b>`).join(" · ") : "관심종목 시세를 불러오지 못했습니다"; }
  };
  const S = (r) => (r == null ? "—" : C.pct(r));
  const insight = (tp) => { // 쟁점별 판단 근거 — 수치는 모두 사이트 자료에서 계산
    const L = [], an = T.analog(D, tp);
    if (an) { const s = an.sum, up = s.after12.EQ; L.push(`<li><b>과거 비슷한 사건 ${an.rows.length}건</b> — 사건 기간 S&amp;P 500 중앙값 <b class="${cls(s.during.EQ.med)}">${S(s.during.EQ.med)}</b>(최악 ${S(s.during.EQ.worst)}), 채권 ${S(s.during.BD.med)}, 금 ${S(s.during.GD.med)}. 종료 12개월 뒤 주식이 오른 경우 ${up.n ? `${Math.round(up.up * up.n)}/${up.n}건` : "—"}(중앙값 ${S(up.med)}).</li>`); }
    if (tp.id === "rates") L.push(`<li><b>금리 위치</b> — 미 10년 ${C.pctU(th.now.y10, 2)}, 실질금리 ${C.pct(th.now.real, 2)}(1974년 이후 상위 ${Math.round((1 - th.pct.real) * 100)}%). 채권 12개월 ${S(th.mom.BD)}.</li>`);
    if (["chips", "trade", "rates", "fin"].includes(tp.id)) L.push(`<li><b>주식 체력</b> — S&amp;P 500 10개월선 ${th.now.trendEQ >= 0 ? "위" : "아래"}(${S(th.now.trendEQ)}), 고점 대비 ${th.now.dd > -0.0005 ? "최고치" : S(th.now.dd)}, 12개월 변동성 과거 ${Math.round(th.pct.vol * 100)}분위.</li>`);
    if (tp.id === "oil") L.push(`<li><b>원자재 연동</b> — 금 10개월선 ${th.now.trendGD >= 0 ? "위" : "아래"}(${S(th.now.trendGD)}), 미 CPI 전년비 ${C.pctU(th.now.infl)}. 유가 충격은 물가→금리 경로로 채권에도 번진다.</li>`);
    if (tp.id === "fx") L.push(`<li data-live="fx">환율 불러오는 중…</li><li><b>원화 투자자</b> — 달러 강세는 해외자산 원화 평가액을 올리고, 새로 사는 달러 자산은 비싸게 만든다. 환전은 나눠서.</li>`);
    if (tp.id === "chips") L.push(`<li data-live="wl">관심종목 불러오는 중…</li>`);
    const act = tp.risk ? `<a href="#/risk" data-rt="${tp.risk}">리스크 상황실에서 내 비중 대입 →</a>` : `<a href="#/desk">투자 데스크 신호 확인 →</a>`;
    return `<div class="ins"><b class="ins-h">판단 근거</b><ul>${L.join("") || "<li>대응하는 과거 사례·지표가 없습니다. 규칙 신호가 바뀌었는지만 확인합니다.</li>"}</ul><p class="ins-a">${act}</p></div>`;
  };
  const story = (tp, n, cnt = tp.items.length) => `<article class="story"><h3>${esc(tp.name)} <small>기사 ${cnt}건</small></h3>
    <ol class="hl">${tp.items.slice(0, n).map((a) => `<li><a href="${esc(a.link)}" target="_blank" rel="noopener noreferrer">${esc(a.title)}</a><small>${esc(a.src)} · ${a.t ? ago(a.t) : ""}</small></li>`).join("")}</ol>${insight(tp)}</article>`;
  const fill = (id, list, empty) => { el.querySelector(`#${id} .pg-g`).innerHTML = list.length ? list.map((tp) => story(tp, 4)).join("") : `<p class="muted small">${empty}</p>`; };
  newsP.then((j) => {
    const all = T.classify([...(j.kr || []), ...(j.us || []), ...(j.world || [])]), top = all[0], rest = all.slice(1);
    el.querySelector("#p1").innerHTML = top ? `<p class="kicker">1면 · 오늘의 쟁점 · 헤드라인 ${all.reduce((s, x) => s + x.items.length, 0)}건 중 최다</p><h1 class="hed">${esc(top.name)}</h1><p class="dek">${esc(top.items[0].title)} <small class="muted">— ${esc(top.items[0].src)}</small></p>${story({ ...top, items: top.items.slice(1).length ? top.items.slice(1) : top.items }, 6, top.items.length).replace('<article class="story"><h3>', '<article class="story lead-s"><h3 class="sr">')}` : `<p class="kicker">1면 · 오늘의 쟁점</p><p class="muted">분류할 헤드라인이 없습니다.</p>`;
    fill("p2", rest.filter((x) => x.page === 2), "현재 경제·증시 쟁점으로 분류된 헤드라인이 없습니다.");
    fill("p3", rest.filter((x) => x.page === 3), "현재 국제·지정학 쟁점으로 분류된 헤드라인이 없습니다.");
    if (j.failed?.length) el.querySelector("#p3").insertAdjacentHTML("beforeend", `<p class="cap">응답 없는 출처: ${esc(j.failed.join(", "))}</p>`);
    el.querySelectorAll("[data-live]").forEach(live);
    el.querySelectorAll("[data-rt]").forEach((a) => (a.onclick = () => { settings.riskType = a.dataset.rt; saveSettings(); }));
  }).catch(() => { el.querySelector("#p1").innerHTML = '<p class="kicker">1면 · 오늘의 쟁점</p><p class="muted">뉴스 서버 응답 없음(정적 미리보기).</p>'; ["p2", "p3"].forEach((id) => (el.querySelector(`#${id} .pg-g`).innerHTML = "")); });
  brief(el.querySelector("#brief"), newsP);
}
lobby.title = "1면";

// ── I 성향 ──
export function profile(el) {
  const draw = () => {
    const s = profileResult();
    el.innerHTML = `<div class="wrap page"><p class="kicker">I · Investor Profile</p><h1>투자성향 자가진단</h1>
    <p class="lede">8문항으로 감내할 수 있는 손실 폭을 정합니다. 결과는 이 브라우저에만 저장되며, 금융회사의 법정 투자자 정보 확인(적합성 원칙)을 대체하지 않습니다.</p>
    <div class="grid g2" style="margin-top:28px;align-items:start"><form id="pf" class="card">${R.QUESTIONS.map((q, i) => `<fieldset><legend><span class="mono muted">${String(i + 1).padStart(2, "0")}</span> ${q.q}</legend><div class="opts">${q.o.map(([t, v]) => `<label><input type="radio" name="${q.id}" value="${v}" ${settings.answers[q.id] === v ? "checked" : ""}><span>${t}</span></label>`).join("")}</div></fieldset>`).join("")}</form>
    <aside style="position:sticky;top:120px"><div class="term"><div class="th"><span>RISK PROFILE</span><span>${s.complete ? "완료" : `${Object.keys(settings.answers).length}/${R.QUESTIONS.length}`}</span></div><div class="tb">
      <div class="kpis"><div class="kpi"><small>점수</small><b>${s.pct}</b><span>/ 100</span></div><div class="kpi"><small>유형</small><b style="font-family:var(--serif-kr)">${s.complete ? s.type.name : "—"}</b></div><div class="kpi"><small>허용 최대낙폭</small><b>${s.complete ? "−" + C.pctU(s.type.mdd, 0) : "—"}</b></div><div class="kpi"><small>주식 비중 범위</small><b>${s.complete ? `${C.pctU(s.type.eq[0], 0)}–${C.pctU(s.type.eq[1], 0)}` : "—"}</b></div></div>
      ${s.complete ? `<p style="margin:14px 0 6px;color:var(--tt)">${esc(s.type.note)}</p><p class="am" style="margin:0 0 10px">권장 검토 전략</p>${s.type.strategies.map((k) => `<a class="btn sm ghost" style="color:var(--amber);border-color:var(--amber);margin:0 6px 6px 0" href="#/backtest/${k}">${Q.STRATEGIES[k].name} →</a>`).join("")}` : `<p style="color:var(--tt-2)">모든 문항에 답하면 결과가 나옵니다.</p>`}
    </div></div></aside></div></div>`;
    $("#pf").onchange = (e) => { settings.answers[e.target.name] = Number(e.target.value); saveSettings(); const y = scrollY; draw(); scrollTo({ top: y }); };
  };
  draw();
}
profile.title = "투자성향";

export function strategies(el) {
  const draw = () => {
    const s = profileResult();
    el.innerHTML = `<div class="wrap page"><p class="kicker">II · Strategy Library</p><h1>규칙이 먼저, 판단은 나중에</h1><p class="lede">여섯 전략 모두 월말 정보로만 비중을 정하고 다음 달에 실행합니다. 파라미터는 학습 구간(1973–1999)에서만 고르고, 검증·테스트 구간은 손대지 않습니다.</p>
    <div style="margin:24px 0">${costForm()}</div>
    ${s.complete ? `<p class="note">당신의 유형 <b>${s.type.name}</b> — 테스트 구간 최대낙폭 −${C.pctU(s.type.mdd, 0)} 이내 전략에 <span class="chip fit">적합</span> 표시</p>` : `<p class="note">성향 진단을 마치면 각 전략에 적합 여부가 표시됩니다. <a href="#/profile">진단하기 →</a></p>`}
    <div class="grid g3" style="margin-top:18px">${Object.entries(Q.STRATEGIES).map(([k, st]) => { const sm = Q.splitMetrics(run(k).bt, bench()), te = sm[2].m; const fit = s.complete ? R.fits(s.type, te.mdd) : null;
      return `<a class="card corner strat rise" href="#/backtest/${k}" data-k="${k}"><span class="k">${st.kind}${st.benchmark ? " · 기준" : ""} ${fit == null ? "" : `<span class="chip ${fit ? "fit" : "nofit"}" style="float:right">${fit ? "적합" : "초과"}</span>`}</span><h3>${st.name}</h3><p>${st.desc}</p><div class="mini"><div><small>TEST CAGR</small><b>${C.pctU(te.cagr)}</b></div><div><small>MDD</small><b class="neg">${C.pct(te.mdd)}</b></div><div><small>SHARPE</small><b>${C.num(te.sharpe)}</b></div></div></a>`; }).join("")}</div>
    <p class="cap" style="margin-top:12px">테스트 구간 ${Q.SPLITS[2].from}–${D.end} · 비용·세금 반영 · 무위험수익률 0% 가정 Sharpe · USD 기준</p></div>`;
    bindCost(el, () => { cache.clear(); draw(); });
    $$("[data-k]", el).forEach((a) => a.addEventListener("click", () => { settings.strategy = a.dataset.k; saveSettings(); }));
  };
  draw();
}
strategies.title = "전략";
