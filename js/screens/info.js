// 공개 포트폴리오 · 데이터 · 마이그레이션 — 공개 화면은 금고를 읽지 않는다
import * as Q from "../quant.js";
import * as C from "../charts.js";
import { $, $$, esc, settings, saveSettings, market, D, cache, run, bench, profileResult, currentWeights, norm, costForm, bindCost, refresh } from "../core.js";
import * as V from "../vault.js";
import { guilloche } from "../art.js";
import { scanLegacy, backupLegacy, importLegacyHoldings, migrationLog } from "../migrate.js";

// ── 공개 포트폴리오 (금고를 읽지 않는다) ──
export function publicView(el) {
  const key = "trend", st = Q.STRATEGIES[key], w = norm(currentWeights(key)), te = Q.splitMetrics(run(key).bt, bench())[2].m;
  el.innerHTML = `<div class="wrap page"><div class="cert"><p class="kicker" style="justify-content:center">Certificate of Allocation · No. ${D.end.replace("-", "")}</p><h1>BROAD &amp; WALL MODEL PORTFOLIO</h1><p class="sub">${st.name} · ${D.end} 월말 신호</p>${guilloche(900, 70)}
  <div class="grid g3" style="margin:22px 0;text-align:center">${["EQ", "BD", "GD"].map((a) => `<div><p class="kicker" style="justify-content:center">${Q.ASSET_LABEL[a]}</p><div style="font:500 clamp(34px,5vw,54px)/1 var(--serif);color:var(--navy)">${C.pctU(w[a], 0)}</div></div>`).join("")}</div>
  <table class="ledger"><tbody><tr><td>테스트 구간</td><td class="num">${Q.SPLITS[2].from} – ${D.end}</td></tr><tr><td>CAGR · 비용·세금 반영</td><td class="num">${C.pctU(te.cagr)}</td></tr><tr><td>최대낙폭</td><td class="num neg">${C.pct(te.mdd)}</td></tr><tr><td>Sharpe (rf 0%)</td><td class="num">${C.num(te.sharpe)}</td></tr></tbody></table>
  <p class="small muted" style="margin-top:16px;text-align:center">이 증서는 규칙 기반 <b>모델 포트폴리오</b>이며 운영자의 실제 계좌·자산이 아닙니다. 금액·계좌번호·원금은 공개 화면에 표시하지 않습니다. 투자 권유가 아닙니다.</p></div>
  <div class="note" style="margin-top:22px"><b>공개 범위 정책</b> — 공개 화면은 비중(%)과 규칙만 보여 줍니다. 실제 보유 자산의 공개는 운영자가 확인하기 전까지 열지 않습니다(설정 없음 · 코드상 금고 접근 없음).</div></div>`;
}
publicView.title = "공개 포트폴리오";

// ── 데이터 ──
export function dataView(el) {
  const q = market.quality;
  el.innerHTML = `<div class="wrap page"><p class="kicker">Data Desk</p><h1>데이터 출처와 품질</h1><p class="lede">${D.dates[0]}–${D.end} · ${D.dates.length}개월 · 빌드 ${market.built_at.slice(0, 10)}. 원본 파일의 SHA-256 을 기록해 같은 입력이면 같은 결과가 나옵니다.</p>
  <div class="note warn" style="margin-top:16px"><b>시세 성격</b> — 실시간·장중 시세가 아닙니다. 월간 공개 데이터이며 마지막 데이터 월은 <b>${D.end}</b> 입니다.</div>
  <h2 class="sec"><span class="rn">i</span>출처</h2><div class="scroll"><table class="ledger cards"><thead><tr><th>데이터</th><th>원천</th><th>라이선스</th><th>행</th><th>SHA-256</th></tr></thead><tbody>${Object.values(market.sources).map((s) => `<tr><td data-l="데이터"><b>${esc(s.name)}</b></td><td data-l="원천"><a href="${esc(s.origin)}" target="_blank" rel="noopener">원 출처</a> · <a href="${esc(s.url)}" target="_blank" rel="noopener">파일</a></td><td data-l="라이선스">${esc(s.license)}</td><td data-l="행" class="num">${s.rows}</td><td data-l="SHA-256" class="mono small">${s.sha256.slice(0, 16)}…</td></tr>`).join("")}</tbody></table></div>
  <h2 class="sec"><span class="rn">ii</span>품질 검증</h2><div class="scroll"><table class="ledger"><tbody>${q.checks.map((c) => `<tr><td style="width:40px">${c.ok ? '<span class="pos">✓</span>' : '<span class="neg">!</span>'}</td><td>${esc(c.msg)}</td></tr>`).join("")}</tbody></table></div>
  <h2 class="sec"><span class="rn">iii</span>방법론 메모</h2><ul>${market.notes.map((n) => `<li>${esc(n)}</li>`).join("")}<li>CPI 는 발표 지연을 반영해 t 월말 판단에 t−1 월 값까지만 사용합니다(엔진에서 강제).</li><li>보간된 배당 월: ${Object.keys(q.imputed).length}개월 (${Object.keys(q.imputed)[0] ?? "—"} 이후).</li></ul></div>`;
}
dataView.title = "데이터";

// ── 마이그레이션 ──
export function migrate(el) {
  const items = scanLegacy(localStorage), log = migrationLog();
  el.innerHTML = `<div class="wrap page"><p class="kicker">Migration</p><h1>이전 버전 데이터 옮기기</h1><p class="lede">이전 버전 MERIDIAN(클래식)이 이 브라우저에 남긴 데이터를 지우지 않고 단계별로 옮깁니다. 클래식 화면은 <a href="/classic/">/classic/</a> 에 그대로 보존돼 있습니다.</p>
  <ol class="grid" style="padding-left:20px;margin-top:20px"><li><b>스캔</b> — 새 버전 키(meridian.v2.*)를 제외한 저장 항목 ${items.length}개 발견</li><li><b>백업</b> — 원본 그대로 JSON 파일로 내려받기 (먼저 실행 권장)</li><li><b>미리보기</b> — 보유 종목으로 해석 가능한 항목만 표시</li><li><b>가져오기</b> — 금고에 '이전 버전' 출처로 추가. 원본 키는 삭제하지 않음</li></ol>
  <div class="scroll" style="margin-top:14px"><table class="ledger cards"><thead><tr><th>키</th><th>크기</th><th>형태</th><th>보유 종목 후보</th></tr></thead><tbody>${items.map((i) => `<tr><td data-l="키" class="mono">${esc(i.key)}</td><td data-l="크기" class="num">${i.size.toLocaleString()}B</td><td data-l="형태">${esc(i.type)}</td><td data-l="후보" class="num">${i.holdings.length}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">이 브라우저에 이전 버전 데이터가 없습니다.</td></tr>`}</tbody></table></div>
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px"><button class="btn ghost" id="bk" ${items.length ? "" : "disabled"}>① 백업 내려받기</button><button class="btn" id="im" ${items.some((i) => i.holdings.length) ? "" : "disabled"}>② 금고로 가져오기</button></div><p id="mm" class="small" style="margin-top:10px"></p>
  ${log.length ? `<h2 class="sec"><span class="rn">i</span>기록</h2><ul class="mono small">${log.map((l) => `<li>${esc(l.at)} · ${esc(l.step)} · ${esc(l.detail)}</li>`).join("")}</ul>` : ""}</div>`;
  $("#bk").onclick = () => { const u = URL.createObjectURL(new Blob([backupLegacy(localStorage)], { type: "application/json" })); Object.assign(document.createElement("a"), { href: u, download: `meridian-classic-backup-${new Date().toISOString().slice(0, 10)}.json` }).click(); $("#mm").textContent = "백업 파일을 내려받았습니다."; };
  $("#im").onclick = async () => { if (!V.isOpen()) { $("#mm").innerHTML = '먼저 <a href="#/portfolio">금고를 열어</a> 주세요.'; return; } const n = await importLegacyHoldings(items, V); $("#mm").textContent = `${n}개 종목을 '이전 버전' 출처로 추가했습니다. 원본은 그대로 남아 있습니다.`; };
}
migrate.title = "마이그레이션";

// 가로 스크롤 표는 키보드로도 스크롤할 수 있게
