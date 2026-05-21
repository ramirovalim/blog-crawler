import fs from "fs/promises";

const readCsvStringFromFile = async () => {
  const csvString = await fs.readFile(
    process.cwd() + "/src/utils/blogs-list/blog-urls.csv",
    {
      encoding: "utf-8",
    },
  );

  return csvString;
};

const parseCsvString = async (csvString: string) => {
  const rows = csvString.split("\n");

  // CSV header: "Nome,Status,URL"
  const rawList = rows.slice(1).map((row) => row.trim().split(",")[2]);

  const urlList = rawList.filter((url) => url.length > 0);

  return urlList;
};

export const loadInitialBlogsUrls = async () => {
  const csvString = await readCsvStringFromFile();
  const initialBlogsUrls = await parseCsvString(csvString);

  return initialBlogsUrls;
};
