// 1면 브리핑 — 지금 바로 확인할 것: 환율·지수·관심종목 현재가 + 한국 경제·뉴욕 증시 헤드라인
const KEY = "meridian.v2.watch", DEF = ["AAPL", "NVDA", "SPY", "005930", "000660"];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v.filter((x) => typeof x === "string" && /^[A-Z0-9.\-]{1,12}$/.test(x)).slice(0, 20) : DEF; } catch { return DEF; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };
const ago = (t) => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? "방금" : m < 60 ? `${m}분 전` : m < 1440 ? `${Math.round(m / 60)}시간 전` : `${Math.round(m / 1440)}일 전`; };
const fmt = (v, ccy) => (v == null ? "—" : ccy === "KRW" || ccy == null && v > 1000 ? Math.round(v).toLocaleString("ko-KR") : v.toLocaleString("en-US", { maximumFractionDigits: 2 }));
const chg = (p) => (p?.chg == null ? "" : ` <b class="${p.chg >= 0 ? "pos" : "neg"}">${p.chg >= 0 ? "+" : ""}${(p.chg * 100).toFixed(2)}%</b>`);
const news = (list) => (list.length ? `<ol class="hl">${list.slice(0, 8).map((a) => `<li><a href="${esc(a.link)}" target="_blank" rel="noopener noreferrer">${esc(a.title)}</a><small>${esc(a.src)} · ${ago(a.t)}</small></li>`).join("")}</ol>` : `<p class="muted small">헤드라인을 불러오지 못했습니다.</p>`);

// news: 이미 받아 둔 /api/news 응답(Promise) — 1면이 쟁점 면과 한 번만 받아 나눠 쓴다. 시세 응답은 bw:quotes 이벤트로 알린다
export function brief(el, news0) {
  el.innerHTML = `<div class="bf-col bf-now"><h4>지금 확인 <button class="bf-r" title="새로고침" aria-label="새로고침">↻</button></h4><div id="bfQ"><span class="spin"></span></div>
    <form id="bfAdd" class="bf-add"><label class="sr" for="bfSym">종목 추가</label><input id="bfSym" placeholder="AAPL · 005930" maxlength="12" autocomplete="off"><button class="btn sm">추가</button></form></div>
  <div class="bf-col"><h4>한국 경제 <small>연합 · 매경 · 서경</small></h4><div id="bfKR"><span class="spin"></span></div></div>
  <div class="bf-col"><h4>뉴욕 증시 <small>CNBC · FT</small></h4><div id="bfUS"><span class="spin"></span></div></div>`;
  const q = el.querySelector("#bfQ");
  const quotes = async () => {
    const w = load(); let j;
    try { j = await (await fetch(`/api/quotes?symbols=${encodeURIComponent(w.join(","))}`)).json(); } catch { q.innerHTML = `<p class="muted small">시세 서버 응답 없음(정적 미리보기).</p>`; return; }
    dispatchEvent(new CustomEvent("bw:quotes", { detail: j }));
    const P = Object.fromEntries((j.prices || []).map((p) => [p.symbol, p])), I = Object.fromEntries((j.indicators || []).map((p) => [p.symbol, p]));
    const fx = j.fx?.rates || {};
    q.innerHTML = `<table class="mkt"><tbody>
      <tr><td>원/달러 <small>${esc(j.fx?.date || "")} 기준</small></td><td>${fx.KRW ? fx.KRW.toLocaleString("ko-KR", { maximumFractionDigits: 1 }) : "—"}</td></tr>
      <tr><td>엔/달러</td><td>${fx.JPY ? fx.JPY.toFixed(2) : "—"}</td></tr>
      ${["KOSPI", "KOSDAQ"].map((s) => `<tr><td>${s}</td><td>${I[s] ? fmt(I[s].price, "X") + chg(I[s]) : "—"}</td></tr>`).join("")}
    </tbody></table>
    <table class="mkt wl"><thead><tr><td>관심종목</td><td>현재가 · 등락</td></tr></thead><tbody>${w.map((s) => `<tr><td><button class="x" data-del="${esc(s)}" aria-label="${esc(s)} 삭제">×</button>${P[s]?.name ? `${esc(P[s].name)} <small>${esc(s)}</small>` : esc(s)}</td><td>${P[s] ? `${fmt(P[s].price, P[s].currency)} <small>${esc(P[s].currency || "")}</small>${chg(P[s])}` : "—"}</td></tr>`).join("")}</tbody></table>
    <p class="cap">${j.live ? `${esc(j.source)} 현재가 · ${new Date(j.fetched_at).toLocaleTimeString("ko-KR")} 조회 · 공개 시세라 지연될 수 있음` : "현재가를 불러오지 못했습니다."} · 환율은 ECB 일간 기준환율.${j.errors?.length ? `<br><span class="neg">${esc(j.errors.join(" / "))}</span>` : ""}</p>`;
    q.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => { save(load().filter((x) => x !== b.dataset.del)); quotes(); }));
    if (j.live && !el._timer) el._timer = setInterval(() => document.body.contains(el) ? quotes() : clearInterval(el._timer), 60000);
  };
  const headlines = async (p) => {
    try { const j = await (p || fetch("/api/news").then((r) => r.json())); el.querySelector("#bfKR").innerHTML = news(j.kr || []); el.querySelector("#bfUS").innerHTML = news(j.us || []); }
    catch { el.querySelector("#bfKR").innerHTML = el.querySelector("#bfUS").innerHTML = `<p class="muted small">뉴스 서버 응답 없음(정적 미리보기).</p>`; }
  };
  el.querySelector("#bfAdd").onsubmit = (e) => { e.preventDefault(); const v = el.querySelector("#bfSym").value.trim().toUpperCase(); if (/^[A-Z0-9.\-]{1,12}$/.test(v)) { const w = load(); if (!w.includes(v)) save([...w, v].slice(0, 20)); el.querySelector("#bfSym").value = ""; quotes(); } };
  el.querySelector(".bf-r").onclick = () => { quotes(); headlines(); };
  quotes(); headlines(news0);
}
