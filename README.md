# Blog Idea Generator

This project is a blog idea generator that scrapes blog posts, indexes them, and then uses a Large Language Model (LLM) to generate new blog post ideas based on selected inspirations.

## How to run the Blog Idea Generator UI

1.  **Install dependencies**

    ```bash
    npm install
    ```

2.  **Build the index of meaningful posts** (scans `storage/datasets/default`)

    ```bash
    npm run build-index
    ```

3.  **Start the UI server** (ensure `GOOGLE_API_KEY` or `OPENAI_API_KEY` is set in your environment variables)

    ```bash
    # Example for zsh (replace with your shell equivalent if needed)
    export GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY"
    npm run ui
    ```

    **OR fall back to OpenAI**

    ```bash
    export OPENAI_API_KEY="sk-..."
    npm run ui
    ```

4.  **Open your browser** to `http://localhost:3001`. Paste a base style, select posts, optionally add a theme, and click "Generate idea."

## Notes

- The indexer writes to `storage/indexed_posts.json`.
- The generation endpoint will prefer Google Generative API (Gemini) if `GOOGLE_API_KEY` is set; otherwise, it falls back to OpenAI.
- Use the `MIN_MEANINGFULNESS` environment variable to tune the indexer (e.g., `MIN_MEANINGFULNESS=0.05`). To enable AI filtering during indexing, set `USE_AI_FILTER=1` and provide your `GOOGLE_API_KEY`.

## Project Structure

- `src/main.ts`: Main crawler entry point.
- `src/routes.ts`: Defines how the crawler handles different types of URLs and extracts data.
- `src/ui-server.ts`: Express server for the web UI.
- `public/`: Contains static files for the UI (`index.html`, `app.js`).
- `scripts/build-index.ts`: Script to build the search index from scraped data.
- `src/utils/blogs-list/blog-urls.csv`: CSV file containing the list of blog URLs to crawl.

This codebase uses [Crawlee](https://crawlee.dev/) for web scraping and [Express.js](https://expressjs.com/) for the UI server. It leverages Google Generative AI (Gemini) or OpenAI for generating blog ideas.
