// 1면 · A 성향 · B 전략
import * as Q from "../quant.js";
import * as C from "../charts.js";
import { $, $$, esc, settings, saveSettings, market, D, cache, run, bench, profileResult, currentWeights, norm, costForm, bindCost, refresh } from "../core.js";
import * as R from "../profile.js";
import * as V from "../vault.js";
import { skyline } from "../art.js";
import { thermometer } from "../desk.js";
import { brief } from "../brief.js";

// ── 1면 (로비) — 신문 1면 문법: 제호 · 날짜선 · 머리기사 · 사진 · 3단 본문 · 우측 단신 · 차례 ──
export function lobby(el) {
  const eq = Q.metrics(bench().rets), t = D.dates.length - 1, v = Q.viewAt(D, t), y0 = D.dates[0].slice(0, 4), span = Number(D.end.slice(0, 4)) - Number(y0);
  const tr = run("trend"), te = Q.splitMetrics(tr.bt, bench())[2].m, N = tr.sel.best.N, prof = profileResult();
  const done = { profile: prof.complete, strategies: !!settings.strategy, backtest: !!settings.strategy, models: !!settings.seenModels, scenario: !!settings.seenScenario, portfolio: V.exists() };
  const today = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(new Date());
  const ch = (a) => D.px[a][t] / D.px[a][t - 1] - 1, cls = (x) => (x >= 0 ? "pos" : "neg"), th = thermometer(D, market);
  el.innerHTML = `<div class="wrap front">
  <div class="dateline"><span>제1권 · 제${D.end.replace("-", "")}호</span><span>뉴욕 · 서울 &nbsp;|&nbsp; ${today}</span><span>월간판 · ${D.end} 자료 기준</span></div>
  <section class="brief" id="brief" aria-label="오늘의 브리핑"></section>
  <div class="fp"><article class="lead">
    <p class="kicker">머리기사 · 퀀트 데스크</p>
    <h1 class="hed">${span}년의 시장이 남긴 교훈,<br>규칙은 감정보다 오래 살아남는다</h1>
    <p class="dek">S&amp;P 500은 ${y0}년 이후 연 ${C.pctU(eq.cagr)}씩 불어났다. 그러나 그 길 위에는 ${C.pct(eq.mdd)}의 낙폭이 있었다. 이 지면은 예측 대신 규칙으로 그 낙폭을 다루는 법을, 거래비용과 세금까지 빼고 검증한다.</p>
    <div class="byline"><span>BROAD &amp; WALL 퀀트 데스크</span><span>${D.dates.length}개월 공개 자료 · 투자 권유 아님</span></div>
    <figure class="plate"><div class="img">${skyline()}</div><figcaption>해질녘의 로어 맨해튼(일러스트). 1792년 5월, 중개인 24명이 월가 68번지 앞 버튼우드 나무 아래에서 맺은 협약이 뉴욕증권거래소의 출발점이 됐다.</figcaption></figure>
    <div class="cols">
      <p class="dc">월스트리트의 오래된 격언은 시장을 이기려 하지 말고 시장에 남아 있으라고 말한다. 문제는 남아 있는 일이 생각보다 어렵다는 데 있다. 이 지면의 모든 숫자는 ${D.dates[0]}부터 ${D.end}까지 ${D.dates.length}개월의 공개 자료로 계산했고, 수수료와 슬리피지, 해외주식 양도소득세를 뺀 뒤의 결과다.</p>
      <p>가장 단순한 추세 규칙은 이렇다. 주식과 금이 ${N}개월 이동평균 아래로 내려가면 그 몫을 채권으로 옮긴다. 이 규칙은 한 번도 들여다보지 않은 ${Q.SPLITS[2].from.slice(0, 4)}년 이후 시험 구간에서 연 ${C.pctU(te.cagr)}, 최대낙폭 ${C.pct(te.mdd)}를 기록했다. 파라미터는 1999년까지의 자료로만 골랐다.</p>
      <blockquote class="pull">“시장을 예측하지 않는다. 규칙을 세우고, 그 규칙이 틀린 날까지 기록한다.”</blockquote>
      <p>다섯 개의 예측 모델도 같은 조건으로 시험대에 올렸다. 매년 1월, 그때까지의 자료로만 다시 학습시키는 방식이다. 기준선을 넘지 못한 결과도 지우지 않고 D면에 실었다.</p>
      <p>독자의 보유 자산은 이 지면에 실리지 않는다. 비공개 원장은 이 기기 안에서만 암호화되고, 공개면에는 비중과 규칙만 오른다. 시세는 실시간이 아닌 월간 자료다.</p>
      <p class="go"><a href="#/desk">이번 달 투자 데스크 보기 →</a> &nbsp; <a href="#/profile">A면 · 투자성향 진단 →</a></p>
    </div>
  </article>
  <aside class="rail">
    <h4>시장 요약 <small>월간 · 지연</small></h4>
    <table class="mkt"><tbody>
      <tr><td>S&amp;P 500</td><td>${D.px.EQ[t].toLocaleString("en-US", { maximumFractionDigits: 0 })} <b class="${cls(ch("EQ"))}">${C.pct(ch("EQ"))}</b></td></tr>
      <tr><td>금 ($/oz)</td><td>${D.px.GD[t].toLocaleString("en-US", { maximumFractionDigits: 0 })} <b class="${cls(ch("GD"))}">${C.pct(ch("GD"))}</b></td></tr>
      <tr><td>미 국채 10년</td><td>${D.y10[t].toFixed(2)}%</td></tr>
      <tr><td>미 CPI 전년비</td><td>${C.pctU(v.cpi(t - 1) / v.cpi(t - 13) - 1)} <small>(${D.dates[t - 1]})</small></td></tr>
      <tr><td>S&amp;P 12개월</td><td class="${cls(v.cumRet("EQ", 12))}">${C.pct(v.cumRet("EQ", 12))}</td></tr>
    </tbody></table>
    <h4 style="margin-top:26px">이번 달 규칙 신호 <small>${D.end} 말</small></h4>
    <table class="mkt sig"><thead><tr><td></td><td>주식 · 채권 · 금</td></tr></thead><tbody>
    ${Object.keys(Q.STRATEGIES).filter((k) => k !== "eq").map((k) => { const w = norm(currentWeights(k)); return `<tr><td><a href="#/backtest/${k}">${Q.STRATEGIES[k].name}</a></td><td>${[w.EQ, w.BD, w.GD].map((x) => Math.round(x * 100)).join(" · ")}</td></tr>`; }).join("")}
    </tbody></table>
    <div class="deskbox"><h4>투자 데스크 <small>이번 달 점검</small></h4>
    <ul><li>S&amp;P 500 고점 대비 <b>${th.now.dd > -0.0005 ? "최고치" : C.pct(th.now.dd)}</b></li><li>주식 추세 <b class="${cls(th.now.trendEQ)}">${th.now.trendEQ >= 0 ? "10개월선 위" : "10개월선 아래"}</b></li><li>실질금리 <b>${C.pct(th.now.real, 2)}</b></li><li>12개월 수익 1위 <b>${Q.ASSET_LABEL[th.rank[0]]}</b></li></ul>
    <a class="btn sm" href="#/desk">리밸런싱 주문서 열기 →</a> <a class="btn sm ghost" href="#/flows" style="margin-top:6px">돈의 흐름 →</a> <a class="btn sm ghost" href="#/risk" style="margin-top:6px">리스크 상황실 →</a></div>
    <h4 style="margin-top:26px">공개면 안내</h4>
    <p class="brief"><a href="#/public">모델 포트폴리오 증서</a> — 금액 없이 비중과 규칙만 공개한다. 실제 자산과는 분리돼 있다.</p>
    <p class="brief"><a href="#/connect">증권사 연결 현황</a> — 확인된 범위만 쓴다. 연결되지 않은 계좌는 연결됐다고 쓰지 않는다.</p>
  </aside></div>
  <h2 class="idx-h">이번 호 차례</h2>
  <nav class="index" aria-label="섹션 차례">${[["profile", "A", "투자성향", "여덟 개의 질문으로 감내할 낙폭을 정한다"], ["strategies", "B", "전략 편람", "여섯 개 규칙의 성적과 적합 여부"], ["backtest", "C", "검증 보고서", "학습 · 검증 · 시험 구간을 나눠 본 결과"], ["models", "D", "예측 실험실", "다섯 모델과 기준선의 정직한 비교"], ["scenario", "E", "위기의 기록", "오일쇼크부터 금리 급등까지 대입"], ["portfolio", "F", "비공개 원장", "이 기기에서만 열리는 내 포트폴리오"]].map(([h, s, t2, d]) => `<a href="#/${h}"><span class="sl">${s}</span><b>${t2}${done[h] ? ' <i class="pos">✓</i>' : ""}</b><span>${d}</span></a>`).join("")}</nav>
  </div>`;
  brief(el.querySelector("#brief"));
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
