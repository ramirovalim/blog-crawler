import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

const INDEX_FILE = path.join(process.cwd(), "storage", "indexed_posts.json");
const DATASET_DIR = path.join(process.cwd(), "storage", "datasets", "default");

app.get("/api/posts", async (_req: Request, res: any) => {
  try {
    const idx = JSON.parse(await fs.readFile(INDEX_FILE, "utf8"));
    res.json(idx);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to read index. Run npm run build-index first." });
  }
});

app.get("/api/post/:id", async (req, res) => {
  const id = path.basename(req.params.id);
  const filepath = path.join(DATASET_DIR, `${id}.json`);
  try {
    const raw = await fs.readFile(filepath, "utf8");
    const obj = JSON.parse(raw);
    const content = String(obj.content || obj.description || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    res.json({
      id,
      title: obj.title || "",
      url: obj.url || "",
      author: obj.author || "",
      publishedDate: obj.publishedDate || "",
      excerpt: content.slice(0, 500),
      fullContent: content.slice(0, 4000),
    });
  } catch (err) {
    res
      .status(404)
      .json({ error: "Post not found", detail: String(err instanceof Error ? err.message : err) });
  }
});

app.post("/api/generate", async (req, res) => {
  const { postIds = [], baseStyle = "", theme = "" } = req.body || {};
  if (!Array.isArray(postIds) || postIds.length === 0) {
    return res.status(400).json({ error: "postIds required" });
  }

  try {
    const selected: string[] = [];
    for (const id of postIds) {
      const filepath = path.join(DATASET_DIR, `${id}.json`);
      const raw = await fs.readFile(filepath, "utf8");
      const obj = JSON.parse(raw);
      selected.push(
        `Title: ${obj.title || ""}\nURL: ${obj.url || ""}\nExcerpt:\n${(obj.content || "").slice(0, 3000)}`,
      );
    }

    const system = `You are a creative blog idea assistant. Do NOT copy verbatim from sources. Produce a detailed blog idea: title, one-paragraph warm introduction, and a story about the topic. Keep it concise yet complete, and original, human-like. No matter what, the output must be in Brazilian-Portuguese.`;
    const userPrompt = `
Base style (how the output should sound):
${baseStyle}

Selected inspirations:
${selected.join("\n\n---\n\n")}

Chosen theme: ${theme}

Create a new blog idea (title, one-paragraph warm introduction/summary, story development, following suggested tone).`;

    // Prefer Google's REST Generative API if GOOGLE_API_KEY is set
    if (process.env.GOOGLE_API_KEY) {
      try {
        const r = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: userPrompt,
          config: {
            temperature: 0.7,
            systemInstruction: system,
          },
        });

        if (r.text === undefined) {
          return res
            .status(502)
            .json({ error: "Google Generative API error", detail: JSON.stringify(r) });
        }

        const out = r.text;
        return res.json({ result: out });
        /* const apiKey = process.env.GOOGLE_API_KEY;
        const url = `https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText?key=${apiKey}`;
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: { text: `${system}\n\n${userPrompt}` },
            temperature: 0.7,
          }),
        });
        if (!r.ok) {
          const txt = await r.text();
          return res
            .status(502)
            .json({ error: "Google Generative API error", detail: txt });
        }
        const jr = await r.json();
        const out =
          jr?.candidates?.[0]?.content ||
          jr?.reply ||
          JSON.stringify(jr, null, 2);
        return res.json({ result: out }); */
      } catch (e) {
        console.error("Google REST call failed:", e instanceof Error ? e.message : e);
        return res.status(502).json({ error: "Google Generative API error", detail: String(e) });
      }
    }

    // Fallback to OpenAI
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey)
      return res.status(500).json({
        error: "No AI key configured (set GOOGLE_API_KEY or OPENAI_API_KEY)",
      });

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 600,
        temperature: 0.9,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(502).json({ error: "AI provider error", detail: txt });
    }

    const data = (await resp.json()) as any;
    const text =
      data.choices?.[0]?.message?.content || JSON.stringify(data, null, 2);
    return res.json({ result: text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Generation failed", detail: String(err) });
  }
});

const port = process.env.PORT ? Number(process.env.PORT) : 3001;
app.listen(port, () =>
  console.log(`UI server running at http://localhost:${port}`),
);
