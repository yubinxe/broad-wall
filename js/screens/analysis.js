// III 백테스트 · IV 모델 · V 시나리오
import * as Q from "../quant.js";
import * as C from "../charts.js";
import { $, $$, esc, settings, saveSettings, market, D, cache, run, bench, profileResult, currentWeights, norm, costForm, bindCost, refresh } from "../core.js";
import * as M from "../models.js";
import * as P from "../portfolio.js";
import * as V from "../vault.js";

// ── III 백테스트 ──
export function backtest(el, key) {
  key = Q.STRATEGIES[key] ? key : settings.strategy || "trend"; settings.strategy = key; saveSettings();
  const draw = () => {
    const st = Q.STRATEGIES[key], { sel, bt } = run(key), b = bench(), b64 = run("s6040").bt, sm = Q.splitMetrics(bt, b), smB = Q.splitMetrics(b, b), sm64 = Q.splitMetrics(b64, b);
    const tot = Q.metrics(bt.rets), c = settings.costs, imputedFrom = Object.keys(market.quality.imputed)[0];
    const row = (lab, m, cls = "") => `<tr class="${cls}"><td>${lab}</td><td class="num">${C.pctU(m.cagr)}</td><td class="num">${C.pctU(m.vol)}</td><td class="num neg">${C.pct(m.mdd)}</td><td class="num">${C.num(m.sharpe)}</td><td class="num">${C.num(m.calmar)}</td><td class="num">${m.beta == null ? "—" : C.num(m.beta)}</td><td class="num">${C.pctU(m.hit, 0)}</td></tr>`;
    el.innerHTML = `<div class="wrap page"><p class="kicker">III · Backtest · ${st.kind}</p><h1>${st.name}</h1><p class="lede">${st.desc}</p>
    <div class="opts" style="margin-top:18px">${Object.entries(Q.STRATEGIES).map(([k, s]) => `<a class="btn sm ${k === key ? "" : "ghost"}" href="#/backtest/${k}">${s.name}</a>`).join("")}</div>
    <div class="term" style="margin-top:22px"><div class="th"><span>RESULT · ${D.dates[0].slice(0, 4)}–${D.end}</span><span>비용·세금 차감 후</span></div><div class="tb"><div class="kpis">
      <div class="kpi"><small>CAGR</small><b>${C.pctU(tot.cagr)}</b><span>전체 ${bt.dates[0]}–</span></div><div class="kpi"><small>최대낙폭 MDD</small><b class="dn">${C.pct(tot.mdd)}</b><span>${bt.dates[tot.mddWindow[0]]}→${bt.dates[tot.mddWindow[1]]}</span></div><div class="kpi"><small>SHARPE · rf 0%</small><b>${C.num(tot.sharpe)}</b></div><div class="kpi"><small>CALMAR</small><b>${C.num(tot.calmar)}</b></div><div class="kpi"><small>변동성 (연)</small><b>${C.pctU(tot.vol)}</b></div>
      <div class="kpi"><small>최종 자산</small><b>${C.krwS(bt.final)}</b><span>초기 ${C.krwS(c.capital)}</span></div><div class="kpi"><small>누적 거래비용</small><b>${C.krwS(bt.costs)}</b></div><div class="kpi"><small>누적 세금</small><b>${C.krwS(bt.taxes)}</b></div><div class="kpi"><small>연 회전율</small><b>${C.pctU(bt.annualTurnover, 0)}</b><span>${bt.trades}회 매매</span></div>
    </div></div></div>
    <h2 class="sec"><span class="rn">i</span>누적 수익 — 로그 축 <small>학습 │ 검증 │ 테스트</small></h2><div class="chart" id="ch1"></div>
    <div class="chart" id="ch2" style="margin-top:10px"></div>
    <h2 class="sec"><span class="rn">ii</span>구간별 성과 — 전략 vs 기준 <small>파라미터는 학습 구간에서만 선택</small></h2>
    <div class="scroll"><table class="ledger"><thead><tr><th>구간</th><th>CAGR</th><th>변동성</th><th>MDD</th><th>Sharpe</th><th>Calmar</th><th>β (vs 주식)</th><th>상승월</th></tr></thead><tbody>
    ${sm.map((s, i) => row(`<b>${s.label}</b> <span class="mono muted small">${s.from}–${s.to}</span>`, s.m, "hl") + row("　S&amp;P 500 보유", smB[i].m) + row("　60/40", sm64[i].m)).join("")}</tbody></table></div>
    <div class="grid g2" style="margin-top:16px;align-items:start"><div><h3 style="margin-bottom:8px">파라미터 선택 (학습 구간 Sharpe)</h3><div class="scroll"><table class="ledger"><thead><tr><th>파라미터</th><th>학습 Sharpe</th><th>CAGR</th><th>MDD</th></tr></thead><tbody>${sel.grid.map((g) => `<tr class="${JSON.stringify(g.p) === JSON.stringify(sel.best) ? "hl" : ""}"><td class="mono">${Object.keys(g.p).length ? esc(JSON.stringify(g.p)) : "고정"}</td><td class="num">${C.num(g.sharpe)}</td><td class="num">${C.pctU(g.cagr)}</td><td class="num neg">${C.pct(g.mdd)}</td></tr>`).join("")}</tbody></table></div></div>
    <div class="note"><b>검증 가정</b><br>· 실행 지연 1개월: t 월말 정보 → t+1 월 수익에 적용(룩어헤드 차단, 엔진이 미래 접근 시 오류)<br>· 거래비용 ${c.costBps}bp + 슬리피지 ${c.slipBps}bp (회전 금액 기준)<br>· 세금: 연말 순실현이익 − ${C.krw(c.deduction)} 공제 × ${C.pctU(c.taxRate, 0)}<br>· 리밸런싱: ${({ monthly: "매월", quarterly: "분기말", annual: "12월", band: `비중 이탈 ±${C.pctU(c.band, 0)} 초과 시` })[c.rebalance]}<br>· 생존편향: 개별 종목이 아닌 자산군 지수만 사용 — 상장폐지 종목 누락 문제 없음. 단 S&amp;P 500 지수 자체의 편입·편출 효과는 지수에 내재<br>· 데이터: S&amp;P 지수는 월평균값, 배당은 ${imputedFrom ?? "—"} 이후 보간, 10년물은 모형 수익률, 환율 미반영</div></div>
    <h2 class="sec"><span class="rn">iii</span>연도별 수익</h2><div id="ch3"></div>
    <div class="grid g2" style="margin-top:8px;align-items:start"><div><h2 class="sec"><span class="rn">iv</span>자산별 성과 기여</h2><div id="ch4"></div></div><div><h2 class="sec"><span class="rn">v</span>현재 비중 · 평균 비중</h2><div id="ch5"></div></div></div>
    <div style="margin-top:22px">${costForm()}</div></div>`;
    const cum = (rs) => { let g = 1; return rs.map((r) => (g *= 1 + r)); };
    const align = (x) => { const m = new Map(x.dates.map((d, i) => [d, i])), cx = cum(x.rets); return bt.dates.map((d) => (m.has(d) ? cx[m.get(d)] : null)); };
    const ub = align(b), u64 = align(b64);
    const norm1 = (arr) => { const f = arr.find((v) => v != null); return arr.map((v) => (v == null ? null : v / f)); };
    C.lineChart($("#ch1"), { dates: bt.dates, series: [{ name: st.name, values: cum(bt.rets) }, { name: "S&P 500 보유(비용 반영)", values: norm1(ub), color: "var(--c2)" }, { name: "60/40", values: norm1(u64), color: "var(--c5)", dash: true }], caption: `성장배수 · 로그 축 · USD · ${bt.dates[0]}–${D.end} · 출처: Shiller/FRED/World Bank/BLS · 비용·세금 차감`, markers: [{ date: Q.SPLITS[1].from, label: "검증" }, { date: Q.SPLITS[2].from, label: "테스트" }] });
    C.areaChart($("#ch2"), { dates: bt.dates, values: Q.drawdowns(bt.rets), caption: "고점 대비 낙폭 · 월간 · 비용·세금 차감" });
    C.heatmap($("#ch3"), { rows: Q.annualReturns(bt), caption: "연도별 수익률 · 부분 연도 포함" });
    C.hbars($("#ch4"), { rows: Q.ASSETS.filter((a) => a !== "CASH").map((a) => ({ label: Q.ASSET_LABEL[a], value: bt.contrib[a] / bt.years })), fmt: (v) => (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(2) + "%p", caption: "연평균 기여 = Σ(전월 비중 × 자산 월수익) ÷ 연수 · 비용·세금 차감 전 · 합 ≈ 연 산술수익" });
    const w = norm(currentWeights(key)), avg = Q.ASSETS.map((a, i) => bt.weights.reduce((s, r) => s + r[i], 0) / bt.weights.length);
    C.donut($("#ch5"), { parts: ["EQ", "BD", "GD"].map((a, i) => ({ label: `${Q.ASSET_LABEL[a]} · 평균 ${C.pctU(avg[Q.ASSETS.indexOf(a)], 0)}`, value: w[a], color: ["var(--c1)", "var(--c2)", "var(--c3)"][i] })), center: ["NEXT", D.end + " 신호"], caption: "도넛 = 다음 달 목표 비중 · 범례 = 전 기간 평균 보유 비중" });
    bindCost(el, () => { cache.clear(); draw(); });
  };
  draw();
}
backtest.title = "백테스트";

// ── IV 모델 ──
export function models(el) {
  settings.seenModels = true; saveSettings();
  el.innerHTML = `<div class="wrap page"><p class="kicker">IV · Forecast Lab</p><h1>예측 모델은 기준선을 이겼는가</h1><p class="lede">다음 달 미국 주식 수익의 방향을 다섯 모델로 예측하고, 매년 1월 그때까지의 데이터로만 다시 학습하는 워크포워드 방식으로 평가합니다. 기준선을 통계적으로 넘지 못하면 그렇다고 적습니다.</p>
  <div class="grid g3" style="margin-top:22px">${[["수집", "공개 월간 데이터 4종 · 해시 고정"], ["전처리", "결측 보간 표시 · CPI 발표 지연 1개월"], ["특성공학", M.FEATURES.length + "개 · 모멘텀·변동성·금리·물가"], ["학습", "확장 창 · 매년 1월 재학습"], ["성능 분석", "OOS R² · 적중률 · Brier"], ["실전 비교", "예측→매매 규칙 · 비용·세금 포함"]].map(([t, d], i) => `<div class="card"><span class="mono muted small">0${i + 1}</span><h3 style="margin:4px 0">${t}</h3><span class="small muted">${d}</span></div>`).join("")}</div>
  <div id="mbody" style="margin-top:26px"><p class="muted"><span class="spin"></span> 440개월 워크포워드 계산 중…</p></div></div>`;
  setTimeout(() => {
    const wf = M.walkForward(D), ev = M.evaluate(wf), seg = (s, k) => s.seg[k];
    const sig = ev.filter((r) => r.key !== "base" && seg(r, "test").z > 1.96);
    const tr = ["logit", "forest", "ridge"].map((k) => ({ k, bt: M.tradeModel(D, wf, k, settings.costs) }));
    const testM = (bt) => Q.metrics(Q.slice(bt, Q.SPLITS[2].from, "9999-12")), b = bench();
    $("#mbody").innerHTML = `<div class="note ${sig.length ? "ok" : "warn"}"><b>결론</b> — ${sig.length ? `${sig.map((r) => r.name).join(", ")}이(가) 테스트 구간에서 '항상 상승' 기준선 대비 적중률이 유의(z>1.96)했습니다. 그래도 비용 차감 매매 성과는 아래 표로 따로 판단하세요.` : "테스트 구간에서 '항상 상승' 기준선을 통계적으로(z>1.96) 이긴 모델은 없습니다. 이 화면의 어떤 모델도 주가 예측력을 보장하지 않습니다."}</div>
    <h2 class="sec"><span class="rn">i</span>예측 성능 — 검증 1990–2012 · 테스트 ${Q.SPLITS[2].from}–</h2>
    <div class="scroll"><table class="ledger cards"><thead><tr><th>모델</th><th>구간</th><th>표본</th><th>OOS R²</th><th>방향 적중</th><th>기준선</th><th>z</th><th>Brier (기준)</th></tr></thead><tbody>
    ${ev.flatMap((r) => ["valid", "test"].map((k) => { const s = seg(r, k); return `<tr class="${k === "test" ? "hl" : ""}"><td data-l="모델"><b>${r.name}</b> <span class="muted small">${r.kind}</span></td><td data-l="구간">${k === "valid" ? "검증" : "테스트"}</td><td data-l="표본" class="num">${s.n}</td><td data-l="OOS R²" class="num ${s.r2 > 0 ? "pos" : s.r2 < 0 ? "neg" : ""}">${s.r2 == null ? "—" : C.num(s.r2, 3)}</td><td data-l="방향 적중" class="num">${C.pctU(s.hit)}</td><td data-l="기준선" class="num muted">${C.pctU(s.baseHit)}</td><td data-l="z" class="num">${C.num(s.z)}</td><td data-l="Brier" class="num">${s.brier == null ? "—" : C.num(s.brier, 4)} <span class="muted">(${C.num(s.brierBase, 4)})</span></td></tr>`; })).join("")}</tbody></table></div>
    <p class="cap">OOS R² = 1 − Σ(실제−예측)² / Σ(실제−과거평균)² (Campbell–Thompson) · 기준선 적중 = 그 구간의 상승월 비율 · z = 기준선 대비 이항 근사 · Brier 는 낮을수록 좋음</p>
    <div class="note" style="margin-top:12px"><b>주의 — AR(1)의 착시</b><br>S&amp;P 원자료가 '월평균' 지수라 인접 월 수익이 인위적으로 양의 자기상관을 갖습니다(Working, 1960). 검증 구간 AR(1)의 플러스 R²는 이 측정 효과일 가능성이 크며, 월말 가격으로 실제 매매할 때는 재현되지 않습니다.</div>
    <h2 class="sec"><span class="rn">ii</span>실전 비교 — 예측대로 매매하면 <small>상승 예측 → 주식, 아니면 채권 · 비용·세금 포함</small></h2><div class="chart" id="mch"></div>
    <div class="scroll" style="margin-top:10px"><table class="ledger"><thead><tr><th>테스트 구간</th><th>CAGR</th><th>MDD</th><th>Sharpe</th><th>세금</th></tr></thead><tbody>${[...tr.map((t) => [M.MODELS[t.k].name + " 매매", testM(t.bt), t.bt.taxes]), ["S&P 500 보유", testM(b), 0]].map(([n, m, tx]) => `<tr><td>${n}</td><td class="num">${C.pctU(m.cagr)}</td><td class="num neg">${C.pct(m.mdd)}</td><td class="num">${C.num(m.sharpe)}</td><td class="num">${C.krwS(tx)}</td></tr>`).join("")}</tbody></table></div>
    <h2 class="sec"><span class="rn">iii</span>모델 분류와 구현 범위</h2>
    <div class="scroll"><table class="ledger"><thead><tr><th>계열</th><th>모델</th><th>상태</th><th>이유</th></tr></thead><tbody>
      <tr><td>통계 시계열</td><td>ARIMA</td><td><span class="chip real">구현</span></td><td>ARIMA(1,0,0)=AR(1) 로 구현. 차수 탐색은 표본(월 650개) 대비 과적합 위험이 커 고정.</td></tr>
      <tr><td>통계 시계열</td><td>SARIMA · Prophet</td><td><span class="chip off">미구현</span></td><td>월간 주가 수익률에 뚜렷한 계절성이 없고, Prophet 은 브라우저용 공식 배포본이 없음.</td></tr>
      <tr><td>머신러닝</td><td>Random Forest</td><td><span class="chip real">구현</span></td><td>깊이 3 · 60그루 · 시드 고정.</td></tr>
      <tr><td>머신러닝</td><td>XGBoost</td><td><span class="chip off">미구현</span></td><td>부스팅 라이브러리 없이 정확한 구현 검증이 어려워 제외. 같은 트리 계열인 랜덤 포레스트로 대체.</td></tr>
      <tr><td>딥러닝</td><td>LSTM · CNN</td><td><span class="chip off">미구현</span></td><td>표본 수백 개 월간 데이터로는 과적합이 지배적이고, 일별·분별 데이터 원천이 없음.</td></tr>
      <tr><td>회귀·분류</td><td>릿지 · 로지스틱</td><td><span class="chip real">구현</span></td><td>해석 가능한 기준 모델.</td></tr></tbody></table></div>
    <p class="cap">참고: 요청에 언급된 강의 사진 5장은 이 작업 환경에 첨부되지 않아 확인하지 못했습니다. 절차(수집→전처리→특성공학→학습→성능 분석→실전 비교)와 모델 분류는 요청 문구를 기준으로 구성했습니다.</p>`;
    const cum = (rs) => { let g = 1; return rs.map((r) => (g *= 1 + r)); }, from = Q.SPLITS[2].from;
    const pick = (bt) => { const i0 = bt.dates.findIndex((d) => d >= from); return { d: bt.dates.slice(i0), v: cum(bt.rets.slice(i0)) }; };
    const base = pick(b);
    C.lineChart($("#mch"), { dates: base.d, series: [{ name: "S&P 500 보유", values: base.v, color: "var(--c2)" }, ...tr.map((t, i) => { const p = pick(t.bt), m = new Map(p.d.map((d, j) => [d, p.v[j]])); return { name: M.MODELS[t.k].name, values: base.d.map((d) => m.get(d) ?? null), color: ["var(--c1)", "var(--c3)", "var(--c4)"][i] }; })], caption: `테스트 구간 ${from}–${D.end} · 성장배수 · 비용·세금 반영 · USD` });
  }, 30);
}
models.title = "예측 모델";

// ── V 시나리오 ──
export function scenario(el) {
  settings.seenScenario = true; saveSettings();
  const vaultOpen = V.isOpen() && (V.data()?.holdings || []).length;
  const draw = (srcKey = vaultOpen ? "mine" : settings.strategy || "trend", shock = { EQ: -0.3, BD: 0.05, GD: 0.1 }) => {
    let w, label, value = null;
    if (srcKey === "mine" && vaultOpen) { const a = P.analyze(V.data().holdings, V.data().fx); w = P.classWeights(a.byClass); label = "내 포트폴리오 (비공개 · 이 화면에만 표시)"; value = a.total; }
    else { w = norm(currentWeights(srcKey)); label = Q.STRATEGIES[srcKey].name + " 다음 달 비중"; }
    const st = Q.stressTest(D, w), risk = Q.riskEstimate(D, w);
    el.innerHTML = `<div class="wrap page"><p class="kicker">V · Scenario Room</p><h1>그때 이 비중이었다면</h1><p class="lede">실제 역사적 위기 구간의 월간 자산 수익을 지금 비중에 그대로 적용합니다. 월평균 지수라 일중·일별 최저점보다 낙폭이 작게 나옵니다.</p>
    <div class="formrow" style="margin:22px 0"><label class="field">대상<select id="src">${vaultOpen ? `<option value="mine" ${srcKey === "mine" ? "selected" : ""}>내 포트폴리오 (비공개)</option>` : ""}${Object.entries(Q.STRATEGIES).map(([k, s]) => `<option value="${k}" ${k === srcKey ? "selected" : ""}>${s.name}</option>`).join("")}</select></label></div>
    <div class="term"><div class="th"><span>${esc(label)}</span><span>주식 ${C.pctU(w.EQ, 0)} · 채권 ${C.pctU(w.BD, 0)} · 금 ${C.pctU(w.GD, 0)} · 현금 ${C.pctU(w.CASH, 0)}</span></div><div class="tb"><div class="kpis">
      <div class="kpi"><small>추정 변동성 (연)</small><b>${C.pctU(risk.vol)}</b><span>${risk.window}</span></div><div class="kpi"><small>월간 95% VaR</small><b class="dn">−${C.pctU(risk.var95m)}</b><span>정규분포 가정</span></div>
      ${["EQ", "BD", "GD"].map((a) => `<div class="kpi"><small>위험 기여 · ${Q.ASSET_LABEL[a]}</small><b>${C.pctU(risk.contrib[a], 0)}</b></div>`).join("")}</div></div></div>
    <h2 class="sec"><span class="rn">i</span>역사적 스트레스</h2><div class="scroll"><table class="ledger cards"><thead><tr><th>사건</th><th>구간</th><th>포트폴리오</th>${value ? "<th>평가액 영향</th>" : ""}<th>주식</th><th>채권</th><th>금</th></tr></thead><tbody>
    ${st.map((s) => `<tr><td data-l="사건"><b>${s.label}</b></td><td data-l="구간" class="mono small">${s.from}–${s.to}</td><td data-l="포트폴리오" class="num ${s.ret < 0 ? "neg" : "pos"}"><b>${C.pct(s.ret)}</b></td>${value ? `<td data-l="평가액 영향" class="num sens ${s.ret < 0 ? "neg" : "pos"}">${C.krw(value * s.ret)}</td>` : ""}<td data-l="주식" class="num">${C.pct(s.assets.EQ)}</td><td data-l="채권" class="num">${C.pct(s.assets.BD)}</td><td data-l="금" class="num">${C.pct(s.assets.GD)}</td></tr>`).join("")}</tbody></table></div>
    <h2 class="sec"><span class="rn">ii</span>사용자 정의 충격</h2><form id="sh" class="formrow">${["EQ", "BD", "GD"].map((a) => `<label class="field">${Q.ASSET_LABEL[a]} 변화 <output class="mono">${C.pct(shock[a], 0)}</output><input type="range" name="${a}" min="-0.6" max="0.6" step="0.05" value="${shock[a]}"></label>`).join("")}</form>
    <div class="note" style="margin-top:12px" id="shOut" aria-live="polite"></div></div>`;
    const paint = () => { const cu = ["EQ", "BD", "GD"].reduce((s, a) => s + (w[a] || 0) * shock[a], 0); $("#shOut").innerHTML = `이 충격에서 포트폴리오 변화 <b class="${cu < 0 ? "neg" : "pos"}">${C.pct(cu)}</b>${value ? ` — 평가액 기준 <b class="sens">${C.krw(value * cu)}</b>` : ""}. 현금은 0% 가정.`; };
    paint();
    $("#src").onchange = (e) => draw(e.target.value, shock);
    $("#sh").oninput = (e) => { shock[e.target.name] = Number(e.target.value); e.target.previousElementSibling.textContent = C.pct(shock[e.target.name], 0); paint(); };
    document.body.classList.toggle("mask-on", !!settings.mask);
  };
  draw();
}
scenario.title = "시나리오";
