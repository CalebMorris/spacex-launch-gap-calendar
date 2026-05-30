import { test } from "node:test";
import assert from "node:assert/strict";
import {
  level_class,
  compute_stats,
  render_month_card,
  render_calendar_grid,
  fill_template,
} from "./generateHtml.js";

// ── level_class ──────────────────────────────────────────────────────────────

test("level_class: 0 launches → l0", () => {
  assert.equal(level_class(0), "l0");
});

test("level_class: 1 launch → l1", () => {
  assert.equal(level_class(1), "l1");
});

test("level_class: 2 launches → l1", () => {
  assert.equal(level_class(2), "l1");
});

test("level_class: 3 launches → l2", () => {
  assert.equal(level_class(3), "l2");
});

test("level_class: 4 launches → l2", () => {
  assert.equal(level_class(4), "l2");
});

test("level_class: 5 launches → l3", () => {
  assert.equal(level_class(5), "l3");
});

test("level_class: 10 launches → l3", () => {
  assert.equal(level_class(10), "l3");
});

// ── compute_stats ────────────────────────────────────────────────────────────

test("compute_stats: empty data returns zero counts and em-dash labels", () => {
  const stats = compute_stats({}, 2026);
  assert.equal(stats.total, 0);
  assert.equal(stats.launch_days, 0);
  assert.equal(stats.busiest_label, "–");
  assert.equal(stats.quietest_label, "–");
});

test("compute_stats: tallies total launches across all days", () => {
  const launches_by_day = {
    "01-03": [make_launch("2023-01-03")],
    "01-15": [make_launch("2023-01-15"), make_launch("2024-01-15")],
  };
  const stats = compute_stats(launches_by_day, 2026);
  assert.equal(stats.total, 3);
  assert.equal(stats.launch_days, 2);
});

test("compute_stats: gap_days = total days in year − unique launch days", () => {
  const launches_by_day = { "06-01": [make_launch("2023-06-01")] };
  const stats = compute_stats(launches_by_day, 2026);
  assert.equal(stats.gap_days, 364); // 2026 is not a leap year: 365 days − 1
});

test("compute_stats: busiest_label is the month with most launches", () => {
  const launches_by_day = {
    "01-01": [make_launch("2023-01-01")],
    "06-01": [make_launch("2023-06-01"), make_launch("2024-06-01")],
  };
  const stats = compute_stats(launches_by_day, 2026);
  assert.equal(stats.busiest_label, "JUN");
});

test("compute_stats: quietest_label is the month with most gap days", () => {
  // Fill every day of Jan and Feb (Jan has 31 days, Feb has 28 in 2026)
  // leave all other months empty → quietest will be a month with 30-31 gap days
  const launches_by_day = {};
  for (let d = 1; d <= 31; d++) {
    launches_by_day[`01-${String(d).padStart(2, "0")}`] = [make_launch("2023-01-01")];
  }
  for (let d = 1; d <= 28; d++) {
    launches_by_day[`02-${String(d).padStart(2, "0")}`] = [make_launch("2023-02-01")];
  }
  const stats = compute_stats(launches_by_day, 2026);
  // All remaining months have 100% gap days; the one with the most days (31) should win
  const thirty_one_day_months = new Set(["MAR", "MAY", "JUL", "AUG", "OCT", "DEC"]);
  assert.ok(thirty_one_day_months.has(stats.quietest_label), `got ${stats.quietest_label}`);
});

// ── render_month_card ────────────────────────────────────────────────────────

test("render_month_card: output is a non-empty string", () => {
  const html = render_month_card(0, {}, 2026);
  assert.ok(typeof html === "string" && html.length > 0);
});

test("render_month_card: includes month name", () => {
  assert.ok(render_month_card(0, {}, 2026).includes("January"));
  assert.ok(render_month_card(5, {}, 2026).includes("June"));
  assert.ok(render_month_card(11, {}, 2026).includes("December"));
});

test("render_month_card: gap day gets l0 class, not has-launch", () => {
  const html = render_month_card(0, {}, 2026);
  assert.ok(html.includes("l0"));
  assert.ok(!html.includes("has-launch"));
});

test("render_month_card: 1-launch day gets l1 and has-launch", () => {
  const html = render_month_card(0, { "01-05": [make_launch("2023-01-05")] }, 2026);
  assert.ok(html.includes("l1"));
  assert.ok(html.includes("has-launch"));
});

test("render_month_card: 3-launch day gets l2", () => {
  const html = render_month_card(0, {
    "01-01": [1, 2, 3].map(() => make_launch("2023-01-01")),
  }, 2026);
  assert.ok(html.includes("l2"));
});

test("render_month_card: 5-launch day gets l3", () => {
  const html = render_month_card(0, {
    "01-01": [1, 2, 3, 4, 5].map(() => make_launch("2023-01-01")),
  }, 2026);
  assert.ok(html.includes("l3"));
});

test("render_month_card: launch day embeds data-month and data-day", () => {
  const html = render_month_card(0, { "01-07": [make_launch("2023-01-07")] }, 2026);
  assert.ok(html.includes('data-month="0"'));
  assert.ok(html.includes('data-day="7"'));
});

test("render_month_card: multi-launch day shows count badge and '# missions' text", () => {
  const launches = [1, 2, 3].map(() => make_launch("2023-01-01"));
  const html = render_month_card(0, { "01-01": launches }, 2026);
  assert.ok(html.includes("count-badge"));
  assert.ok(html.includes("3 missions"));
});

test("render_month_card: single-launch day shows mission name", () => {
  const html = render_month_card(0, {
    "01-01": [{ name: "Falcon 9 | Starlink", date: "2023-01-01T00:00:00Z", status: "Success", mission: "Starlink Group 1" }],
  }, 2026);
  assert.ok(html.includes("Starlink Group 1"));
});

test("render_month_card: mission name HTML-escapes special characters", () => {
  const html = render_month_card(0, {
    "01-01": [{ name: "Falcon 9 | <Test> & 'Co'", date: "2023-01-01T00:00:00Z", status: "Success", mission: '<Script> & "Quotes"' }],
  }, 2026);
  assert.ok(!html.includes('<Script>'));
  assert.ok(html.includes("&lt;Script&gt;"));
  assert.ok(html.includes("&amp;"));
});

test("render_month_card: shows launch count in month title", () => {
  const html = render_month_card(0, { "01-05": [make_launch("2023-01-05")] }, 2026);
  assert.ok(html.includes("1 launch"));
});

test("render_month_card: no launch count shown for empty month", () => {
  const html = render_month_card(0, {}, 2026);
  assert.ok(!html.includes("launch"));
});

// ── render_calendar_grid ─────────────────────────────────────────────────────

test("render_calendar_grid: contains calendar-grid class", () => {
  const html = render_calendar_grid({}, 2026);
  assert.ok(html.includes("calendar-grid"));
});

test("render_calendar_grid: renders exactly 12 month cards", () => {
  const html = render_calendar_grid({}, 2026);
  const count = (html.match(/class="month-card"/g) ?? []).length;
  assert.equal(count, 12);
});

// ── fill_template ────────────────────────────────────────────────────────────

test("fill_template: replaces known placeholders", () => {
  const result = fill_template("Hello {{NAME}}, count: {{COUNT}}", { NAME: "World", COUNT: "42" });
  assert.equal(result, "Hello World, count: 42");
});

test("fill_template: leaves unknown placeholders untouched", () => {
  const result = fill_template("{{KNOWN}} {{UNKNOWN}}", { KNOWN: "hi" });
  assert.equal(result, "hi {{UNKNOWN}}");
});

test("fill_template: handles empty replacements map", () => {
  const result = fill_template("{{A}} {{B}}", {});
  assert.equal(result, "{{A}} {{B}}");
});

// ── helpers ──────────────────────────────────────────────────────────────────

function make_launch(date_iso) {
  return { name: "Falcon 9 | Test", date: `${date_iso}T00:00:00Z`, status: "Success", mission: "Test Mission" };
}
