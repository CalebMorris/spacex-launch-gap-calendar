import { mkdir, writeFile, readFile } from "fs/promises";

const BASE_URL = "https://ll.thespacedevs.com/2.3.0/launches/";
const PAGE_SIZE = 100;
const OUTPUT_FILE = "data/launches.json";

function shapeLaunch(launch) {
  return {
    id: launch.id,
    name: launch.name,
    date: launch.net,
    status: launch.status?.abbrev ?? null,
    rocket: launch.rocket?.configuration?.name ?? null,
    mission: launch.mission?.name ?? null,
    missionDescription: launch.mission?.description ?? null,
    launchSite: launch.pad?.name ?? null,
    launchSiteLocation: launch.pad?.location?.name ?? null,
  };
}

async function fetchPage(offset, afterDate) {
  const url = new URL(BASE_URL);
  url.searchParams.set("search", "SpaceX");
  url.searchParams.set("limit", PAGE_SIZE);
  url.searchParams.set("offset", offset);
  url.searchParams.set("ordering", "net");
  if (afterDate) {
    url.searchParams.set("net__gt", afterDate);
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

function latestDate(launches) {
  return launches.map((launch) => launch.date).sort().at(-1);
}

async function main() {
  await mkdir("data", { recursive: true });

  const fullRefetch = process.argv.includes("--full-refetch");

  let existingLaunches = [];
  let afterDate = null;

  if (!fullRefetch) {
    const loaded = await loadExistingLaunches();
    if (loaded?.length > 0) {
      existingLaunches = loaded;
      afterDate = latestDate(existingLaunches);
      console.log(`Incremental fetch: pulling launches after ${afterDate}`);
    } else {
      console.log("No existing data — performing full fetch...");
    }
  } else {
    console.log("Full refetch requested...");
  }

  const firstPage = await fetchPage(0, afterDate);
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
    const page = await fetchPage(offset, afterDate);
    console.log(`  offset=${offset}: fetched ${page.results.length}`);
    newLaunches.push(...page.results.map(shapeLaunch));
  }

  const allLaunches = fullRefetch
    ? newLaunches
    : [...existingLaunches, ...newLaunches];

  await writeFile(OUTPUT_FILE, JSON.stringify(allLaunches, null, 2));
  console.log(`Saved ${allLaunches.length} total launches (${newLaunches.length} new) to ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
