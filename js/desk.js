// 투자 데스크 계산 — DOM 없음(테스트 가능). 모든 값은 t 월말에 공개된 정보만 쓴다.
import * as Q from "./quant.js";

// 과거 분포 속 위치(0~1). xs 는 비교 대상 표본, x 는 현재 값
export const pctRank = (xs, x) => { const v = xs.filter((y) => y != null && isFinite(y)); return v.length ? v.filter((y) => y <= x).length / v.length : null; };

export function thermometer(D, market, t = D.dates.length - 1) {
  const v = Q.viewAt(D, t), idx = Object.fromEntries(market.cols.map((c, i) => [c, i]));
  const series = (f, from = 13) => { const out = []; for (let k = from; k <= t; k++) out.push(f(Q.viewAt(D, k), k)); return out; };
  let peak = 0; const ddS = D.px.EQ.map((p, k) => (k > t ? null : ((peak = Math.max(peak, p)), p / peak - 1)));
  const real = (w, k) => D.y10[k] / 100 - (w.cpi(k - 1) / w.cpi(k - 13) - 1);
  const dy = (k) => market.rows[k][idx.div] / market.rows[k][idx.spx];
  const now = { dd: ddS[t], trendEQ: D.px.EQ[t] / v.sma("EQ", 10) - 1, trendGD: D.px.GD[t] / v.sma("GD", 10) - 1, vol: v.vol("EQ", 12), real: real(v, t), dy: dy(t), y10: D.y10[t] / 100, infl: v.cpi(t - 1) / v.cpi(t - 13) - 1 };
  const mom = Object.fromEntries(["EQ", "BD", "GD"].map((a) => [a, v.cumRet(a, 12)]));
  return {
    date: D.dates[t], now, mom, rank: Object.entries(mom).sort((a, b) => b[1] - a[1]).map(([a]) => a),
    pct: { dd: pctRank(ddS.slice(0, t + 1), now.dd), vol: pctRank(series((w) => w.vol("EQ", 12)), now.vol), real: pctRank(series(real), now.real), dy: pctRank(D.dates.slice(0, t + 1).map((_, k) => dy(k)), now.dy) },
  };
}

// 전략별 이번 달 vs 지난달 목표 비중 — 신호가 바뀐 전략만 표시하는 데 쓴다
export function signalChanges(D, params, t = D.dates.length - 1) {
  return Object.entries(Q.STRATEGIES).filter(([k]) => k !== "eq").map(([k, s]) => {
    const w = (tt) => norm(s.weights(Q.viewAt(D, tt), params[k] || {})), a = w(t - 1), b = w(t);
    const delta = Q.ASSETS.reduce((m, x) => Math.max(m, Math.abs(b[x] - a[x])), 0);
    return { key: k, name: s.name, prev: a, next: b, delta, changed: delta >= 0.01 };
  });
}
const norm = (w) => { const s = Q.ASSETS.reduce((a, k) => a + Math.max(0, w[k] || 0), 0) || 1; return Object.fromEntries(Q.ASSETS.map((k) => [k, Math.max(0, w[k] || 0) / s])); };

// 리밸런싱 주문서: current = 자산군별 현재 금액(원), target = 목표 비중. 비용은 거래 금액 × (수수료+슬리피지)
export function rebalance(current, target, { costBps = 10, slipBps = 5, band = 0.05 } = {}) {
  const total = Q.ASSETS.reduce((s, a) => s + (Number(current[a]) || 0), 0), tw = norm(target);
  const rows = Q.ASSETS.map((a) => { const cur = Number(current[a]) || 0, w = total ? cur / total : 0, tgt = tw[a] * total; return { asset: a, cur, w, tw: tw[a], tgt, diff: tgt - cur, drift: w - tw[a] }; });
  const traded = rows.reduce((s, r) => s + Math.abs(r.diff), 0), maxDrift = rows.reduce((m, r) => Math.max(m, Math.abs(r.drift)), 0);
  return { total, rows, traded, turnover: total ? traded / 2 / total : 0, fee: (traded * (costBps + slipBps)) / 1e4, maxDrift, needed: maxDrift > band, band };
}
