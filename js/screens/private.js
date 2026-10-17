// VI 비공개 대시보드 — 금고가 열려 있을 때만 그린다
import * as Q from "../quant.js";
import * as C from "../charts.js";
import { $, $$, esc, settings, saveSettings, market, D, cache, run, bench, profileResult, currentWeights, norm, costForm, bindCost, refresh } from "../core.js";
import * as P from "../portfolio.js";
import * as V from "../vault.js";
import { SEAL } from "../art.js";

// ── VI 내 포트폴리오 (비공개) ──
export function portfolio(el) {
  if (!V.isOpen()) return vaultGate(el);
  V.touch();
  const vd = V.data(), demo = sessionStorage.getItem("meridian.v2.demo") === "1", holds = demo ? P.DEMO : vd.holdings || [];
  const a = P.analyze(holds, vd.fx || 1300), s = profileResult(), cw = P.classWeights(a.byClass);
  el.innerHTML = `<div class="wrap page"><p class="kicker">VI · Private Ledger <span class="chip ${demo ? "demo" : "real"}" style="margin-left:6px">${demo ? "DEMO · 가상 데이터" : "내 데이터 · 이 기기에서만"}</span></p>
  <div style="display:flex;gap:12px;align-items:end;flex-wrap:wrap"><h1 style="margin-right:auto">나의 비공개 대시보드</h1>
    <label class="btn sm ghost"><input type="checkbox" id="mask" ${settings.mask ? "checked" : ""} style="margin:0"> 금액 가리기</label>
    <button class="btn sm ghost" id="demoBtn">${demo ? "데모 끄기" : "데모 보기"}</button><button class="btn sm" id="lockBtn">⚿ 잠그기</button></div>
  ${demo ? `<p class="note warn"><b>데모 모드</b> — 아래 수치는 가상의 예시이며 실제 자산이 아닙니다. 데모는 금고에 저장되지 않습니다.</p>` : ""}
  ${a.missingPrice ? `<p class="note warn">${a.missingPrice}개 종목에 현재가가 없어 평균단가로 평가했습니다. 자동 시세 연동이 없으므로 현재가를 직접 입력하세요.</p>` : ""}
  <div class="term" style="margin-top:18px"><div class="th"><span>PORTFOLIO · 입력 기준가</span><span>USD→KRW ${vd.fx || 1300} (사용자 입력)</span></div><div class="tb"><div class="kpis">
    <div class="kpi"><small>평가액</small><b class="sens">${C.krwS(a.total)}</b></div><div class="kpi"><small>원금</small><b class="sens">${C.krwS(a.totalCost)}</b></div><div class="kpi"><small>평가손익</small><b class="sens ${a.pnl >= 0 ? "up" : "dn"}">${C.krwS(a.pnl)}</b></div><div class="kpi"><small>수익률</small><b class="${a.ret >= 0 ? "up" : "dn"}">${C.pct(a.ret)}</b></div><div class="kpi"><small>실효 종목 수</small><b>${C.num(a.effectiveN, 1)}</b><span>1/Σw²</span></div><div class="kpi"><small>주식 비중</small><b>${C.pctU(cw.EQ, 0)}</b><span>${s.complete ? `${s.type.name} 권장 ${C.pctU(s.type.eq[0], 0)}–${C.pctU(s.type.eq[1], 0)}` : "성향 미진단"}</span></div>
  </div></div></div>
  ${s.complete && (cw.EQ < s.type.eq[0] || cw.EQ > s.type.eq[1]) ? `<p class="note warn" style="margin-top:12px">주식(기타 포함) 비중 ${C.pctU(cw.EQ, 0)}이 ${s.type.name} 권장 범위를 벗어났습니다.</p>` : ""}
  <div class="grid g2" style="margin-top:16px;align-items:start"><div><h2 class="sec"><span class="rn">i</span>자산군 비중</h2><div class="chart" id="pd"></div></div><div><h2 class="sec"><span class="rn">ii</span>종목별 손익 기여</h2><div class="chart" id="pc"></div></div></div>
  <h2 class="sec"><span class="rn">iii</span>보유 종목 <small>${holds.length}개</small></h2>
  <div class="scroll"><table class="ledger cards"><thead><tr><th>종목</th><th>자산군</th><th>수량</th><th>평균단가</th><th>현재가</th><th>평가액</th><th>손익</th><th>수익률</th><th>비중</th>${demo ? "" : "<th></th>"}</tr></thead><tbody>
  ${a.rows.map((r) => `<tr><td data-l="종목"><b>${esc(r.name)}</b> <span class="mono muted small">${esc(r.code)} · ${r.ccy}</span></td><td data-l="자산군">${P.CLASSES[r.cls]}</td><td data-l="수량" class="num">${r.qty.toLocaleString()}</td><td data-l="평균단가" class="num sens">${r.avg == null ? "—" : r.avg.toLocaleString()}</td><td data-l="현재가" class="num">${r.stalePrice ? '<span class="muted">미입력</span>' : r.price.toLocaleString()}</td><td data-l="평가액" class="num sens">${C.krw(r.value)}</td><td data-l="손익" class="num sens ${r.pnl >= 0 ? "pos" : "neg"}">${r.pnl == null ? "—" : C.krw(r.pnl)}</td><td data-l="수익률" class="num ${r.ret >= 0 ? "pos" : "neg"}">${C.pct(r.ret)}</td><td data-l="비중" class="num">${C.pctU(r.weight)}</td>${demo ? "" : `<td><button class="btn sm ghost" data-del="${r.id}" aria-label="${esc(r.name)} 삭제">삭제</button></td>`}</tr>`).join("") || `<tr><td colspan="10" class="muted">아직 종목이 없습니다. 아래에서 CSV를 가져오거나 직접 입력하세요.</td></tr>`}</tbody></table></div>
  ${demo ? "" : `<h2 class="sec"><span class="rn">iv</span>입력 · 가져오기 · 내보내기</h2>
  <div class="grid g2" style="align-items:start"><form id="add" class="card"><h3>직접 입력</h3><div class="formrow" style="margin-top:10px">
    <label class="field">종목코드<input name="code" required maxlength="20"></label><label class="field">종목명<input name="name" maxlength="60"></label><label class="field">수량<input name="qty" type="number" step="any" min="0" required></label><label class="field">평균단가<input name="avg" type="number" step="any" min="0"></label><label class="field">현재가<input name="price" type="number" step="any" min="0"></label>
    <label class="field">통화<select name="ccy"><option>KRW</option><option>USD</option></select></label><label class="field">자산군<select name="cls">${Object.entries(P.CLASSES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label></div><button class="btn" style="margin-top:12px">추가</button></form>
  <div class="card"><h3>CSV 가져오기</h3><p class="small muted">열: 종목코드, 종목명, 수량, 평균단가, 현재가, 통화(KRW/USD), 자산군(주식/채권/금/현금/기타). 파일은 서버로 올라가지 않고 이 브라우저에서만 읽습니다.</p>
    <input type="file" id="csv" accept=".csv,text/csv"><div id="csvMsg" class="small" style="margin-top:8px"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn sm ghost" id="exp">CSV 내보내기</button><button class="btn sm ghost" id="tpl">예시 CSV</button><label class="field" style="max-width:150px">USD→KRW<input id="fx" type="number" step="0.1" value="${vd.fx || 1300}"></label></div>
    <hr class="double"><h3>증권사에서 불러오기</h3><div id="brk" class="small muted"><span class="spin"></span> 연동 상태 확인 중…</div></div></div>
  <details class="fold" style="margin-top:16px"><summary>금고 관리</summary><p class="small">금고는 이 브라우저 localStorage 에 AES-256-GCM 암호문으로만 저장됩니다(PBKDF2 ${V.ITER.toLocaleString()}회). 암호구를 잃으면 복구할 수 없습니다. 15분 동안 조작이 없으면 자동으로 잠깁니다.</p><button class="btn danger sm" id="wipe">금고 삭제</button></details>`}
  </div>`;
  document.body.classList.toggle("mask-on", !!settings.mask);
  C.donut($("#pd"), { parts: Object.entries(a.byClass).map(([k, v], i) => ({ label: P.CLASSES[k], value: v, color: ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)"][i % 5] })), center: [C.pctU(a.ret), "RETURN"], caption: "평가액 기준 · 입력 기준가" });
  C.hbars($("#pc"), { rows: a.rows.slice(0, 10).map((r) => ({ label: r.name.replace("[DEMO] ", ""), value: r.contrib })), caption: "종목 손익 ÷ 총 원금 · 상위 10개" });
  $("#mask").onchange = (e) => { settings.mask = e.target.checked; saveSettings(); document.body.classList.toggle("mask-on", settings.mask); };
  $("#demoBtn").onclick = () => { sessionStorage.setItem("meridian.v2.demo", demo ? "0" : "1"); portfolio(el); };
  $("#lockBtn").onclick = () => { V.lock(); location.hash = "#/portfolio"; refresh(); };
  if (demo) return;
  const persist = async (holdings) => { await V.save({ ...vd, holdings }); portfolio(el); };
  $$("[data-del]", el).forEach((b) => (b.onclick = () => persist(vd.holdings.filter((h) => h.id !== b.dataset.del))));
  $("#add").onsubmit = (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const num = (v) => (v === "" ? null : Number(v)); persist([...(vd.holdings || []), { id: crypto.randomUUID(), code: f.code.toUpperCase(), name: f.name || f.code, qty: Number(f.qty), avg: num(f.avg), price: num(f.price), ccy: f.ccy, cls: f.cls, src: "manual" }]); };
  $("#csv").onchange = async (e) => { const file = e.target.files[0]; if (!file) return; if (file.size > 2e6) { $("#csvMsg").textContent = "2MB 이하 파일만 읽습니다"; return; } const r = P.importHoldings(await file.text()); $("#csvMsg").innerHTML = `${r.holdings.length}행 가져옴${r.errors.length ? ` · <span class="neg">${r.errors.length}행 제외: ${r.errors.slice(0, 3).map((x) => `${x.row}행 ${esc(x.msg)}`).join("; ")}</span>` : ""}`; if (r.holdings.length && confirm(`${r.holdings.length}개 종목을 추가할까요? (기존 ${vd.holdings.length}개 유지)`)) persist([...(vd.holdings || []), ...r.holdings.map((h) => ({ ...h, src: "csv" }))]); };
  const dl = (name, text) => { const u = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv" })); Object.assign(document.createElement("a"), { href: u, download: name }).click(); setTimeout(() => URL.revokeObjectURL(u), 1000); };
  $("#exp").onclick = () => dl("meridian-holdings.csv", P.exportCSV(vd.holdings || []));
  $("#tpl").onclick = () => dl("meridian-template.csv", "종목코드,종목명,수량,평균단가,현재가,통화,자산군\nSPY,S&P 500 ETF,10,500,640,USD,주식\n148070,국고채 10년 ETF,50,110000,112000,KRW,채권");
  $("#fx").onchange = async (e) => { await V.save({ ...vd, fx: Number(e.target.value) || 1300 }); portfolio(el); };
  $("#wipe").onclick = () => { if (confirm("금고를 삭제하면 보유 종목 데이터가 지워집니다. 계속할까요?")) { V.destroy(); refresh(); } };
  brokerPanel($("#brk"), vd, persist);
}
portfolio.title = "내 포트폴리오";
function vaultGate(el) {
  const has = V.exists();
  el.innerHTML = `<div class="wrap page"><div class="vault card corner"><div class="dial">${SEAL}</div><p class="kicker" style="justify-content:center">VI · Private Ledger</p><h1 style="font-size:30px">${has ? "금고 열기" : "비공개 금고 만들기"}</h1>
  <p class="muted">${has ? "이 기기에 저장된 암호화 금고를 엽니다." : "보유 종목·원금은 이 브라우저 안에서만 AES-256 으로 암호화됩니다. 서버에는 아무것도 저장되지 않습니다."}</p>
  <form id="vf" style="margin-top:18px;display:grid;gap:10px"><label class="field" style="text-align:left">암호구 (8자 이상)<input type="password" name="p" minlength="8" required autocomplete="${has ? "current-password" : "new-password"}"></label>${has ? "" : `<label class="field" style="text-align:left">암호구 확인<input type="password" name="p2" minlength="8" required autocomplete="new-password"></label>`}<button class="btn" style="justify-content:center">${has ? "열기" : "금고 만들기"}</button><p id="vm" class="small neg" role="alert"></p></form>
  <hr class="double"><button class="btn ghost sm" id="demoOnly">로그인 없이 데모 둘러보기</button><p class="small muted" style="margin-top:10px">데모는 가상 데이터이며 실제 자산과 섞이지 않습니다. 이전 버전 데이터가 있다면 <a href="#/migrate">마이그레이션</a>.</p></div></div>`;
  $("#vf").onsubmit = async (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); $("#vm").textContent = ""; try { if (has) await V.unlock(f.p); else { if (f.p !== f.p2) throw new Error("암호구가 일치하지 않습니다"); await V.create(f.p); } refresh(); } catch (err) { $("#vm").textContent = has ? "암호구가 맞지 않습니다" : err.message; } };
  $("#demoOnly").onclick = async () => { sessionStorage.setItem("meridian.v2.demo", "1"); if (!has) { el.innerHTML = ""; } demoView(el); };
}
function demoView(el) { // 금고 없이도 데모만 볼 수 있는 읽기 전용 화면
  const a = P.analyze(P.DEMO, 1300);
  el.innerHTML = `<div class="wrap page"><p class="kicker">VI · Demo <span class="chip demo">DEMO · 가상 데이터</span></p><h1>데모 포트폴리오</h1><p class="note warn"><b>실제 자산이 아닙니다.</b> 화면 구성을 보여 주기 위한 가상 수치입니다.</p>
  <div class="grid g2" style="margin-top:16px"><div class="chart" id="dd"></div><div class="chart" id="dc"></div></div><p style="margin-top:16px"><a class="btn" href="#/portfolio">내 금고로 돌아가기</a></p></div>`;
  C.donut($("#dd"), { parts: Object.entries(a.byClass).map(([k, v]) => ({ label: P.CLASSES[k], value: v })), center: [C.pctU(a.ret), "DEMO"], caption: "데모 · 가상 데이터" });
  C.hbars($("#dc"), { rows: a.rows.map((r) => ({ label: r.name.replace("[DEMO] ", ""), value: r.contrib })), caption: "데모 · 종목 손익 기여" });
}
async function brokerPanel(box, vd, persist) {
  let st; try { const r = await fetch("/api/broker/status", { cache: "no-store" }); st = r.ok ? await r.json() : null; } catch { st = null; }
  if (!st) { box.innerHTML = `<span class="chip off">서버 함수 응답 없음</span> 정적 환경에서는 증권사 연동을 쓸 수 없습니다. <a href="#/connect">자세히</a>`; return; }
  const rows = Object.entries(st.brokers).map(([k, b]) => `<div style="display:flex;gap:8px;align-items:center;margin:6px 0"><span class="chip ${b.configured ? "real" : "off"}">${b.configured ? "설정됨" : "미설정"}</span><b>${esc(b.name)}</b>${b.configured && st.auth ? `<button class="btn sm ghost" data-b="${k}" style="margin-left:auto">불러오기</button>` : ""}</div>`).join("");
  box.innerHTML = rows + (st.auth ? `<label class="field" style="margin-top:8px">관리자 토큰 (금고에만 저장)<input type="password" id="adm" value="${esc(vd.adminToken || "")}" autocomplete="off"></label>` : `<p class="small muted">서버에 관리자 토큰(MERIDIAN_ADMIN_TOKEN)이 설정되지 않아 불러오기가 꺼져 있습니다.</p>`) + `<p id="bm" class="small"></p>`;
  $$("[data-b]", box).forEach((b) => (b.onclick = async () => {
    const tok = $("#adm", box).value; $("#bm", box).innerHTML = '<span class="spin"></span> 조회 중…';
    try { const r = await fetch(`/api/broker/holdings?broker=${b.dataset.b}`, { headers: { authorization: "Bearer " + tok }, cache: "no-store" }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status);
      vd.adminToken = tok; // 토큰은 암호화된 금고 안에만 남는다
      if (confirm(`${j.holdings.length}개 종목을 불러왔습니다. 기존 '${b.dataset.b}' 연동 종목을 교체할까요?`)) await persist([...(vd.holdings || []).filter((h) => h.src !== b.dataset.b), ...j.holdings.map((h) => ({ ...h, id: crypto.randomUUID(), src: b.dataset.b }))]);
    } catch (err) { $("#bm", box).innerHTML = `<span class="neg">실패: ${esc(err.message)}</span>`; }
  }));
}
