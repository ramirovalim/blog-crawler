// @ts-nocheck
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

import fetch from "node-fetch";

const STORAGE_DIR = path.join(process.cwd(), "storage", "datasets", "default");
const OUT_INDEX = path.join(process.cwd(), "storage", "indexed_posts.json");

const STOPWORDS = new Set([
  "the",
  "and",
  "a",
  "to",
  "of",
  "in",
  "for",
  "is",
  "on",
  "with",
  "that",
  "this",
  "it",
  "are",
  "as",
  "be",
  "by",
  "an",
  "or",
  "from",
  "at",
  "we",
  "our",
  "you",
  "your",
  "was",
  "were",
  "have",
  "has",
  "but",
  "not",
  "can",
  "will",
  "more",
  "about",
  "which",
]);

function stripHtml(s: string) {
  return s.replace(/<[^>]*>/g, " ");
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
}

function bigrams(tokens: string[]) {
  const out: string[] = [];
  for (let i = 0; i + 1 < tokens.length; i++) {
    out.push(tokens[i] + " " + tokens[i + 1]);
  }
  return out;
}

async function build() {
  const files = await fs.readdir(STORAGE_DIR);
  const docs: Array<{
    id: string;
    file: string;
    title: string;
    contentRaw: string;
    text: string;
    meaningfulnessScore?: number;
    aiDecision?: any;
  }> = [];

  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(STORAGE_DIR, f), "utf8");
      const obj = JSON.parse(raw);
      const title = (obj.title || "").trim();
      const bodyRaw = (obj.content || obj.description || "").trim();
      // initial length/structure filter
      if ((title && title.length > 5) || (bodyRaw && bodyRaw.length > 200)) {
        const contentRaw = bodyRaw;
        const text = stripHtml((title + " " + contentRaw).slice(0, 100000));
        // heuristics to detect junk pages (ads, menus, lists, price pages)
        const htmlTagRatio =
          (contentRaw.match(/<[^>]+>/g) || []).length /
          Math.max(1, contentRaw.split(/\s+/).length);
        const hasManyLinks = (contentRaw.match(/<a\s+/gi) || []).length > 8;
        const hasAddToCart = /add to cart|buy now|checkout|\$\d+/i.test(
          contentRaw,
        );
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        // stopword density (higher means more natural text)
        const swCount = (
          text.match(/\b(the|and|for|that|this|with|from|have|not|but)\b/gi) ||
          []
        ).length;
        const stopwordDensity = swCount / Math.max(1, wordCount);
        // basic meaningfulness score (0..1)
        let meaningfulnessScore = Math.min(
          1,
          (Math.log10(Math.max(10, wordCount)) / 3) *
            Math.max(0, stopwordDensity),
        );
        if (htmlTagRatio > 0.3 || hasManyLinks || hasAddToCart)
          meaningfulnessScore *= 0.2;

        // Optional AI-based classifier (Gemini) - enabled by setting USE_AI_FILTER=1 and GOOGLE_API_KEY in env
        let aiDecision = null;
        if (process.env.USE_AI_FILTER === "1" && process.env.GOOGLE_API_KEY) {
          try {
            const prompt = `Classify the following scraped content. Answer in JSON with keys: is_blog_post (true/false) and reason (short).\n\nCONTENT:\n${text.slice(0, 2000)}`;
            const apiKey = process.env.GOOGLE_API_KEY;
            const url = `https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText?key=${apiKey}`;
            const r = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: { text: prompt },
                temperature: 0.0,
              }),
            });
            const jr = await r.json();
            const candidate = jr?.candidates?.[0] || jr?.reply || jr;
            const outText = (
              candidate?.content ||
              candidate?.output ||
              candidate?.text ||
              JSON.stringify(candidate)
            ).toString();
            // look for true/false in response
            const isBlog = /"?is_blog_post"?\s*[:=]\s*(true|false)/i.exec(
              outText,
            )?.[1];
            if (isBlog)
              aiDecision = {
                is_blog_post: isBlog.toLowerCase() === "true",
                reason: outText,
              };
          } catch (e) {
            console.warn("AI filter failed:", e?.message || e);
          }
        }

        docs.push({
          id: f.replace(".json", ""),
          file: path.join(STORAGE_DIR, f),
          title,
          contentRaw,
          text,
          meaningfulnessScore,
          aiDecision,
        });
      }
    } catch (err) {
      console.warn("Skipping", f, err?.message || err);
    }
  }

  const N = docs.length;
  const df = new Map<string, number>();
  const docTokens: string[][] = [];

  for (const d of docs) {
    const toks = tokenize(d.text);
    const toksWithBigrams = toks.concat(bigrams(toks));
    const uniq = new Set(toksWithBigrams);
    for (const t of uniq) df.set(t, (df.get(t) || 0) + 1);
    docTokens.push(toksWithBigrams);
  }

  // Configurable threshold for meaningfulness (set MIN_MEANINGFULNESS env var to tune)
  // Allow quoted values e.g. "0.05"
  const rawMin = (process.env.MIN_MEANINGFULNESS || "0.25").replace(/"/g, "");
  const MIN_MEANINGFULNESS = parseFloat(rawMin || "0.25");
  // Filter out low-meaningfulness docs; keep those where score >= MIN_MEANINGFULNESS or AI decided it's a blog post
  const keep = docs.filter(
    (d) =>
      (d.meaningfulnessScore || 0) >= MIN_MEANINGFULNESS ||
      (d.aiDecision && d.aiDecision.is_blog_post),
  );

  console.log(
    `Docs scanned: ${docs.length}. Kept after threshold ${MIN_MEANINGFULNESS}: ${keep.length}`,
  );

  const posts = keep.map((d, i) => {
    const freq = new Map<string, number>();
    // recompute tfidf for the kept doc
    const toks = tokenize(d.text);
    const toksWithBigrams = toks.concat(bigrams(toks));
    for (const t of toksWithBigrams) freq.set(t, (freq.get(t) || 0) + 1);
    const tfidf: { term: string; score: number }[] = [];
    for (const [term, f] of freq.entries()) {
      const idf = Math.log((N + 1) / ((df.get(term) || 1) + 1)) + 1;
      tfidf.push({ term, score: f * idf });
    }
    tfidf.sort((a, b) => b.score - a.score);
    const themes = tfidf.slice(0, 8).map((x) => x.term);

    const excerpt = d.contentRaw
      ? d.contentRaw.replace(/\s+/g, " ").slice(0, 1200)
      : "";
    const wordCount = d.text.split(/\s+/).filter(Boolean).length;
    const readingMinutes = Math.max(1, Math.round(wordCount / 200));

    return {
      id: d.id,
      file: d.file,
      title: d.title,
      excerpt,
      wordCount,
      readingMinutes,
      themes,
      meaningfulnessScore: d.meaningfulnessScore || 0,
      aiDecision: d.aiDecision || null,
    };
  });

  await fs.writeFile(
    OUT_INDEX,
    JSON.stringify({ generatedAt: new Date().toISOString(), posts }, null, 2),
  );
  console.log(`Index written to ${OUT_INDEX} (${posts.length} posts)`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
