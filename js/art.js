// 맨해튼 해질녘 스카이라인 — 사진 대신 직접 그린 SVG(저작권 문제 없음). 시드 고정이라 매번 같은 도시.
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

export function skyline({ w = 1600, h = 520, seed = 1929 } = {}) {
  const r = rng(seed), base = h - 70; let back = "", mid = "", front = "", lights = "";
  const tower = (x, bw, bh, layer, crown) => {
    const y = base - bh, fill = layer === 0 ? "#2A3550" : layer === 1 ? "#1A2236" : "#0D1320";
    let s = `<rect x="${x}" y="${y}" width="${bw}" height="${bh + 70}" fill="${fill}"/>`;
    if (crown === "step") { s += `<rect x="${x + bw * 0.15}" y="${y - bh * 0.08}" width="${bw * 0.7}" height="${bh * 0.08}" fill="${fill}"/><rect x="${x + bw * 0.32}" y="${y - bh * 0.15}" width="${bw * 0.36}" height="${bh * 0.07}" fill="${fill}"/><rect x="${x + bw * 0.47}" y="${y - bh * 0.27}" width="${bw * 0.06}" height="${bh * 0.12}" fill="${fill}"/>`; }
    if (crown === "arc") { for (let k = 0; k < 4; k++) s += `<path d="M${x + bw * (0.1 + k * 0.1)},${y - k * 14} Q${x + bw / 2},${y - 70 - k * 12} ${x + bw * (0.9 - k * 0.1)},${y - k * 14}" fill="none" stroke="#C6A365" stroke-opacity="${0.5 - k * 0.08}" stroke-width="1.4"/>`; s += `<path d="M${x + bw / 2 - 2},${y - 70} L${x + bw / 2},${y - 120} L${x + bw / 2 + 2},${y - 70}Z" fill="${fill}"/>`; }
    if (crown === "taper") { s = `<path d="M${x},${base + 70} L${x},${y + 40} L${x + bw / 2},${y - 10} L${x + bw},${y + 40} L${x + bw},${base + 70}Z" fill="${fill}"/><rect x="${x + bw / 2 - 1}" y="${y - 90}" width="2" height="80" fill="${fill}"/>`; }
    if (layer > 0) for (let yy = y + 10; yy < base - 6; yy += 9) for (let xx = x + 5; xx < x + bw - 5; xx += 7) if (r() < (layer === 2 ? 0.17 : 0.09)) lights += `<rect x="${xx}" y="${yy}" width="3" height="4" fill="${r() < 0.8 ? "#F3C77A" : "#FFE7B5"}" opacity="${(0.45 + r() * 0.5).toFixed(2)}"/>`;
    return s;
  };
  for (let x = -20; x < w; x += 20 + r() * 40) back += tower(x, 26 + r() * 40, 90 + r() * 170, 0);
  for (let x = -10; x < w; x += 28 + r() * 46) { const hh = 70 + r() * 220; mid += tower(x, 30 + r() * 46, hh, 1); }
  const L = [[w * 0.18, 78, 330, "taper"], [w * 0.47, 64, 300, "step"], [w * 0.6, 54, 270, "arc"], [w * 0.74, 70, 210], [w * 0.31, 58, 190], [w * 0.86, 50, 240], [w * 0.05, 64, 170], [w * 0.95, 60, 150]];
  for (const [x, bw, bh, c] of L) front += tower(x, bw, bh, 2, c);
  for (let x = 0; x < w; x += 34 + r() * 40) front += tower(x, 22 + r() * 30, 30 + r() * 90, 2);
  const bridge = `<g stroke="#C6A365" stroke-opacity=".55" fill="none" stroke-width="1"><path d="M-40,${base - 20} Q${w * 0.06},${base + 40} ${w * 0.12},${base - 120} Q${w * 0.2},${base + 30} ${w * 0.3},${base - 10}"/>${Array.from({ length: 22 }, (_, k) => { const x = -40 + k * (w * 0.34) / 22; return `<line x1="${x}" x2="${x}" y1="${base - 12}" y2="${base - 20 - 80 * Math.sin((k / 22) * Math.PI)}"/>`; }).join("")}</g><rect x="${w * 0.12 - 5}" y="${base - 140}" width="10" height="140" fill="#0D1320"/>`;
  const water = `<rect x="0" y="${base}" width="${w}" height="70" fill="url(#water)"/>${Array.from({ length: 40 }, () => { const x = r() * w, y = base + 8 + r() * 56; return `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${(10 + r() * 50).toFixed(0)}" height="1.2" fill="#F3C77A" opacity="${(0.1 + r() * 0.35).toFixed(2)}"/>`; }).join("")}`;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs><linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A2B33"/><stop offset="1" stop-color="#0A0E15"/></linearGradient><radialGradient id="sun" cx=".63" cy=".86" r=".25"><stop offset="0" stop-color="#FFD9A0" stop-opacity=".9"/><stop offset="1" stop-color="#FFD9A0" stop-opacity="0"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#sun)"/><g>${back}</g><g>${mid}</g>${bridge}<g>${front}</g><g>${lights}</g>${water}</svg>`;
}

// 황동 인장 — 이중 원, 눈금, 이탤릭 앰퍼샌드(금고 다이얼)
export const SEAL = `<svg class="seal" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="32" cy="32" r="25" fill="none" stroke="currentColor" stroke-width=".7"/>${Array.from({ length: 48 }, (_, i) => { const a = (i / 48) * Math.PI * 2; return `<line x1="${32 + 25 * Math.cos(a)}" y1="${32 + 25 * Math.sin(a)}" x2="${32 + (i % 4 ? 27 : 29) * Math.cos(a)}" y2="${32 + (i % 4 ? 27 : 29) * Math.sin(a)}" stroke="currentColor" stroke-width=".6"/>`; }).join("")}<text x="32" y="43" text-anchor="middle" font-family="Cormorant Garamond, serif" font-size="30" font-style="italic" font-weight="500" fill="currentColor">&amp;</text></svg>`;

// 길로셰(지폐 무늬) — 증서 배경용
export function guilloche(w = 600, h = 120) {
  let p = ""; for (let k = 0; k < 9; k++) { let d = ""; for (let x = 0; x <= w; x += 4) { const y = h / 2 + Math.sin(x / 26 + k * 0.7) * (h / 3) * Math.cos(x / 140 + k); d += (x ? "L" : "M") + x + "," + y.toFixed(1); } p += `<path d="${d}" fill="none" stroke="currentColor" stroke-width=".5" opacity=".5"/>`; }
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true" style="width:100%;height:${h}px;color:var(--brass)">${p}</svg>`;
}

// BROAD & WALL 로고 마크 — 거래소 정면(박공·엔타블러처·기둥 6·기단)을 이중 괘선 액자에. favicon.svg 와 같은 도형.
export const MARK = `<svg class="seal" viewBox="0 0 64 64" aria-hidden="true"><rect x="1.5" y="1.5" width="61" height="61" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="5" y="5" width="54" height="54" fill="none" stroke="currentColor" stroke-width=".6"/><g fill="currentColor"><path d="M12 24 32 12.5 52 24Z"/><rect x="12" y="25.5" width="40" height="3.6"/>${[14, 20.8, 27.6, 34.4, 41.2, 48].map((x) => `<rect x="${x}" y="31" width="2.8" height="16.5"/>`).join("")}<rect x="11" y="48.5" width="42" height="2.6"/><rect x="9" y="52" width="46" height="2.6"/></g></svg>`;
