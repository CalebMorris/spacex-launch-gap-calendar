import { mkdir, writeFile } from "fs/promises";

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

async function fetchPage(offset) {
  const url = new URL(BASE_URL);
  url.searchParams.set("search", "SpaceX");
  url.searchParams.set("limit", PAGE_SIZE);
  url.searchParams.set("offset", offset);
  url.searchParams.set("ordering", "net");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} at offset ${offset}`);
  }
  return response.json();
}

async function main() {
  await mkdir("data", { recursive: true });

  console.log("Fetching SpaceX launches from Launch Library 2 (v2.3.0)...");

  const firstPage = await fetchPage(0);
  const total = firstPage.count;
  const launches = firstPage.results.map(shapeLaunch);

  console.log(`  offset=0: fetched ${firstPage.results.length} (total available: ${total})`);

  for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const page = await fetchPage(offset);
    console.log(`  offset=${offset}: fetched ${page.results.length}`);
    launches.push(...page.results.map(shapeLaunch));
  }

  console.log(`Total launches fetched: ${launches.length}`);

  await writeFile(OUTPUT_FILE, JSON.stringify(launches, null, 2));
  console.log(`Saved to ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
