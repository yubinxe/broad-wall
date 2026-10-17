// BROAD & WALL 퀀트 엔진 — 의존성 0, 브라우저·Node 공용 (ES module)
// 원칙: t 월말에 알 수 있는 정보만으로 비중을 정하고 t+1 월 수익에 적용한다(1개월 실행 지연).

export const ASSETS = ["EQ", "BD", "GD", "CASH"];
export const ASSET_LABEL = { EQ: "미국 주식", BD: "미국 10년 국채", GD: "금", CASH: "현금" };
export const SPLITS = [
  { key: "train", label: "학습", from: "1973-01", to: "1999-12" },
  { key: "valid", label: "검증", from: "2000-01", to: "2012-12" },
  { key: "test", label: "테스트", from: "2013-01", to: "9999-12" },
];

// ── 데이터 → 월간 총수익 ──
export function prepare(market) {
  const idx = Object.fromEntries(market.cols.map((c, i) => [c, i]));
  const rows = market.rows;
  const dates = [], R = { EQ: [], BD: [], GD: [], CASH: [] }, px = { EQ: [], GD: [] }, y10 = [], cpi = [], imputed = [];
  let lastCpi = null;
  for (let t = 0; t < rows.length; t++) {
    const r = rows[t];
    const c = r[idx.cpi] ?? lastCpi; lastCpi = c;
    dates.push(r[idx.d]); px.EQ.push(r[idx.spx]); px.GD.push(r[idx.gold]); y10.push(r[idx.y10]); cpi.push(c);
    imputed.push(market.quality?.imputed?.[r[idx.d]] || null);
    if (t === 0) { ASSETS.forEach((a) => R[a].push(null)); continue; }
    const p = rows[t - 1];
    R.EQ.push(r[idx.spx] / p[idx.spx] - 1 + (p[idx.div] ?? 0) / p[idx.spx] / 12);
    const y0 = p[idx.y10] / 100, y1 = r[idx.y10] / 100;
    // 표면금리 y0 액면채를 한 달 보유 → 잔존 10년-1개월을 y1 로 재평가 + 이자 1개월분
    const n = (10 - 1 / 12) * 2, rr = y1 / 2, cpn = y0 / 2;
    const price = cpn * (1 - Math.pow(1 + rr, -n)) / rr + Math.pow(1 + rr, -n);
    R.BD.push(price - 1 + y0 / 12);
    R.GD.push(r[idx.gold] / p[idx.gold] - 1);
    R.CASH.push(0);
  }
  return { dates, R, px, y10, cpi, imputed, end: dates[dates.length - 1] };
}

// ── 룩어헤드 방지 컨텍스트: t 시점까지만 읽을 수 있다 ──
export function viewAt(D, t) {
  const guard = (k) => { if (k > t) throw new Error(`lookahead: ${D.dates[k]} > ${D.dates[t]}`); return k; };
  return {
    t, date: D.dates[t],
    ret: (a, k = t) => D.R[a][guard(k)],
    price: (a, k = t) => D.px[a][guard(k)],
    y10: (k = t) => D.y10[guard(k)],
    // CPI 는 다음 달 중순 발표 → t 시점엔 t-1 까지만 공개
    cpi: (k = t - 1) => { if (k > t - 1) throw new Error("lookahead: CPI 발표 지연"); return D.cpi[k]; },
    cumRet(a, n) { let g = 1; for (let k = t - n + 1; k <= t; k++) g *= 1 + this.ret(a, k); return g - 1; },
    vol(a, n) { const xs = []; for (let k = t - n + 1; k <= t; k++) xs.push(this.ret(a, k)); return stdev(xs) * Math.sqrt(12); },
    sma(a, n) { let s = 0; for (let k = t - n + 1; k <= t; k++) s += this.price(a, k); return s / n; },
  };
}

// ── 통계 ──
export const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
export function stdev(xs) { const m = mean(xs); return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, xs.length - 1)); }

export function metrics(rets, bench) {
  const n = rets.length; if (!n) return null;
  let g = 1, peak = 1, mdd = 0, ddStart = 0, worstStart = 0, worstEnd = 0;
  const curve = [];
  rets.forEach((r, i) => { g *= 1 + r; curve.push(g); if (g > peak) { peak = g; ddStart = i; } const dd = g / peak - 1; if (dd < mdd) { mdd = dd; worstStart = ddStart; worstEnd = i; } });
  const years = n / 12, cagr = Math.pow(g, 1 / years) - 1, vol = stdev(rets) * Math.sqrt(12);
  const down = rets.filter((r) => r < 0), dvol = Math.sqrt(down.reduce((a, r) => a + r * r, 0) / Math.max(1, n)) * Math.sqrt(12);
  const out = { months: n, total: g - 1, cagr, vol, sharpe: vol ? (mean(rets) * 12) / vol : 0, sortino: dvol ? (mean(rets) * 12) / dvol : 0,
    mdd, calmar: mdd ? cagr / Math.abs(mdd) : 0, best: Math.max(...rets), worst: Math.min(...rets), hit: rets.filter((r) => r > 0).length / n, mddWindow: [worstStart, worstEnd] };
  if (bench && bench.length === n) {
    const mb = mean(bench), mr = mean(rets); let cov = 0, vb = 0;
    for (let i = 0; i < n; i++) { cov += (rets[i] - mr) * (bench[i] - mb); vb += (bench[i] - mb) ** 2; }
    out.beta = vb ? cov / vb : 0; out.corr = cov / Math.sqrt(vb * rets.reduce((a, r) => a + (r - mr) ** 2, 0)) || 0;
    const act = rets.map((r, i) => r - bench[i]); out.te = stdev(act) * Math.sqrt(12); out.ir = out.te ? (mean(act) * 12) / out.te : 0;
  }
  return out;
}

// ── 백테스트 ──
export const DEFAULT_COSTS = { costBps: 10, slipBps: 5, taxRate: 0.22, deduction: 2_500_000, capital: 100_000_000, rebalance: "monthly", band: 0.05 };
const isRebalMonth = (date, mode) => mode === "monthly" || (mode === "quarterly" && ["03", "06", "09", "12"].includes(date.slice(5))) || (mode === "annual" && date.endsWith("-12"));

export function backtest(D, strategy, params = {}, costs = DEFAULT_COSTS) {
  const c = { ...DEFAULT_COSTS, ...costs };
  const warm = strategy.warmup ?? 12, T = D.dates.length;
  const w = Object.fromEntries(ASSETS.map((a) => [a, 0]));
  let V = c.capital; const val = Object.fromEntries(ASSETS.map((a) => [a, 0])), basis = Object.fromEntries(ASSETS.map((a) => [a, 0]));
  const out = { dates: [], rets: [], weights: [], contrib: Object.fromEntries(ASSETS.map((a) => [a, 0])), costs: 0, taxes: 0, turnover: 0, trades: 0, realized: 0, log: [] };
  let realizedYear = 0, invested = false;
  for (let t = warm; t < T; t++) {
    // 1) t 월 수익 반영 (t-1 월말에 정한 보유)
    if (invested) {
      const V0 = V; let gain = 0;
      for (const a of ASSETS) { const g = val[a] * D.R[a][t]; out.contrib[a] += V0 ? g / V0 : 0; val[a] += g; gain += g; }
      V = ASSETS.reduce((s, a) => s + val[a], 0);
      out.dates.push(D.dates[t]); out.rets.push(V / V0 - 1); out.weights.push(ASSETS.map((a) => (V ? val[a] / V : 0)));
    }
    // 2) 연말 세금: 해당 연도 순실현이익 - 공제
    if (D.dates[t].endsWith("-12") && invested) {
      const tax = Math.max(0, realizedYear - c.deduction) * c.taxRate;
      if (tax > 0) { const keep = 1 - tax / V; for (const a of ASSETS) { val[a] *= keep; basis[a] *= keep; } V -= tax; out.taxes += tax; out.rets[out.rets.length - 1] = (1 + out.rets[out.rets.length - 1]) * (1 - tax / (V + tax)) - 1; }
      realizedYear = 0;
    }
    if (t === T - 1) break;
    // 3) t 월말 신호 → t+1 적용
    const target = normalize(strategy.weights(viewAt(D, t), params));
    const cur = Object.fromEntries(ASSETS.map((a) => [a, V ? val[a] / V : 0]));
    const drift = ASSETS.reduce((m, a) => Math.max(m, Math.abs((target[a] || 0) - cur[a])), 0);
    const doIt = !invested || (c.rebalance === "band" ? drift > c.band : isRebalMonth(D.dates[t], c.rebalance));
    if (doIt) {
      const turn = ASSETS.reduce((s, a) => s + Math.abs((target[a] || 0) - cur[a]), 0) / 2;
      const fee = invested ? turn * V * (c.costBps + c.slipBps) / 1e4 : V * (c.costBps + c.slipBps) / 1e4;
      for (const a of ASSETS) { // 매도분 실현손익
        const tv = (target[a] || 0) * (V - fee);
        if (tv < val[a] && val[a] > 0) { const sold = val[a] - tv, g = sold * (1 - basis[a] / val[a]); realizedYear += g; out.realized += g; basis[a] -= sold * (basis[a] / val[a]); }
        else if (tv > val[a]) basis[a] += tv - val[a];
        val[a] = tv;
      }
      V -= fee; out.costs += fee; if (invested) { out.turnover += turn; if (turn > 1e-6) out.trades++; }
      invested = true;
    }
  }
  out.final = V; out.years = out.rets.length / 12;
  out.annualTurnover = out.years ? out.turnover / out.years : 0;
  return out;
}
function normalize(w) { const s = ASSETS.reduce((a, k) => a + Math.max(0, w[k] || 0), 0) || 1; return Object.fromEntries(ASSETS.map((k) => [k, Math.max(0, w[k] || 0) / s])); }

export function slice(bt, from, to) {
  const i0 = bt.dates.findIndex((d) => d >= from); if (i0 < 0) return [];
  const out = []; for (let i = i0; i < bt.dates.length && bt.dates[i] <= to; i++) out.push(bt.rets[i]); return out;
}
export function splitMetrics(bt, bench) {
  const bm = bench ? new Map(bench.dates.map((d, i) => [d, bench.rets[i]])) : null;
  return SPLITS.map((s) => {
    const i0 = bt.dates.findIndex((d) => d >= s.from), r = [], b = [];
    if (i0 >= 0) for (let i = i0; i < bt.dates.length && bt.dates[i] <= s.to; i++) { r.push(bt.rets[i]); if (bm) b.push(bm.get(bt.dates[i])); }
    const okB = bm && b.every((x) => x != null);
    return { ...s, to: s.to === "9999-12" ? bt.dates[bt.dates.length - 1] : s.to, m: metrics(r, okB ? b : null) };
  });
}
export function annualReturns(bt) {
  const y = {}; bt.dates.forEach((d, i) => { const k = d.slice(0, 4); y[k] = (y[k] ?? 1) * (1 + bt.rets[i]); });
  return Object.entries(y).map(([k, g]) => [k, g - 1]);
}
export function drawdowns(rets) { let g = 1, p = 1; return rets.map((r) => { g *= 1 + r; p = Math.max(p, g); return g / p - 1; }); }

// ── 전략 ──
const fixed = (w) => () => w;
export const STRATEGIES = {
  s6040: { name: "60/40 정적 배분", kind: "정적", desc: "주식 60 · 채권 40을 정해진 주기로 되돌린다. 기관 포트폴리오의 오래된 기준점.", warmup: 1, weights: fixed({ EQ: 0.6, BD: 0.4 }), grid: [{}], risk: 3 },
  permanent: { name: "삼분 영구 포트폴리오", kind: "정적", desc: "주식·채권·금을 1/3씩. 성장·디플레이션·인플레이션 국면을 하나씩 맡긴다.", warmup: 1, weights: fixed({ EQ: 1 / 3, BD: 1 / 3, GD: 1 / 3 }), grid: [{}], risk: 2 },
  dualmom: { name: "듀얼 모멘텀", kind: "추세", desc: "주식과 금 중 최근 L개월 수익이 높은 쪽을 보유하되, 그 수익이 채권보다 낮으면 채권으로 피신한다.", warmup: 12,
    weights: (v, p) => { const L = p.L || 12, e = v.cumRet("EQ", L), g = v.cumRet("GD", L), b = v.cumRet("BD", L); const best = e >= g ? "EQ" : "GD"; return Math.max(e, g) > b ? { [best]: 1 } : { BD: 1 }; },
    grid: [{ L: 6 }, { L: 9 }, { L: 12 }], risk: 4 },
  trend: { name: "이동평균 추세추종", kind: "추세", desc: "주식·금·채권을 1/3씩 두고, 주식과 금은 N개월 이동평균 아래로 내려가면 그 몫을 채권으로 옮긴다.", warmup: 12,
    weights: (v, p) => { const N = p.N || 10, w = { EQ: 0, GD: 0, BD: 1 / 3 }; for (const a of ["EQ", "GD"]) { if (v.price(a) > v.sma(a, N)) w[a] = 1 / 3; else w.BD += 1 / 3; } return w; },
    grid: [{ N: 8 }, { N: 10 }, { N: 12 }], risk: 3 },
  voltarget: { name: "변동성 타깃", kind: "위험관리", desc: "최근 12개월 주식 변동성으로 주식 비중을 조절해 목표 변동성에 맞추고 나머지는 채권에 둔다.", warmup: 12,
    weights: (v, p) => { const tv = p.target || 0.1, e = Math.min(1, tv / Math.max(0.01, v.vol("EQ", 12))); return { EQ: e, BD: 1 - e }; },
    grid: [{ target: 0.08 }, { target: 0.1 }, { target: 0.12 }], risk: 3 },
  riskparity: { name: "역변동성 리스크 패리티", kind: "위험관리", desc: "최근 L개월 변동성의 역수로 주식·채권·금 비중을 정해 위험 기여를 고르게 한다.", warmup: 12,
    weights: (v, p) => { const L = p.L || 12, inv = Object.fromEntries(["EQ", "BD", "GD"].map((a) => [a, 1 / Math.max(0.01, v.vol(a, L))])); return inv; },
    grid: [{ L: 6 }, { L: 12 }, { L: 24 }], risk: 2 },
  eq: { name: "미국 주식 매수 보유", kind: "벤치마크", desc: "S&P 500 총수익(배당 재투자) — 비교 기준.", warmup: 1, weights: fixed({ EQ: 1 }), grid: [{}], risk: 5, benchmark: true },
};

// 학습 구간 Sharpe 로만 파라미터 선택 → 검증·테스트는 손대지 않는다
export function selectParams(D, key, costs) {
  const s = STRATEGIES[key];
  const rows = s.grid.map((p) => { const bt = backtest(D, s, p, costs); const m = metrics(slice(bt, SPLITS[0].from, SPLITS[0].to)); return { p, sharpe: m?.sharpe ?? -Infinity, cagr: m?.cagr, mdd: m?.mdd }; });
  const best = rows.reduce((a, b) => (b.sharpe > a.sharpe ? b : a));
  return { best: best.p, grid: rows };
}

// ── 포트폴리오 위험 · 시나리오 ──
export const STRESS = [
  { key: "oil73", label: "1973–74 오일쇼크 · 스태그플레이션", from: "1973-01", to: "1974-09" },
  { key: "bm87", label: "1987 블랙먼데이", from: "1987-09", to: "1987-11" },
  { key: "dot", label: "2000–02 닷컴 붕괴", from: "2000-09", to: "2002-09" },
  { key: "gfc", label: "2007–09 글로벌 금융위기", from: "2007-11", to: "2009-02" },
  { key: "covid", label: "2020 코로나 급락", from: "2020-02", to: "2020-03" },
  { key: "rate22", label: "2022 금리 급등", from: "2022-01", to: "2022-10" },
];
export function stressTest(D, weights) {
  return STRESS.map((s) => {
    let g = 1; const per = Object.fromEntries(ASSETS.map((a) => [a, 1]));
    D.dates.forEach((d, t) => { if (t && d >= s.from && d <= s.to) { let r = 0; for (const a of ASSETS) { r += (weights[a] || 0) * D.R[a][t]; per[a] *= 1 + D.R[a][t]; } g *= 1 + r; } });
    return { ...s, ret: g - 1, assets: Object.fromEntries(ASSETS.map((a) => [a, per[a] - 1])) };
  });
}
export function riskEstimate(D, weights, years = 10) {
  const T = D.dates.length, from = Math.max(1, T - years * 12), A = ["EQ", "BD", "GD"];
  const X = A.map((a) => D.R[a].slice(from)), m = X.map(mean);
  const cov = A.map((_, i) => A.map((_, j) => X[i].reduce((s, x, k) => s + (x - m[i]) * (X[j][k] - m[j]), 0) / (X[i].length - 1) * 12));
  const w = A.map((a) => weights[a] || 0); const cw = cov.map((row) => row.reduce((s, c, j) => s + c * w[j], 0));
  const varP = w.reduce((s, wi, i) => s + wi * cw[i], 0), vol = Math.sqrt(Math.max(0, varP));
  return { vol, window: `${D.dates[from]}–${D.end}`, contrib: Object.fromEntries(A.map((a, i) => [a, varP ? (w[i] * cw[i]) / varP : 0])), var95m: 1.645 * vol / Math.sqrt(12) };
}
