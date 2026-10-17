// 비공개 금고 — 보유 종목·원금·브로커 토큰은 이 브라우저 안에서만 AES-GCM 으로 암호화해 저장한다.
// 서버로 보내지 않는다. 키는 암호구(PBKDF2-SHA256 310,000회)에서 만들고 메모리에만 둔다.
const KEY = "meridian.v2.vault";
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (u8) => btoa(String.fromCharCode(...new Uint8Array(u8)));
const ub64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
let session = null, idleTimer = null;
export const ITER = 310000, IDLE_MS = 15 * 60 * 1000;

async function derive(pass, salt, iter = ITER) {
  const base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
export async function seal(obj, pass, iter = ITER) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), k = await derive(pass, salt, iter);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, enc.encode(JSON.stringify(obj)));
  return { v: 1, iter, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}
export async function open(box, pass) {
  const k = await derive(pass, ub64(box.salt), box.iter);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ub64(box.iv) }, k, ub64(box.ct)); // 암호구가 틀리면 예외
  return JSON.parse(dec.decode(pt));
}
const store = { get: () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }, set: (v) => localStorage.setItem(KEY, JSON.stringify(v)) };
export const exists = () => !!store.get();
export const isOpen = () => !!session;
export async function create(pass, data = { holdings: [], fx: 1300, notes: "" }) {
  if (pass.length < 8) throw new Error("암호구는 8자 이상");
  store.set(await seal(data, pass)); session = { pass, data }; touch(); return data;
}
export async function unlock(pass) { const box = store.get(); if (!box) throw new Error("금고 없음"); const data = await open(box, pass); session = { pass, data }; touch(); return data; }
export async function save(data) { if (!session) throw new Error("잠김"); session.data = data; store.set(await seal(data, session.pass)); touch(); }
export const data = () => session?.data;
export function lock() { session = null; clearTimeout(idleTimer); dispatchEvent(new Event("vault:lock")); }
export function touch() { clearTimeout(idleTimer); idleTimer = setTimeout(lock, IDLE_MS); }
export function destroy() { localStorage.removeItem(KEY); lock(); }
