// 투자 데스크 — 시장 체온 · 신호 변경 · 리밸런싱 주문서. 판단 근거를 숫자로 보여 주되 권유는 하지 않는다.
import * as Q from "../quant.js";
import * as C from "../charts.js";
import * as K from "../desk.js";
import * as P from "../portfolio.js";
import * as V from "../vault.js";
import { $, esc, settings, saveSettings, market, D, run, profileResult } from "../core.js";

const L = Q.ASSET_LABEL;
const bar = (p) => (p == null ? "" : `<span class="gauge" role="img" aria-label="역사적 위치 ${Math.round(p * 100)}%"><i style="left:${(p * 100).toFixed(1)}%"></i></span><span class="gl">${Number(D.end.slice(0, 4)) - Number(D.dates[0].slice(0, 4))}년 백분위 ${Math.round(p * 100)} — 과거 달 중 이 값 이하였던 비율</span>`);

export function desk(el) {
  const th = K.thermometer(D, market), n = th.now, params = Object.fromEntries(Object.keys(Q.STRATEGIES).map((k) => [k, run(k).sel.best]));
  const sig = K.signalChanges(D, params), prof = profileResult();
  const cards = [
    ["S&amp;P 500 고점 대비", n.dd > -0.0005 ? "0.0% · 최고치" : C.pct(n.dd), th.pct.dd, n.dd > -0.05 ? "사상 최고치 부근입니다. 고점 매수 구간일수록 최대낙폭 감내 계획을 먼저 세웁니다." : n.dd > -0.2 ? "조정 구간입니다(−5~−20%)." : "약세장 구간입니다(−20% 이하). 규칙 기반 분할 매수·리밸런싱이 시험받는 때입니다."],
    ["S&amp;P 500 추세", C.pct(n.trendEQ), null, n.trendEQ >= 0 ? "10개월 이동평균 위 — 추세 규칙은 주식 보유 신호입니다." : "10개월 이동평균 아래 — 추세 규칙은 주식 비중을 줄이는 신호입니다."],
    ["금 추세", C.pct(n.trendGD), null, n.trendGD >= 0 ? "10개월 이동평균 위 — 추세 규칙은 금 보유 신호입니다." : "10개월 이동평균 아래 — 추세 규칙은 금을 채권으로 돌리는 신호입니다."],
    ["실질금리(10년물 − CPI)", C.pct(n.real, 2), th.pct.real, `10년물 ${C.pctU(n.y10, 2)} − 물가 ${C.pctU(n.infl)}. 높을수록 채권의 실질 보상이 큽니다.`],
    ["주식 변동성(12개월, 연율)", C.pctU(n.vol), th.pct.vol, "변동성 타깃 전략은 이 값이 오를수록 주식 비중을 낮춥니다. 월평균 지수라 일별 기준보다 낮게 나옵니다."],
    ["S&amp;P 500 배당수익률", C.pctU(n.dy, 2), th.pct.dy, "낮을수록 주가가 배당에 비해 비싸다는 뜻입니다(최근 배당은 보간값 포함)."],
  ];
  const strat0 = settings.strategy && settings.strategy !== "eq" ? settings.strategy : prof.complete ? prof.type.strategies[0] : "trend";
  el.innerHTML = `<div class="wrap page"><p class="kicker">투자 데스크 · ${D.end} 월말 기준</p><h1>이번 달, 무엇을 확인하고 무엇을 할 것인가</h1>
  <p class="lede">시장의 현재 위치를 과거 ${D.dates.length}개월 분포 속에 놓고, 규칙이 바뀐 곳을 짚고, 내 계좌를 목표 비중으로 맞추려면 얼마를 사고팔아야 하는지 계산합니다. 숫자는 판단의 재료일 뿐 매매 권유가 아닙니다.</p>
  <h2 class="sec"><span class="rn">i</span>시장 체온계 <small>월간 · 지연 · ${th.date}</small></h2>
  <div class="therm">${cards.map(([t, v, p, note]) => `<div class="tc"><small>${t}</small><b>${v}</b>${bar(p)}<p>${note}</p></div>`).join("")}</div>
  <p class="cap">12개월 수익 순위: ${th.rank.map((a, i) => `${i + 1}. ${L[a]} ${C.pct(th.mom[a])}`).join(" · ")} — 듀얼 모멘텀 전략이 쓰는 비교입니다.</p>
  <h2 class="sec"><span class="rn">ii</span>이번 달 신호 변경 <small>${D.dates[D.dates.length - 2]} → ${D.end} 월말</small></h2>
  <div class="scroll"><table class="ledger cards"><thead><tr><th>전략</th><th>상태</th><th>지난달 주식·채권·금</th><th>이번 달 주식·채권·금</th></tr></thead><tbody>
  ${sig.map((s) => `<tr class="${s.changed ? "hl" : ""}"><td data-l="전략"><a href="#/backtest/${s.key}"><b>${s.name}</b></a></td><td data-l="상태">${s.changed ? '<span class="chip off">변경</span>' : '<span class="chip lag">유지</span>'}</td><td data-l="지난달" class="num">${[s.prev.EQ, s.prev.BD, s.prev.GD].map((x) => Math.round(x * 100)).join(" · ")}</td><td data-l="이번 달" class="num"><b>${[s.next.EQ, s.next.BD, s.next.GD].map((x) => Math.round(x * 100)).join(" · ")}</b></td></tr>`).join("")}</tbody></table></div>
  <p class="cap">${sig.filter((s) => s.changed).length ? `이번 달 비중이 1%p 이상 바뀐 전략 ${sig.filter((s) => s.changed).length}개. 바뀌지 않은 전략은 매매할 필요가 없습니다(허용범위 리밸런싱 제외).` : "이번 달 비중이 바뀐 전략이 없습니다. 규칙상 추가 매매가 필요 없는 달입니다."}</p>
  <h2 class="sec"><span class="rn">iii</span>리밸런싱 주문서 <small>계산만 하며 주문을 내지 않습니다</small></h2>
  <form id="rb" class="card"><div class="formrow">
    <label class="field">목표 전략<select name="k">${Object.entries(Q.STRATEGIES).map(([k, s]) => `<option value="${k}" ${k === strat0 ? "selected" : ""}>${s.name}</option>`).join("")}</select></label>
    ${Q.ASSETS.map((a) => `<label class="field">현재 ${L[a]} (원)<input name="${a}" type="number" min="0" step="10000" inputmode="numeric" value="0"></label>`).join("")}
    <label class="field">허용범위(±)<input name="band" type="number" min="0.01" max="0.3" step="0.01" value="${settings.costs.band}"></label>
  </div><p class="small muted" id="rbSrc" style="margin:10px 0 0">${V.isOpen() ? "" : "금고가 잠겨 있어 직접 입력합니다. <a href=\"#/portfolio\">금고를 열면</a> 보유 종목의 자산군 합계가 자동으로 들어옵니다."}</p></form>
  <div id="rbOut" style="margin-top:14px" aria-live="polite"></div>
  <h2 class="sec"><span class="rn">iv</span>주문 전 점검표</h2>
  <ol class="check"><li><b>세금</b> — 해외주식 매도 차익은 연 250만 원 공제 후 22%(지방세 포함) 분리과세 대상입니다. 같은 해 손실 종목 매도로 상계할 수 있습니다.</li><li><b>환율</b> — 이 화면은 원화 금액 기준입니다. 달러 자산은 환전 비용과 환율 변동이 추가로 붙습니다.</li><li><b>거래 시간</b> — 뉴욕증권거래소 정규장은 동부시간 9:30–16:00(한국시간 23:30–06:00, 서머타임 22:30–05:00)입니다.</li><li><b>주문 방식</b> — 거래량이 적은 상품은 지정가 주문으로 슬리피지를 줄입니다.</li><li><b>기록</b> — 매매 후 <a href="#/portfolio">비공개 원장</a>의 수량·평균단가를 갱신해야 다음 달 계산이 맞습니다.</li></ol>
  </div>`;
  const f = $("#rb"), out = $("#rbOut");
  if (V.isOpen()) { const a = P.analyze(V.data().holdings || [], V.data().fx); if (a.total) { const cw = P.classWeights(a.byClass); Q.ASSETS.forEach((x) => (f.elements[x].value = Math.round((cw[x] || 0) * a.total))); $("#rbSrc").textContent = "비공개 원장의 자산군 합계를 불러왔습니다(입력 기준가 · 이 화면에만 표시)."; } }
  const paint = () => {
    const fd = new FormData(f), k = fd.get("k"), cur = Object.fromEntries(Q.ASSETS.map((a) => [a, Number(fd.get(a)) || 0])), band = Number(fd.get("band")) || 0.05;
    const tw = Q.STRATEGIES[k].weights(Q.viewAt(D, D.dates.length - 1), run(k).sel.best), r = K.rebalance(cur, tw, { ...settings.costs, band });
    if (!r.total) { out.innerHTML = `<p class="note">현재 금액을 입력하면 매수·매도 금액이 계산됩니다.</p>`; return; }
    out.innerHTML = `<div class="scroll"><table class="ledger cards rbt"><thead><tr><th>자산군</th><th>현재</th><th>현재 비중</th><th>목표 비중</th><th>목표 금액</th><th>주문</th></tr></thead><tbody>
    ${r.rows.map((x) => `<tr><td data-l="자산군">${L[x.asset]}</td><td data-l="현재" class="num sens">${C.krw(x.cur)}</td><td data-l="현재 비중" class="num">${C.pctU(x.w)}</td><td data-l="목표 비중" class="num"><b>${C.pctU(x.tw)}</b></td><td data-l="목표 금액" class="num sens">${C.krw(x.tgt)}</td><td data-l="주문" class="num ${Math.abs(x.diff) < 1 ? "muted" : x.diff > 0 ? "pos" : "neg"}"><b>${Math.abs(x.diff) < 1 ? "—" : (x.diff > 0 ? "매수 " : "매도 ") + C.krw(Math.abs(x.diff)).replace("−", "")}</b></td></tr>`).join("")}
    </tbody><tfoot><tr><td>합계 <span class="sens">${C.krw(r.total)}</span></td><td class="num">거래 ${C.krw(r.traded)}</td></tr></tfoot></table></div>
    <div class="note ${r.needed ? "warn" : "ok"}" style="margin-top:12px"><b>${r.needed ? "리밸런싱 필요" : "허용범위 이내"}</b> — 가장 큰 이탈 ${C.pctU(r.maxDrift)} (기준 ±${C.pctU(r.band, 0)}). 회전율 ${C.pctU(r.turnover)}, 예상 수수료·슬리피지 약 <b class="sens">${C.krw(r.fee)}</b>(${settings.costs.costBps + settings.costs.slipBps}bp). 매도분 양도세는 평균단가가 있어야 계산되므로 포함하지 않았습니다.</div>`;
    settings.strategy = k; saveSettings(); document.body.classList.toggle("mask-on", !!settings.mask);
  };
  f.oninput = paint; paint();
}
desk.title = "투자 데스크";
