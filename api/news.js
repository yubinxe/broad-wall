// 시장 뉴스 — 언론사 공식 RSS 의 제목·링크·시각만 모은다(본문 복제 없음, 저작권은 각 언론사).
// 3일보다 오래된 기사와 응답 없는 피드는 제외하고, 실패한 출처는 그대로 알린다.
export const FEEDS = {
  kr: [
    { src: "연합뉴스", url: "https://www.yna.co.kr/rss/market.xml" },
    { src: "연합뉴스", url: "https://www.yna.co.kr/rss/economy.xml" },
    { src: "매일경제", url: "https://www.mk.co.kr/rss/50200011/" },
    { src: "서울경제", url: "https://www.sedaily.com/rss/economy" },
  ],
  us: [
    { src: "CNBC", url: "https://www.cnbc.com/id/20910258/device/rss/rss.html" },
    { src: "Financial Times", url: "https://www.ft.com/markets?format=rss" },
    { src: "CNBC", url: "https://www.cnbc.com/id/10000664/device/rss/rss.html" },
  ],
};
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const clean = (s = "") => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => (e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m)).replace(/\s+/g, " ").trim();
const tag = (x, t) => clean((x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, "i")) || [])[1]);
export function parseRSS(xml, src) {
  return (xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || []).map((x) => {
    const link = tag(x, "link") || (x.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || "", t = Date.parse(tag(x, "pubDate") || tag(x, "dc:date"));
    return { src, title: tag(x, "title"), link, t: isFinite(t) ? t : null };
  }).filter((a) => a.title && /^https?:\/\//.test(a.link));
}
export async function collect(fetchFn = fetch, now = Date.now(), maxAge = 3 * 864e5) {
  const out = { kr: [], us: [], failed: [] };
  await Promise.all(Object.entries(FEEDS).flatMap(([k, list]) => list.map(async (f) => {
    try {
      const r = await fetchFn(f.url, { headers: { "user-agent": "Mozilla/5.0 (compatible; BroadWallReader/1.0)" }, signal: AbortSignal.timeout(6000) });
      if (!r.ok) throw new Error(r.status);
      out[k].push(...parseRSS(await r.text(), f.src).filter((a) => a.t && now - a.t < maxAge && a.t - now < 36e5));
    } catch (e) { out.failed.push(`${f.src}(${e.message || e})`); }
  })));
  for (const k of ["kr", "us"]) { const seen = new Set(); out[k] = out[k].sort((a, b) => b.t - a.t).filter((a) => !seen.has(a.title) && seen.add(a.title)).slice(0, 12); }
  return out;
}
export default async function handler(req, res) {
  const d = await collect();
  res.setHeader("cache-control", "public, s-maxage=900, stale-while-revalidate=1800");
  res.status(200).json({ fetched_at: new Date().toISOString(), note: "언론사 공식 RSS — 제목·링크만 표시", ...d });
}
