import { mkdir, writeFile, readFile } from "fs/promises";
import { generate as generateOgImage } from "./generateOgImage.js";

const BASE_URL = "https://ll.thespacedevs.com/2.3.0/launches/";
const PAGE_SIZE = 100;
const OUTPUT_FILE = "data/launches.json";

function shapeLaunch(launch) {
  return {
    name: launch.name,
    date: launch.net,
    status: launch.status?.abbrev ?? null,
    mission: launch.mission?.name ?? null,
  };
}

async function fetchPage(offset, afterDate, beforeDate) {
  const url = new URL(BASE_URL);
  url.searchParams.set("search", "SpaceX");
  url.searchParams.set("limit", PAGE_SIZE);
  url.searchParams.set("offset", offset);
  url.searchParams.set("ordering", "net");
  if (afterDate) {
    url.searchParams.set("net__gt", afterDate);
  }
  if (beforeDate) {
    url.searchParams.set("net__lte", beforeDate);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching offset ${offset}`);
  }
  return response.json();
}

async function loadExistingLaunches() {
  try {
    return JSON.parse(await readFile(OUTPUT_FILE, "utf-8"));
  } catch {
    return null;
  }
}

async function main() {
  await mkdir("data", { recursive: true });

  const fullRefetch = process.argv.includes("--full-refetch")
    || process.env.npm_config_full_refetch !== undefined;

  let loaded = null;
  let afterDate = null;

  if (!fullRefetch) {
    loaded = await loadExistingLaunches();
    if (loaded?.meta?.mostRecentLaunchDate) {
      afterDate = loaded.meta.mostRecentLaunchDate;
      console.log(`Incremental fetch: pulling launches after ${afterDate}`);
    } else {
      console.log("No existing data — performing full fetch...");
    }
  } else {
    console.log("Full refetch requested...");
  }

  const beforeDate = new Date().toISOString();

  const firstPage = await fetchPage(0, afterDate, beforeDate);
  const total = firstPage.count;

  if (total === 0) {
    console.log("No new launches found.");
    return;
  }

  console.log(`Fetching ${total} launches from Launch Library 2 (v2.3.0)...`);

  const newLaunches = firstPage.results.map(shapeLaunch);
  console.log(`  offset=0: fetched ${firstPage.results.length}`);

  for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const page = await fetchPage(offset, afterDate, beforeDate);
    console.log(`  offset=${offset}: fetched ${page.results.length}`);
    newLaunches.push(...page.results.map(shapeLaunch));
  }

  const existingByDay = fullRefetch ? {} : (loaded?.byDay ?? {});
  const dayMap = { meta: {}, byDay: existingByDay };
  for (const launch of newLaunches) {
    const date = new Date(launch.date);
    const key = `${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    if (!dayMap.byDay[key]) dayMap.byDay[key] = [];
    dayMap.byDay[key].push(launch);
  }
  dayMap.meta.mostRecentLaunchDate = newLaunches.map((launch) => launch.date).sort().at(-1);
  await writeFile(OUTPUT_FILE, JSON.stringify(dayMap, null, 2));
  const total_count = Object.values(dayMap.byDay).reduce(
    (sum, value) => sum + value.length, 0
  );
  console.log(`Saved ${total_count} total launches (${newLaunches.length} new) to ${OUTPUT_FILE}`);
  generateOgImage();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
