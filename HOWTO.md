How to run the Blog Idea Generator UI

1. Install deps

   npm install

2. Build the index of meaningful posts (scans storage/datasets/default)

   npm run build-index

3. Start the UI server (ensure GOOGLE_API_KEY or OPENAI_API_KEY is set in env)

   # in zsh

   export GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY"
   npm run ui

   # OR fall back to OpenAI

   export OPENAI_API_KEY="sk-..."
   npm run ui

4. Open http://localhost:3001 in your browser. Paste a base style, select posts, optionally add a theme, and click Generate idea.

Notes

- The indexer writes to storage/indexed_posts.json.
- The generate endpoint will prefer Google Generative API (Gemini) if `GOOGLE_API_KEY` is set, otherwise it falls back to OpenAI.
- If you want the UI to run on a different port, set PORT in the environment.
