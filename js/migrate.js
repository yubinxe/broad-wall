// 이전 버전(클래식) 데이터 → v2 금고. 원본 localStorage 키는 지우지 않는다(되돌릴 수 있게).
const LOG = "meridian.v2.migrations";
const OWN = (k) => k.startsWith("meridian.v2.");
const pick = (o, names) => { for (const n of names) for (const k of Object.keys(o)) if (k.toLowerCase() === n) return o[k]; return undefined; };
function holdingsFrom(v) { // 객체 배열 중 '종목+수량'으로 읽히는 것만 후보로 본다
  const arrs = []; const walk = (x, d = 0) => { if (d > 4 || x == null) return; if (Array.isArray(x)) { if (x.length && typeof x[0] === "object") arrs.push(x); x.forEach((y) => walk(y, d + 1)); } else if (typeof x === "object") Object.values(x).forEach((y) => walk(y, d + 1)); };
  walk(v);
  const out = [];
  for (const a of arrs) for (const o of a) {
    if (!o || typeof o !== "object") continue;
    const code = pick(o, ["code", "ticker", "symbol", "종목코드", "티커"]), name = pick(o, ["name", "종목명", "title"]), qty = Number(pick(o, ["qty", "quantity", "shares", "수량", "amount"]));
    if ((code || name) && Number.isFinite(qty) && qty > 0) {
      const avg = Number(pick(o, ["avg", "avgprice", "cost", "price", "평균단가", "buyprice", "매입가"]));
      out.push({ code: String(code || name).toUpperCase().slice(0, 20), name: String(name || code).slice(0, 60), qty, avg: Number.isFinite(avg) ? avg : null, price: null, ccy: "KRW", cls: "EQ" });
    }
  }
  return out;
}
export function scanLegacy(ls) {
  const items = [];
  for (let i = 0; i < ls.length; i++) {
    const key = ls.key(i); if (!key || OWN(key)) continue;
    const raw = ls.getItem(key) ?? ""; let v = raw, type = "텍스트";
    try { v = JSON.parse(raw); type = Array.isArray(v) ? "배열" : typeof v === "object" ? "객체" : typeof v; } catch {}
    items.push({ key, size: raw.length, type, holdings: typeof v === "object" ? holdingsFrom(v) : [] });
  }
  return items.sort((a, b) => a.key.localeCompare(b.key));
}
export function backupLegacy(ls) {
  const dump = {}; for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k && !OWN(k)) dump[k] = ls.getItem(k); }
  log("backup", Object.keys(dump).length + "개 키");
  return JSON.stringify({ exported_at: new Date().toISOString(), origin: typeof location !== "undefined" ? location.origin : "", data: dump }, null, 2);
}
export async function importLegacyHoldings(items, vault) {
  const d = vault.data(), have = new Set((d.holdings || []).filter((h) => h.src === "legacy").map((h) => h.code + "|" + h.qty));
  const add = items.flatMap((i) => i.holdings.map((h) => ({ ...h, id: crypto.randomUUID(), src: "legacy", legacyKey: i.key }))).filter((h) => !have.has(h.code + "|" + h.qty));
  await vault.save({ ...d, holdings: [...(d.holdings || []), ...add] });
  log("import", add.length + "개 종목(중복 제외)");
  return add.length;
}
export function migrationLog() { try { return JSON.parse(localStorage.getItem(LOG)) || []; } catch { return []; } }
function log(step, detail) { try { const l = migrationLog(); l.push({ at: new Date().toISOString(), step, detail }); localStorage.setItem(LOG, JSON.stringify(l.slice(-50))); } catch {} }
