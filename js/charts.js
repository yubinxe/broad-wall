// SVG 차트 — 의존성 0. 모든 차트는 출처·단위·기준 시점을 캡션으로 함께 받는다.
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const pct = (v, d = 1) => (v == null || !isFinite(v) ? "—" : (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(d) + "%");
export const pctU = (v, d = 1) => (v == null || !isFinite(v) ? "—" : (v * 100).toFixed(d) + "%");
export const num = (v, d = 2) => (v == null || !isFinite(v) ? "—" : v.toFixed(d));
export const krw = (v) => (v == null || !isFinite(v) ? "—" : (v < 0 ? "−₩" : "₩") + Math.abs(Math.round(v)).toLocaleString("ko-KR"));
// 큰 금액은 억·만 단위로 (KPI 칸 폭 보호)
export const krwS = (v) => { if (v == null || !isFinite(v)) return "—"; const a = Math.abs(v), s = v < 0 ? "−" : ""; if (a >= 1e12) return s + "₩" + (a / 1e12).toFixed(2) + "조"; if (a >= 1e8) return s + "₩" + (a / 1e8).toFixed(a >= 1e10 ? 0 : 2) + "억"; if (a >= 1e4) return s + "₩" + Math.round(a / 1e4).toLocaleString("ko-KR") + "만"; return s + "₩" + Math.round(a); };
export const SERIES = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)"];

// 누적 수익 선 차트 (로그 축) + 십자선 툴팁
export function lineChart(el, { dates, series, log = true, caption, height = 300, fmt = (v) => v.toFixed(2) + "×", markers = [] }) {
  const W = Math.max(320, el.clientWidth || 640), H = height, L = 52, R = 14, T = 14, B = 26;
  const all = series.flatMap((s) => s.values.filter((v) => v != null && v > 0));
  const tf = log ? Math.log : (v) => v, lo = tf(Math.min(...all)), hi = tf(Math.max(...all));
  const x = (i) => L + (i / (dates.length - 1)) * (W - L - R), y = (v) => T + (1 - (tf(v) - lo) / (hi - lo || 1)) * (H - T - B);
  const ticks = []; if (log) { for (let p = Math.floor(Math.log10(Math.min(...all))); p <= Math.ceil(Math.log10(Math.max(...all))); p++) for (const m of [1, 2, 5]) { const v = m * 10 ** p; if (v >= Math.min(...all) && v <= Math.max(...all)) ticks.push(v); } } else for (let k = 0; k <= 4; k++) ticks.push(Math.exp(lo) + 0);
  let g = "";
  ticks.forEach((v) => (g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${fmt(v)}</text>`));
  const years = [...new Set(dates.map((d) => d.slice(0, 4)))], step = Math.ceil(years.length / Math.max(3, Math.floor((W - L) / 70)));
  years.forEach((yr, k) => { if (k % step) return; const i = dates.findIndex((d) => d.startsWith(yr)); g += `<text class="ax" x="${x(i)}" y="${H - 8}" text-anchor="middle">${yr}</text>`; });
  markers.forEach((m) => { const i = dates.findIndex((d) => d >= m.date); if (i > 0) g += `<line class="mark" x1="${x(i)}" x2="${x(i)}" y1="${T}" y2="${H - B}"/><text class="mk" x="${x(i) + 4}" y="${T + 10}">${esc(m.label)}</text>`; });
  series.forEach((s, k) => { const d = s.values.map((v, i) => (v == null ? "" : `${i && s.values[i - 1] != null ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).join(""); g += `<path d="${d}" fill="none" stroke="${s.color || SERIES[k]}" stroke-width="${s.width || (k ? 1.4 : 2.2)}" ${s.dash ? 'stroke-dasharray="4 3"' : ""} vector-effect="non-scaling-stroke"/>`; });
  const legend = series.map((s, k) => `<span><i style="background:${s.color || SERIES[k]}"></i>${esc(s.name)}</span>`).join("");
  el.innerHTML = `<div class="legend">${legend}</div><div class="plot"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(caption)}">${g}<line class="xh" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/></svg><div class="tip" hidden></div></div><p class="cap">${esc(caption)}</p>`;
  hover(el, { W, L, R, n: dates.length, render: (i) => `<b>${dates[i]}</b>${series.map((s, k) => `<span><i style="background:${s.color || SERIES[k]}"></i>${esc(s.name)} ${s.values[i] == null ? "—" : fmt(s.values[i])}</span>`).join("")}`, xAt: x });
}

export function areaChart(el, { dates, values, caption, height = 140, color = "var(--neg)" }) {
  const W = Math.max(320, el.clientWidth || 640), H = height, L = 52, R = 14, T = 8, B = 22, lo = Math.min(...values, -0.01);
  const x = (i) => L + (i / (dates.length - 1)) * (W - L - R), y = (v) => T + (v / lo) * (H - T - B);
  let g = ""; [0, lo / 2, lo].forEach((v) => (g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${pct(v, 0)}</text>`));
  g += `<path d="M${x(0)},${y(0)}${values.map((v, i) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("")}L${x(values.length - 1)},${y(0)}Z" fill="${color}" fill-opacity=".22" stroke="${color}" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`;
  el.innerHTML = `<div class="plot"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(caption)}">${g}<line class="xh" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/></svg><div class="tip" hidden></div></div><p class="cap">${esc(caption)}</p>`;
  hover(el, { W, L, R, n: dates.length, render: (i) => `<b>${dates[i]}</b><span>낙폭 ${pct(values[i])}</span>`, xAt: x });
}

function hover(el, { W, L, R, n, render, xAt }) {
  const svg = el.querySelector("svg"), tip = el.querySelector(".tip"), xh = el.querySelector(".xh");
  const move = (ev) => {
    const r = svg.getBoundingClientRect(), px = ((ev.touches?.[0]?.clientX ?? ev.clientX) - r.left) * (W / r.width);
    const i = Math.max(0, Math.min(n - 1, Math.round(((px - L) / (W - L - R)) * (n - 1))));
    xh.setAttribute("x1", xAt(i)); xh.setAttribute("x2", xAt(i)); xh.setAttribute("visibility", "visible");
    tip.hidden = false; tip.innerHTML = render(i); const left = (xAt(i) / W) * r.width; tip.style.left = Math.min(r.width - tip.offsetWidth - 4, Math.max(4, left + 12)) + "px";
  };
  const out = () => { tip.hidden = true; xh.setAttribute("visibility", "hidden"); };
  svg.addEventListener("pointermove", move); svg.addEventListener("pointerleave", out); svg.addEventListener("touchmove", move, { passive: true });
}

export function heatmap(el, { rows, caption }) { // rows: [[year, ret]]
  el.innerHTML = `<div class="heat">${rows.map(([y, r]) => { const a = Math.min(1, Math.abs(r) / 0.3); return `<div class="hc" style="--a:${a.toFixed(2)};--h:${r >= 0 ? "var(--pos)" : "var(--neg)"}" title="${y} ${pct(r)}"><span>${y.slice(2)}</span><b>${pct(r, 0)}</b></div>`; }).join("")}</div><p class="cap">${esc(caption)}</p>`;
}

export function donut(el, { parts, caption, center }) { // parts: [{label, value, color}]
  const tot = parts.reduce((s, p) => s + p.value, 0) || 1, R = 70, r = 46; let a0 = -Math.PI / 2, g = "";
  parts.forEach((p, k) => { const a1 = a0 + (p.value / tot) * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0, P = (a, rad) => `${(90 + rad * Math.cos(a)).toFixed(2)},${(90 + rad * Math.sin(a)).toFixed(2)}`;
    if (p.value > 0) g += `<path d="M${P(a0, R)}A${R},${R} 0 ${big} 1 ${P(a1 - 1e-4, R)}L${P(a1 - 1e-4, r)}A${r},${r} 0 ${big} 0 ${P(a0, r)}Z" fill="${p.color || SERIES[k % 5]}"><title>${esc(p.label)} ${pctU(p.value / tot)}</title></path>`; a0 = a1; });
  el.innerHTML = `<div class="donut"><svg viewBox="0 0 180 180" role="img" aria-label="${esc(caption)}">${g}<text x="90" y="86" text-anchor="middle" class="dc1">${esc(center?.[0] ?? "")}</text><text x="90" y="106" text-anchor="middle" class="dc2">${esc(center?.[1] ?? "")}</text></svg><ul>${parts.map((p, k) => `<li><i style="background:${p.color || SERIES[k % 5]}"></i>${esc(p.label)}<b>${pctU(p.value / tot)}</b></li>`).join("")}</ul></div><p class="cap">${esc(caption)}</p>`;
}

export function hbars(el, { rows, caption, fmt = pct }) { // rows: [{label, value}]
  const m = Math.max(...rows.map((r) => Math.abs(r.value)), 1e-9);
  el.innerHTML = `<div class="hbars">${rows.map((r) => `<div class="hb"><span>${esc(r.label)}</span><div class="bar"><i class="${r.value < 0 ? "n" : "p"}" style="--w:${((Math.abs(r.value) / m) * 50).toFixed(1)}%"></i></div><b class="${r.value < 0 ? "neg" : "pos"}">${fmt(r.value)}</b></div>`).join("")}</div><p class="cap">${esc(caption)}</p>`;
}
