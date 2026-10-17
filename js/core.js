// 공용 상태·계산 캐시·헬퍼 — 화면 모듈이 함께 쓴다.
import * as Q from "./quant.js";
import * as R from "./profile.js";
import * as C from "./charts.js";

export const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const SKEY = "meridian.v2.settings";
export const settings = Object.assign({ costs: { ...Q.DEFAULT_COSTS }, answers: {}, strategy: null, mask: false }, (() => { try { return JSON.parse(localStorage.getItem(SKEY)) || {}; } catch { return {}; } })());
export const saveSettings = () => { try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch {} };
export let market, D; export const cache = new Map();
export function setMarket(m) { market = m; D = Q.prepare(m); }
export const refresh = () => dispatchEvent(new HashChangeEvent("hashchange")); // 현재 경로 다시 그리기

// ── 공통 계산 캐시 ──
export function run(key) {
  const ck = key + JSON.stringify(settings.costs); if (cache.has(ck)) return cache.get(ck);
  const sel = Q.selectParams(D, key, settings.costs), bt = Q.backtest(D, Q.STRATEGIES[key], sel.best, settings.costs);
  const out = { key, sel, bt }; cache.set(ck, out); return out;
}
export const bench = () => run("eq").bt;
export const profileResult = () => R.score(settings.answers);
export const currentWeights = (key) => { const p = run(key).sel.best; return Q.STRATEGIES[key].weights(Q.viewAt(D, D.dates.length - 1), p); };
export const norm = (w) => { const s = Object.values(w).reduce((a, b) => a + (b || 0), 0) || 1; return Object.fromEntries(Q.ASSETS.map((a) => [a, (w[a] || 0) / s])); };

// ── II 전략 ──
export function costForm() {
  const c = settings.costs;
  return `<details class="fold" ${location.hash.includes("strategies") ? "open" : ""}><summary>거래 가정 — 수수료 ${c.costBps}bp · 슬리피지 ${c.slipBps}bp · 양도세 ${C.pctU(c.taxRate, 0)} · 리밸런싱 ${({ monthly: "매월", quarterly: "분기", annual: "연 1회", band: "허용범위" })[c.rebalance]}</summary>
  <form id="cf" class="formrow">
    <label class="field">편도 수수료 (bp)<input name="costBps" type="number" min="0" max="200" step="1" value="${c.costBps}"></label>
    <label class="field">슬리피지 (bp)<input name="slipBps" type="number" min="0" max="200" step="1" value="${c.slipBps}"></label>
    <label class="field">실현이익 세율<input name="taxRate" type="number" min="0" max="0.5" step="0.01" value="${c.taxRate}"></label>
    <label class="field">연 기본공제 (원)<input name="deduction" type="number" min="0" step="100000" value="${c.deduction}"></label>
    <label class="field">초기 자본 (원)<input name="capital" type="number" min="1000000" step="1000000" value="${c.capital}"></label>
    <label class="field">리밸런싱<select name="rebalance">${[["monthly", "매월"], ["quarterly", "분기"], ["annual", "연 1회(12월)"], ["band", "허용범위 이탈 시"]].map(([v, t]) => `<option value="${v}" ${c.rebalance === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
    <label class="field">허용범위(±)<input name="band" type="number" min="0.01" max="0.3" step="0.01" value="${c.band}"></label>
  </form><p class="small muted">기본값: 국내 증권사 해외주식 온라인 수수료 수준 10bp, 슬리피지 5bp, 해외주식 양도소득세 22%(연 250만 원 공제) 단순화 모형 — 연말 실현이익에 과세, 손실은 같은 해 이익과만 상계. 환율 효과·배당소득세는 반영하지 않습니다.</p></details>`;
}
export function bindCost(el, redraw) { const f = $("#cf", el); if (!f) return; f.onchange = () => { const fd = new FormData(f); for (const [k, v] of fd) settings.costs[k] = k === "rebalance" ? v : Number(v); saveSettings(); redraw(); }; }
