import { createCheerioRouter } from "crawlee";

export const router = createCheerioRouter();

router.addDefaultHandler(async ({ request, enqueueLinks, log }) => {
  log.info(`enqueueing new URLs`);
  await enqueueLinks({
    strategy: "same-origin",
    globs: [`${request.url}/**`],
    label: "detail",
  });
});

router.addHandler("detail", async ({ request, $, log, pushData }) => {
  log.info(`Extracting data for ${request.loadedUrl}`);

  const title = $("h1, title").first().text().trim();

  // Attempt to find content in various common tags
  let content = $("article").text().trim();
  if (!content) {
    content = $(
      "div.post-content, div.entry-content, div.blog-post-content, .content, .post-body, p, section.blog",
    )
      .text()
      .trim();
  }

  // Extracting more metadata
  const description =
    $("meta[name='description']").attr("content") ||
    $("meta[property='og:description']").attr("content") ||
    "";
  const author =
    $("meta[name='author']").attr("content") ||
    $(".author-name").first().text().trim() ||
    "";
  const publishedDate =
    $("time").attr("datetime") || $(".post-date").first().text().trim() || "";

  const blogPost = {
    url: request.loadedUrl,
    title,
    description,
    author,
    publishedDate,
    content,
    // Placeholder for AI analysis results
    aiAnalysis: null,
    aiRewrittenContent: null,
  };

  await pushData(blogPost);

  log.info(`Data extracted for: ${title}`, { url: request.loadedUrl });
});
