import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import {
  shapeLaunch,
  buildDayMap,
  fetchPage,
  loadExistingLaunches,
} from "./fetchLaunches.js";

// ---------------------------------------------------------------------------
// shapeLaunch
// ---------------------------------------------------------------------------

describe("shapeLaunch", () => {
  test("maps all fields from a complete launch object", () => {
    const raw = {
      name: "Falcon 9 | Starlink",
      net: "2024-01-03T03:44:20Z",
      status: { abbrev: "Success" },
      mission: { name: "Starlink Group 7-9" },
    };
    assert.deepEqual(shapeLaunch(raw), {
      name: "Falcon 9 | Starlink",
      date: "2024-01-03T03:44:20Z",
      status: "Success",
      mission: "Starlink Group 7-9",
    });
  });

  test("returns null status when status is absent", () => {
    const raw = { name: "x", net: "2024-01-01T00:00:00Z", mission: { name: "m" } };
    assert.equal(shapeLaunch(raw).status, null);
  });

  test("returns null mission when mission is absent", () => {
    const raw = { name: "x", net: "2024-01-01T00:00:00Z", status: { abbrev: "Success" } };
    assert.equal(shapeLaunch(raw).mission, null);
  });
});

// ---------------------------------------------------------------------------
// buildDayMap
// ---------------------------------------------------------------------------

describe("buildDayMap", () => {
  const launchJan3 = { name: "A", date: "2024-01-03T03:44:20Z", status: "Success", mission: "M1" };
  const launchMar15 = { name: "B", date: "2024-03-15T12:00:00Z", status: "Success", mission: "M2" };

  test("groups launches by MM-DD UTC key", () => {
    const result = buildDayMap([launchJan3, launchMar15]);
    assert.ok(result.byDay["01-03"], "expected 01-03 key");
    assert.ok(result.byDay["03-15"], "expected 03-15 key");
    assert.equal(result.byDay["01-03"][0].name, "A");
  });

  test("sets mostRecentLaunchDate to the latest date string", () => {
    const result = buildDayMap([launchJan3, launchMar15]);
    assert.equal(result.meta.mostRecentLaunchDate, "2024-03-15T12:00:00Z");
  });

  test("merges new launches into existing byDay entries", () => {
    const existing = {
      "01-03": [{ name: "Old", date: "2023-01-03T00:00:00Z", status: "Success", mission: null }],
    };
    const result = buildDayMap([launchJan3], existing);
    assert.equal(result.byDay["01-03"].length, 2);
    assert.equal(result.byDay["01-03"][0].name, "Old");
    assert.equal(result.byDay["01-03"][1].name, "A");
  });

  test("does not mutate the existingByDay argument", () => {
    const existing = { "01-03": [{ name: "Old" }] };
    buildDayMap([launchJan3], existing);
    assert.equal(existing["01-03"].length, 1);
  });

  test("uses an empty byDay when no existingByDay is supplied", () => {
    const result = buildDayMap([launchJan3]);
    assert.equal(Object.keys(result.byDay).length, 1);
  });
});

// ---------------------------------------------------------------------------
// fetchPage
// ---------------------------------------------------------------------------

describe("fetchPage", () => {
  function makeFetch(status, body) {
    return () =>
      Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
      });
  }

  function capturingFetch(body = { count: 0, results: [] }) {
    let capturedUrl;
    const fn = (url) => {
      capturedUrl = url;
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    };
    fn.captured = () => capturedUrl;
    return fn;
  }

  test("constructs URL with required search params", async () => {
    const spy = capturingFetch();
    await fetchPage(0, null, null, spy);
    const params = spy.captured().searchParams;
    assert.equal(params.get("search"), "SpaceX");
    assert.equal(params.get("limit"), "100");
    assert.equal(params.get("offset"), "0");
    assert.equal(params.get("ordering"), "net");
  });

  test("includes net__gt param when afterDate is provided", async () => {
    const spy = capturingFetch();
    await fetchPage(0, "2024-01-01T00:00:00Z", null, spy);
    assert.equal(spy.captured().searchParams.get("net__gt"), "2024-01-01T00:00:00Z");
  });

  test("omits net__gt param when afterDate is null", async () => {
    const spy = capturingFetch();
    await fetchPage(0, null, null, spy);
    assert.equal(spy.captured().searchParams.get("net__gt"), null);
  });

  test("includes net__lte param when beforeDate is provided", async () => {
    const spy = capturingFetch();
    await fetchPage(0, null, "2024-12-31T23:59:59Z", spy);
    assert.equal(spy.captured().searchParams.get("net__lte"), "2024-12-31T23:59:59Z");
  });

  test("throws with HTTP status on non-ok response", async () => {
    await assert.rejects(
      () => fetchPage(0, null, null, makeFetch(429, {})),
      /HTTP 429/
    );
  });

  test("returns parsed JSON body on success", async () => {
    const body = { count: 1, results: [{ name: "Launch" }] };
    const result = await fetchPage(0, null, null, makeFetch(200, body));
    assert.deepEqual(result, body);
  });
});

// ---------------------------------------------------------------------------
// loadExistingLaunches
// ---------------------------------------------------------------------------

describe("loadExistingLaunches", () => {
  test("returns null when file does not exist", async () => {
    const result = await loadExistingLaunches("/tmp/definitely-absent-file-xyz.json");
    assert.equal(result, null);
  });

  test("returns parsed JSON when file exists", async () => {
    const filePath = join(tmpdir(), `test-launches-${Date.now()}.json`);
    const data = { meta: { mostRecentLaunchDate: "2024-01-01T00:00:00Z" }, byDay: {} };
    await writeFile(filePath, JSON.stringify(data));
    try {
      const result = await loadExistingLaunches(filePath);
      assert.deepEqual(result, data);
    } finally {
      await unlink(filePath);
    }
  });
});
