// 리스크 상황실 — 사건 유형을 고르면: 과거 유사 사례의 자산 반응 · 내 비중에 대입한 세 갈래 시나리오 · 관련 헤드라인 · 기관 전망 원문 · 방어 점검표
import * as Q from "../quant.js";
import * as C from "../charts.js";
import * as K from "../risk.js";
import * as P from "../portfolio.js";
import * as V from "../vault.js";
import { $, esc, settings, saveSettings, D, currentWeights, norm } from "../core.js";

const L = Q.ASSET_LABEL, A3 = ["EQ", "BD", "GD"];
const OUTLOOK = [
  ["IMF 세계경제전망(WEO)", "https://www.imf.org/en/Publications/WEO"], ["OECD 경제전망", "https://www.oecd.org/economic-outlook/"],
  ["미 연준 FOMC 성명·의사록", "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"], ["한국은행 통화정책방향", "https://www.bok.or.kr/"],
  ["지정학 리스크 지수(GPR, Caldara·Iacoviello)", "https://www.matteoiacoviello.com/gpr.htm"], ["CBOE 변동성지수(VIX)", "https://www.cboe.com/tradable_products/vix/"],
];
const cell = (v) => `<td class="num ${v == null ? "muted" : v >= 0 ? "pos" : "neg"}">${v == null ? "—" : C.pct(v)}</td>`;

export function risk(el) {
  const sel = settings.riskType || "unrest", vaultOpen = V.isOpen() && (V.data()?.holdings || []).length;
  const pick = (type) => K.EVENTS.filter((e) => type === "all" || e.type === type).map((e) => K.reaction(D, e)).filter(Boolean);
  const draw = (type, src) => {
    const rows = pick(type), sum = K.summary(rows);
    let w, label;
    if (src === "mine" && vaultOpen) { const a = P.analyze(V.data().holdings, V.data().fx); w = P.classWeights(a.byClass); label = "내 포트폴리오"; }
    else { w = norm(currentWeights(src)); label = Q.STRATEGIES[src].name; }
    const sc = K.scenarios(sum, w), safe = A3.filter((a) => a !== "EQ").sort((a, b) => (sum.during[b].med ?? -1) - (sum.during[a].med ?? -1))[0];
    el.innerHTML = `<div class="wrap page"><p class="kicker">리스크 상황실 · 과거 ${K.EVENTS.length}개 사건 · ${D.end} 자료</p><h1>충격이 왔을 때, 무엇을 보고 어떻게 움직일 것인가</h1>
    <p class="lede">사건 유형을 고르면 비슷한 과거 사례에서 주식·채권·금이 어떻게 움직였는지, 지금 비중이라면 어느 정도 흔들릴지, 지금 나오는 헤드라인과 기관 원문, 방어 수단을 한 화면에 모읍니다. 미국 자산 월간 자료 기준이며 예측이 아닙니다.</p>
    <div class="opts" role="tablist" style="margin-top:18px">${[["all", "전체"], ...Object.entries(K.TYPES)].map(([k, t]) => `<button class="btn sm ${k === type ? "" : "ghost"}" data-t="${k}" role="tab" aria-selected="${k === type}">${t}</button>`).join("")}</div>
    <div class="formrow" style="margin:16px 0 0;max-width:420px"><label class="field">대입할 비중<select id="rsrc">${vaultOpen ? `<option value="mine" ${src === "mine" ? "selected" : ""}>내 포트폴리오 (비공개)</option>` : ""}${Object.entries(Q.STRATEGIES).map(([k, s]) => `<option value="${k}" ${k === src ? "selected" : ""}>${s.name}</option>`).join("")}</select></label></div>
    <h2 class="sec"><span class="rn">i</span>한눈 요약 <small>${rows.length}개 사례 · 사건 기간 기준</small></h2>
    <div class="therm">
      ${sc.map((s) => `<div class="tc"><small>${s.name}</small><b class="${s.ret >= 0 ? "pos" : "neg"}">${C.pct(s.ret)}</b><p>${esc(label)} 비중(주식 ${C.pctU(w.EQ, 0)}·채권 ${C.pctU(w.BD, 0)}·금 ${C.pctU(w.GD, 0)})에 ${s.key === "calm" ? "사례 중 가장 좋았던" : s.key === "base" ? "사례 중앙값" : "사례 중 가장 나빴던"} 자산 반응을 대입.</p></div>`).join("")}
    </div>
    <div class="note ${sum.after12.EQ.up != null && sum.after12.EQ.up >= 0.6 ? "ok" : "warn"}" style="margin-top:12px"><b>과거가 말한 것</b> — 사건 기간 S&amp;P 500 중앙값 ${C.pct(sum.during.EQ.med)}(최악 ${C.pct(sum.during.EQ.worst)}). 종료 후 12개월 상승 확률 ${sum.after12.EQ.up == null ? "—" : C.pctU(sum.after12.EQ.up, 0)}(중앙값 ${C.pct(sum.after12.EQ.med)}). 같은 기간 가장 잘 버틴 방어 자산은 <b>${L[safe]}</b>(중앙값 ${C.pct(sum.during[safe].med)}).</div>
    <h2 class="sec"><span class="rn">ii</span>과거 사례별 자산 반응 <small>사건 기간 · 종료 후 6·12개월</small></h2>
    <div class="scroll"><table class="ledger"><thead><tr><th>사건</th><th>기간</th><th>주식</th><th>채권</th><th>금</th><th>주식 +6개월</th><th>주식 +12개월</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td><b>${esc(r.name)}</b> <span class="muted small">${K.TYPES[r.type]}</span></td><td class="mono small">${r.from}${r.to !== r.from ? "–" + r.to : ""}</td>${A3.map((a) => cell(r.during[a])).join("")}${cell(r.after6?.EQ)}${cell(r.after12?.EQ)}</tr>`).join("")}
    <tr class="hl"><td><b>중앙값</b></td><td></td>${A3.map((a) => cell(sum.during[a].med)).join("")}${cell(sum.after6.EQ.med)}${cell(sum.after12.EQ.med)}</tr></tbody></table></div>
    <p class="cap">미국 주식(S&amp;P 500 총수익)·미 10년 국채·금, 월평균 자료 · 사건이 시장에 반영된 달 기준 · 해당국 자산(예: 프랑스 주식)이 아니라 글로벌 기축 자산의 반응입니다.</p>
    <h2 class="sec"><span class="rn">iii</span>지금 나오는 헤드라인 <small>BBC · FT · CNBC · 연합뉴스 · 관련어 필터</small></h2>
    <div id="rnews"><span class="spin"></span></div>
    <h2 class="sec"><span class="rn">iv</span>기관·전문가 시각 원문 <small>요약 없이 원문으로</small></h2>
    <ul class="check">${OUTLOOK.map(([n, u]) => `<li><a href="${u}" target="_blank" rel="noopener noreferrer"><b>${n}</b></a></li>`).join("")}</ul>
    <h2 class="sec"><span class="rn">v</span>방어 점검표 <small>결정 전 5분</small></h2>
    <ol class="check">
      <li><b>노출 확인</b> — 대입한 비중의 확전 시나리오 손실 <b class="neg">${C.pct(sc[2].ret)}</b>. 이 손실을 견딜 수 없다면 감내 한도(A면 성향)를 넘은 것입니다.</li>
      <li><b>방어 자산</b> — 이 유형의 과거 사례에서 채권 중앙값 ${C.pct(sum.during.BD.med)}, 금 ${C.pct(sum.during.GD.med)}. 방어 자산 비중이 0이면 충격을 그대로 받습니다.</li>
      <li><b>현금 여력</b> — 급락 때 분할 매수할 현금(또는 단기채)을 따로 정해 두면 공포 매도를 피하기 쉽습니다.</li>
      <li><b>규칙 우선</b> — <a href="#/desk">투자 데스크</a>의 추세 신호·허용범위 리밸런싱이 바뀌었는지 먼저 봅니다. 뉴스만으로 규칙을 바꾸지 않습니다.</li>
      <li><b>환율</b> — 원화 투자자는 위기 때 달러 강세가 손실을 일부 상쇄하기도 합니다. 환헤지 여부를 확인합니다.</li>
    </ol></div>`;
    el.querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => { settings.riskType = b.dataset.t; saveSettings(); draw(b.dataset.t, src); }));
    $("#rsrc").onchange = (e) => draw(type, e.target.value);
    news(type);
  };
  const news = async (type) => {
    const box = $("#rnews"); if (!box) return;
    const kw = new RegExp((type === "all" ? K.EVENTS : K.EVENTS.filter((e) => e.type === type)).map((e) => e.kw).join("|") + "|risk|리스크|지정학|geopolit|sanction|제재", "i");
    try {
      const j = await (await fetch("/api/news?topic=world")).json(), hit = (j.world || []).filter((a) => kw.test(a.title)).slice(0, 10), list = hit.length ? hit : (j.world || []).slice(0, 8);
      box.innerHTML = `${hit.length ? "" : '<p class="muted small">관련어에 맞는 기사가 없어 최신 국제 헤드라인을 보여 줍니다.</p>'}<ol class="hl">${list.map((a) => `<li><a href="${esc(a.link)}" target="_blank" rel="noopener noreferrer">${esc(a.title)}</a><small>${esc(a.src)}</small></li>`).join("")}</ol>${j.failed?.length ? `<p class="cap">응답 없는 출처: ${esc(j.failed.join(", "))}</p>` : ""}`;
    } catch { box.innerHTML = `<p class="muted">뉴스 서버 응답 없음(정적 미리보기).</p>`; }
  };
  draw(sel, vaultOpen ? "mine" : settings.strategy && Q.STRATEGIES[settings.strategy] ? settings.strategy : "s6040");
}
risk.title = "리스크 상황실";
