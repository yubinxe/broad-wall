// 돈의 흐름 — 가격이 가리키는 방향(자체 데이터), 부자들의 원칙을 숫자로 검증, 자금 흐름 헤드라인, 부자 보고서 서가.
// 원문을 직접 검증하지 못한 보고서 수치는 싣지 않는다 — 출처 링크로만 안내.
import * as Q from "../quant.js";
import * as C from "../charts.js";
import { $, esc, D, run, bench } from "../core.js";

const L = Q.ASSET_LABEL, A3 = ["EQ", "BD", "GD"];
const REPORTS = [
  ["UBS Global Wealth Report", "UBS", "연 1회", "국가별 가계 순자산·1인당 자산·백만장자 수", "https://www.ubs.com/global/en/wealthmanagement/insights/global-wealth-report.html"],
  ["World Wealth Report", "Capgemini", "연 1회", "고액자산가(HNWI, 투자자산 100만 달러+) 인구·자산·투자 배분", "https://www.capgemini.com/insights/research-library/world-wealth-report/"],
  ["The Wealth Report", "Knight Frank", "연 1회", "초고액자산가 분포·고급 부동산·투자 심리", "https://www.knightfrank.com/wealthreport"],
  ["Private Wealth Migration Report", "Henley & Partners", "연 1회", "백만장자의 국가 간 순유입·순유출 추정", "https://www.henleyglobal.com/publications"],
  ["한국 부자 보고서", "KB경영연구소", "연 1회", "금융자산 10억 원 이상 개인의 자산 구성·투자 성향", "https://www.kbfg.com/kbresearch/"],
  ["대한민국 웰스 리포트", "하나금융경영연구소", "연 1회", "국내 부자의 자산 운용·관심 투자처", "https://www.hanaif.re.kr/"],
  ["World's Billionaires", "Forbes", "연 1회 + 실시간", "억만장자 순위·재산 변동", "https://www.forbes.com/billionaires/"],
  ["Billionaires Index", "Bloomberg", "매 영업일", "상위 500인 순자산 일간 추적", "https://www.bloomberg.com/billionaires/"],
];
const FLOWS = [
  ["미국 펀드 자금 흐름(주간)", "ICI · Investment Company Institute", "https://www.ici.org/research/stats/flows"],
  ["미국 자금순환표 Z.1(분기)", "Federal Reserve", "https://www.federalreserve.gov/releases/z1/"],
  ["한국 자금순환(분기)", "한국은행 ECOS", "https://ecos.bok.or.kr/"],
];
const KW = /(자금|유입|유출|순매수|순매도|부자|자산가|ETF|펀드|머니무브|예금|채권|금값|금 가격|달러|flow|inflow|outflow|wealth|billionaire|fund|ETF|treasur|bond|gold|dollar)/i;

// 고점 대비 가장 오래 물속에 있던 기간(개월)
function longestUnderwater(rets) { let g = 1, p = 1, cur = 0, max = 0; for (const r of rets) { g *= 1 + r; if (g >= p) { p = g; cur = 0; } else max = Math.max(max, ++cur); } return max; }
const corr = (a, b) => { const n = Math.min(a.length, b.length), x = a.slice(-n), y = b.slice(-n), mx = Q.mean(x), my = Q.mean(y); let c = 0, vx = 0, vy = 0; for (let i = 0; i < n; i++) { c += (x[i] - mx) * (y[i] - my); vx += (x[i] - mx) ** 2; vy += (y[i] - my) ** 2; } return c / Math.sqrt(vx * vy); };

export function flows(el) {
  const t = D.dates.length - 1, v = Q.viewAt(D, t), win = [1, 3, 12];
  const tab = A3.map((a) => ({ a, r: Object.fromEntries(win.map((n) => [n, v.cumRet(a, n)])) }));
  const lead = [...tab].sort((x, y) => y.r[12] - x.r[12]), lead3 = [...tab].sort((x, y) => y.r[3] - x.r[3]);
  const eq = bench(), s64 = run("s6040").bt, perm = run("permanent").bt, y0 = D.dates[0].slice(0, 4);
  const grow = eq.rets.reduce((g, r) => g * (1 + r), 1), yrs = eq.rets.length / 12;
  const last = (a, n) => D.R[a].slice(-n);
  const cEB = corr(last("EQ", 120), last("BD", 120)), cEG = corr(last("EQ", 120), last("GD", 120));
  el.innerHTML = `<div class="wrap page"><p class="kicker">특집 · 돈의 흐름</p><h1>전 세계 돈은 지금 어디로 가는가</h1>
  <p class="lede">돈의 흐름은 가격에 먼저 찍힙니다. 주식·채권·금의 최근 수익 순위로 방향을 읽고, 부자들이 오래 지켜 온 원칙이 실제 숫자로도 맞는지 ${D.dates.length}개월 자료로 검증한 뒤, 흐름을 다루는 헤드라인과 원자료를 한곳에 모았습니다.</p>
  <h2 class="sec"><span class="rn">i</span>가격이 가리키는 방향 <small>${D.end} 월말 · 월간 · USD</small></h2>
  <div class="scroll"><table class="ledger"><thead><tr><th>자산</th><th>1개월</th><th>3개월</th><th>12개월</th><th>10개월 추세</th></tr></thead><tbody>
  ${tab.map(({ a, r }) => { const tr = a === "BD" ? null : D.px[a][t] / v.sma(a, 10) - 1; return `<tr><td><b>${L[a]}</b></td>${win.map((n) => `<td class="num ${r[n] >= 0 ? "pos" : "neg"}">${C.pct(r[n])}</td>`).join("")}<td class="num">${tr == null ? "—" : tr >= 0 ? '<span class="pos">이동평균 위</span>' : '<span class="neg">이동평균 아래</span>'}</td></tr>`; }).join("")}
  </tbody></table></div>
  <div class="note" style="margin-top:12px"><b>읽는 법</b> — 12개월 1위는 <b>${L[lead[0].a]}</b>(${C.pct(lead[0].r[12])}), 3개월 1위는 <b>${L[lead3[0].a]}</b>(${C.pct(lead3[0].r[3])})입니다. ${lead[0].a === lead3[0].a ? "장기·단기 선두가 같아 돈의 방향이 한쪽으로 쏠려 있습니다." : "장기 선두와 단기 선두가 달라 자금의 방향이 바뀌는 구간일 수 있습니다."} 가격은 흐름의 결과일 뿐 순유입 금액 자체는 아닙니다 — 실제 유입 규모는 아래 원자료(ICI·연준·한국은행)에서 확인합니다.</div>
  <h2 class="sec"><span class="rn">ii</span>부자들의 원칙, 숫자로 검증 <small>${y0}–${D.end} · 비용·세금 반영</small></h2>
  <div class="therm">
    <div class="tc"><small>오래 버티면 복리가 일한다</small><b>${grow.toFixed(0)}배</b><p>S&amp;P 500을 ${y0}년부터 ${yrs.toFixed(0)}년 보유했다면 비용·세금 차감 후 ${grow.toFixed(0)}배(연 ${C.pctU(Q.metrics(eq.rets).cagr)}). 1억 원은 약 ${C.krwS(1e8 * grow)}이 됩니다.</p></div>
    <div class="tc"><small>잃지 않는 것이 먼저다</small><b>${longestUnderwater(eq.rets)}개월</b><p>주식만 들고 있을 때 고점을 회복하지 못한 가장 긴 기간. 60/40은 ${longestUnderwater(s64.rets)}개월, 삼분 영구 포트폴리오는 ${longestUnderwater(perm.rets)}개월이었습니다.</p></div>
    <div class="tc"><small>분산은 공짜 점심이다</small><b>${C.num(cEG, 2)}</b><p>최근 10년 주식–금 월간 상관계수(1에 가까울수록 같이 움직임). 주식–채권은 ${C.num(cEB, 2)}. 낮을수록 섞었을 때 낙폭이 줄어듭니다.</p></div>
    <div class="tc"><small>비용은 복리로 새어 나간다</small><b>${C.pctU(1 - Math.pow(1.06 / 1.07, 30), 0)}</b><p>연 수익 7%에서 수수료 1%p를 더 내면 30년 뒤 최종 자산이 이만큼 줄어듭니다((1.06/1.07)³⁰ 기준 계산).</p></div>
  </div>
  <p class="cap">모두 이 사이트의 월간 공개 자료와 백테스트 엔진으로 계산한 값입니다. 특정 인물의 발언·재산 수치를 인용하지 않습니다.</p>
  <h2 class="sec"><span class="rn">iii</span>흐름을 다루는 오늘의 헤드라인 <small>공식 RSS · 제목·링크만</small></h2>
  <div class="grid g2" id="flowNews"><p class="muted"><span class="spin"></span> 불러오는 중…</p></div>
  <h2 class="sec"><span class="rn">iv</span>부자 보고서 서가 <small>원문에서 수치를 확인하세요</small></h2>
  <div class="scroll"><table class="ledger cards"><thead><tr><th>보고서</th><th>발행</th><th>주기</th><th>무엇을 보나</th></tr></thead><tbody>
  ${REPORTS.map(([n, p, c, w, u]) => `<tr><td data-l="보고서"><a href="${u}" target="_blank" rel="noopener noreferrer"><b>${n}</b></a></td><td data-l="발행">${p}</td><td data-l="주기">${c}</td><td data-l="무엇을 보나">${w}</td></tr>`).join("")}
  </tbody></table></div>
  <h3 style="margin-top:22px">실제 자금 흐름 원자료</h3>
  <ul class="check">${FLOWS.map(([n, p, u]) => `<li><a href="${u}" target="_blank" rel="noopener noreferrer"><b>${n}</b></a> — ${p}</li>`).join("")}</ul>
  <p class="note warn" style="margin-top:14px"><b>수치 정책</b> — 보고서 원문을 이 작업 환경에서 직접 확인하지 못해 순위·인원·금액 같은 수치는 옮기지 않았습니다. 확인된 수치만 추가합니다.</p></div>`;
  (async () => {
    const box = $("#flowNews");
    try {
      const j = await (await fetch("/api/news")).json(), pick = (l) => { const f = l.filter((a) => KW.test(a.title)); return (f.length >= 3 ? f : l).slice(0, 6); };
      const col = (h, l) => `<div><h3>${h}</h3><ol class="hl">${pick(l).map((a) => `<li><a href="${esc(a.link)}" target="_blank" rel="noopener noreferrer">${esc(a.title)}</a><small>${esc(a.src)}</small></li>`).join("") || '<li class="muted">없음</li>'}</ol></div>`;
      box.innerHTML = col("한국", j.kr || []) + col("미국·글로벌", j.us || []);
    } catch { box.innerHTML = `<p class="muted">뉴스 서버 응답 없음.</p>`; }
  })();
}
flows.title = "돈의 흐름";
