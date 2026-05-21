import { Browser, ImpitHttpClient } from "@crawlee/impit-client";
import { CheerioCrawler, log } from "crawlee";
import { router } from "./routes.js";
import { loadInitialBlogsUrls } from "./utils/blogs-list/index.js";

const startUrls = await loadInitialBlogsUrls();

log.setLevel(log.LEVELS.INFO);

const crawler = new CheerioCrawler({
  // proxyConfiguration: new ProxyConfiguration({ proxyUrls: ["..."] }),
  httpClient: new ImpitHttpClient({ browser: Browser.Chrome }),
  requestHandler: router,
});

log.info(`Starting crawl of ${startUrls.length} URLs...`);

await crawler.run(startUrls);

log.info("Crawl finished. Results are in Key-Value Store.");
