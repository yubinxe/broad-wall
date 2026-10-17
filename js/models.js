// 예측 모델 워크포워드 평가 — 다음 달 미국 주식 수익(방향)을 예측해 보고, 기준선과 실전 규칙으로 비교한다.
// 학습(1973–1999) → 검증(2000–2012) → 테스트(2013–) 순서로 시간만 앞으로 간다. 매년 1월 재학습(확장 창).
import { viewAt, metrics, mean, backtest, SPLITS } from "./quant.js";

export const FEATURES = [
  ["mom1", "주식 1개월 수익"], ["mom3", "주식 3개월 수익"], ["mom12", "주식 12개월 수익"], ["vol12", "주식 12개월 변동성"],
  ["y10", "10년 금리 수준"], ["dy3", "10년 금리 3개월 변화"], ["gold12", "금 12개월 수익"], ["infl", "CPI 전년비(발표 지연 1개월 반영)"],
];
export function featuresAt(D, t) {
  const v = viewAt(D, t);
  return [v.ret("EQ"), v.cumRet("EQ", 3), v.cumRet("EQ", 12), v.vol("EQ", 12), v.y10() / 100, (v.y10() - v.y10(t - 3)) / 100, v.cumRet("GD", 12), v.cpi(t - 1) / v.cpi(t - 13) - 1];
}

// ── 결정적 난수(재현성) ──
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

function standardize(X) {
  const k = X[0].length, mu = Array(k).fill(0), sd = Array(k).fill(0);
  X.forEach((x) => x.forEach((v, j) => (mu[j] += v / X.length)));
  X.forEach((x) => x.forEach((v, j) => (sd[j] += (v - mu[j]) ** 2 / X.length)));
  const s = sd.map((v) => Math.sqrt(v) || 1);
  return { f: (x) => x.map((v, j) => (v - mu[j]) / s[j]) };
}
function ridge(X, y, lambda = 1) { // 정규방정식 (k ≤ 9)
  const n = X.length, k = X[0].length + 1, A = Array.from({ length: k }, () => Array(k).fill(0)), b = Array(k).fill(0);
  for (let i = 0; i < n; i++) { const xi = [1, ...X[i]]; for (let p = 0; p < k; p++) { b[p] += xi[p] * y[i]; for (let q = 0; q < k; q++) A[p][q] += xi[p] * xi[q]; } }
  for (let p = 1; p < k; p++) A[p][p] += lambda;
  for (let c = 0; c < k; c++) { let piv = c; for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r; [A[c], A[piv]] = [A[piv], A[c]]; [b[c], b[piv]] = [b[piv], b[c]]; for (let r = 0; r < k; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let q = c; q < k; q++) A[r][q] -= f * A[c][q]; b[r] -= f * b[c]; } }
  const w = b.map((v, i) => v / A[i][i]); return (x) => w[0] + x.reduce((s, v, j) => s + v * w[j + 1], 0);
}
function logistic(X, y, lambda = 0.5, iters = 400, lr = 0.2) {
  const k = X[0].length; let w = Array(k).fill(0), b0 = 0;
  for (let it = 0; it < iters; it++) {
    const gw = Array(k).fill(0); let gb = 0;
    for (let i = 0; i < X.length; i++) { const z = b0 + X[i].reduce((s, v, j) => s + v * w[j], 0), p = 1 / (1 + Math.exp(-z)), e = p - y[i]; gb += e; X[i].forEach((v, j) => (gw[j] += e * v)); }
    b0 -= (lr * gb) / X.length; w = w.map((wj, j) => wj - lr * (gw[j] / X.length + (lambda * wj) / X.length));
  }
  return (x) => 1 / (1 + Math.exp(-(b0 + x.reduce((s, v, j) => s + v * w[j], 0))));
}
function tree(X, y, idx, depth, feats, rand) { // 지니 분할 결정트리
  const p = mean(idx.map((i) => y[i]));
  if (depth === 0 || idx.length < 20 || p === 0 || p === 1) return { p };
  let best = null;
  const fs = feats.slice().sort(() => rand() - 0.5).slice(0, Math.max(2, Math.round(Math.sqrt(feats.length))));
  for (const f of fs) {
    const vals = idx.map((i) => X[i][f]).sort((a, b) => a - b);
    for (const q of [0.25, 0.5, 0.75]) {
      const th = vals[Math.floor(q * (vals.length - 1))], L = idx.filter((i) => X[i][f] <= th), R = idx.filter((i) => X[i][f] > th);
      if (L.length < 10 || R.length < 10) continue;
      const g = (a) => { const m = mean(a.map((i) => y[i])); return a.length * m * (1 - m); }, s = g(L) + g(R);
      if (!best || s < best.s) best = { s, f, th, L, R };
    }
  }
  if (!best) return { p };
  return { f: best.f, th: best.th, l: tree(X, y, best.L, depth - 1, feats, rand), r: tree(X, y, best.R, depth - 1, feats, rand) };
}
const walk = (n, x) => (n.p !== undefined ? n.p : walk(x[n.f] <= n.th ? n.l : n.r, x));
function forest(X, y, { trees = 60, depth = 3, seed = 7 } = {}) {
  const rand = rng(seed), feats = X[0].map((_, j) => j), T = [];
  for (let t = 0; t < trees; t++) { const idx = X.map(() => Math.floor(rand() * X.length)); T.push(tree(X, y, idx, depth, feats, rand)); }
  return (x) => mean(T.map((n) => walk(n, x)));
}

export const MODELS = {
  base: { name: "기준선 — 과거 평균", kind: "기준", desc: "확장 창의 평균 수익과 상승 빈도만 쓴다. 다른 모델은 이것을 이겨야 의미가 있다." },
  ar1: { name: "AR(1) 자기회귀", kind: "시계열", desc: "지난달 수익으로 다음 달을 예측하는 가장 단순한 ARIMA 계열(ARIMA(1,0,0))." },
  ridge: { name: "릿지 선형회귀", kind: "회귀", desc: "8개 특성의 선형 결합 · L2 규제." },
  logit: { name: "로지스틱 회귀", kind: "분류", desc: "다음 달 상승 확률을 직접 추정." },
  forest: { name: "랜덤 포레스트", kind: "앙상블 트리", desc: "깊이 3 결정트리 60개 · 부트스트랩 · 특성 무작위 선택(시드 고정)." },
};

export function walkForward(D, { start = "1990-01" } = {}) {
  const T = D.dates.length, first = 13;
  const X = [], Y = [], dates = [];
  for (let t = first; t < T - 1; t++) { X.push(featuresAt(D, t)); Y.push(D.R.EQ[t + 1]); dates.push(D.dates[t + 1]); } // t 월말 특성 → t+1 월 수익
  const preds = Object.fromEntries(Object.keys(MODELS).map((k) => [k, []]));
  const out = { dates: [], y: [], preds };
  let fit = null, fitYear = null;
  for (let i = 0; i < X.length; i++) {
    if (dates[i] < start) continue;
    const year = dates[i].slice(0, 4);
    if (year !== fitYear) { // 1월마다 재학습 — i 이전(이미 실현된) 표본만 사용
      const Xtr = X.slice(0, i), Ytr = Y.slice(0, i), up = Ytr.map((v) => (v > 0 ? 1 : 0)), S = standardize(Xtr), Z = Xtr.map(S.f);
      const ar = ridge(Ytr.slice(0, -1).map((v) => [v]), Ytr.slice(1), 0);
      fit = { S, mu: mean(Ytr), pUp: mean(up), ar, rd: ridge(Z, Ytr, 5), lg: logistic(Z, up), rf: forest(Xtr, up, { seed: Number(year) }) };
      fitYear = year;
    }
    const z = fit.S.f(X[i]), prevY = Y[i - 1];
    preds.base.push({ r: fit.mu, p: fit.pUp });
    const arR = fit.ar([prevY]); preds.ar1.push({ r: arR, p: null });
    const rdR = fit.rd(z); preds.ridge.push({ r: rdR, p: null });
    preds.logit.push({ r: null, p: fit.lg(z) });
    preds.forest.push({ r: null, p: fit.rf(X[i]) });
    out.dates.push(dates[i]); out.y.push(Y[i]);
  }
  return out;
}

// 구간별 평가: OOS R²(vs 과거평균), 방향 적중률(vs 상승 빈도 기준선), Brier
export function evaluate(wf) {
  const segs = [{ key: "valid", label: "검증", from: "1990-01", to: "2012-12" }, { key: "test", label: "테스트", from: SPLITS[2].from, to: "9999-12" }];
  return Object.keys(MODELS).map((k) => {
    const row = { key: k, ...MODELS[k], seg: {} };
    for (const s of segs) {
      const ids = wf.dates.map((d, i) => (d >= s.from && d <= s.to ? i : -1)).filter((i) => i >= 0);
      const y = ids.map((i) => wf.y[i]), P = ids.map((i) => wf.preds[k][i]), B = ids.map((i) => wf.preds.base[i]);
      const r2 = P[0]?.r != null ? 1 - y.reduce((a, v, j) => a + (v - P[j].r) ** 2, 0) / y.reduce((a, v, j) => a + (v - B[j].r) ** 2, 0) : null;
      const dirP = P.map((p) => (p.p != null ? p.p > 0.5 : p.r > 0)), hit = mean(dirP.map((d, j) => (d === y[j] > 0 ? 1 : 0)));
      const baseHit = mean(y.map((v) => (v > 0 ? 1 : 0))); // '항상 상승' 기준 적중률
      const brier = P[0]?.p != null ? mean(P.map((p, j) => (p.p - (y[j] > 0 ? 1 : 0)) ** 2)) : null;
      const brierBase = mean(B.map((b, j) => (b.p - (y[j] > 0 ? 1 : 0)) ** 2));
      const n = y.length, z = (hit - baseHit) / Math.sqrt((baseHit * (1 - baseHit)) / n);
      row.seg[s.key] = { n, r2, hit, baseHit, brier, brierBase, z, from: s.from, to: wf.dates[ids[ids.length - 1]] };
    }
    return row;
  });
}

// 실전 비교: 예측이 '상승'이면 주식, 아니면 채권 — 거래비용·세금 포함 vs 주식 보유
export function tradeModel(D, wf, key, costs) {
  const map = new Map(wf.dates.map((d, i) => [d, wf.preds[key][i]]));
  const strat = { warmup: D.dates.indexOf(wf.dates[0]) - 1, weights: (v) => { const p = map.get(D.dates[v.t + 1]); if (!p) return { BD: 1 }; const up = p.p != null ? p.p > 0.5 : p.r > 0; return up ? { EQ: 1 } : { BD: 1 }; } };
  return backtest(D, strat, {}, costs);
}
