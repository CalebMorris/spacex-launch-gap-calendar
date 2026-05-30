import { fileURLToPath } from "url";
import { readFile, writeFile } from "fs/promises";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW_ABBR = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const TEMPLATE_PATH = "src/template.html";
const DATA_PATH = "site/data/launches.json";
const OUTPUT_PATH = "site/index.html";

function days_in_month(year, month_index) {
  return new Date(year, month_index + 1, 0).getDate();
}

function first_dow(year, month_index) {
  return new Date(year, month_index, 1).getDay();
}

function escape_html(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function level_class(count) {
  if (count === 0) return "l0";
  if (count <= 2) return "l1";
  if (count <= 4) return "l2";
  return "l3";
}

export function compute_stats(launches_by_day, year) {
  let total = 0;
  let launch_days = 0;
  const month_counts = new Array(12).fill(0);
  const month_launch_days = new Array(12).fill(0);

  for (const [key, missions] of Object.entries(launches_by_day)) {
    total += missions.length;
    launch_days++;
    const month_idx = parseInt(key.slice(0, 2), 10) - 1;
    month_counts[month_idx] += missions.length;
    month_launch_days[month_idx]++;
  }

  let total_days = 0;
  for (let m = 0; m < 12; m++) total_days += days_in_month(year, m);

  const month_gap_counts = month_launch_days.map(
    (ld, m) => days_in_month(year, m) - ld,
  );

  const busiest_idx = month_counts.indexOf(Math.max(...month_counts));
  const quietest_idx = month_gap_counts.indexOf(Math.max(...month_gap_counts));

  return {
    total,
    launch_days,
    gap_days: total_days - launch_days,
    busiest_label: total > 0 ? MONTH_NAMES[busiest_idx].slice(0, 3).toUpperCase() : "–",
    quietest_label: total > 0 ? MONTH_NAMES[quietest_idx].slice(0, 3).toUpperCase() : "–",
  };
}

export function render_month_card(month_index, launches_by_day, year) {
  const month_name = MONTH_NAMES[month_index];
  const month_str = String(month_index + 1).padStart(2, "0");

  let month_total = 0;
  for (const [key, missions] of Object.entries(launches_by_day)) {
    if (key.startsWith(month_str + "-")) month_total += missions.length;
  }

  const count_label = month_total > 0
    ? `<span class="month-launch-count">${month_total} launch${month_total !== 1 ? "es" : ""}</span>`
    : "";

  const header_cells = DOW_ABBR.map(
    (abbr) => `<div class="day-header-cell" role="columnheader" aria-label="${abbr}">${abbr}</div>`,
  ).join("");

  const leading_blanks = first_dow(year, month_index);
  const num_days = days_in_month(year, month_index);

  let rows_html = "";
  let week_cells = "";
  let col_in_row = 0;

  for (let i = 0; i < leading_blanks; i++) {
    week_cells += `<div class="day-cell" role="gridcell"></div>`;
    col_in_row++;
  }

  for (let day = 1; day <= num_days; day++) {
    if (col_in_row === 7) {
      rows_html += `<div role="row" style="display:contents">${week_cells}</div>`;
      week_cells = "";
      col_in_row = 0;
    }

    const day_str = String(day).padStart(2, "0");
    const key = `${month_str}-${day_str}`;
    const day_launches = launches_by_day[key] ?? [];
    const count = day_launches.length;
    const level = level_class(count);
    const has_launch = count > 0;

    const classes = `day-cell ${level}${has_launch ? " has-launch" : ""}`;
    const aria_label = has_launch
      ? ` aria-label="${month_name} ${day}: ${count} launch${count !== 1 ? "es" : ""}"`
      : "";

    let inner = `<div class="day-num">${day}</div>`;

    if (has_launch) {
      const mission_text = count === 1
        ? escape_html(day_launches[0].mission ?? day_launches[0].name)
        : `${count} missions`;
      inner += `<div class="day-mission-name" aria-hidden="true">${mission_text}</div>`;
      if (count > 1) {
        inner += `<div class="count-badge" aria-hidden="true">${count}</div>`;
      }
    }

    week_cells += `<div class="${classes}" role="gridcell" data-month="${month_index}" data-day="${day}" tabindex="${has_launch ? "0" : "-1"}"${aria_label}>${inner}</div>`;
    col_in_row++;
  }

  if (col_in_row > 0) {
    rows_html += `<div role="row" style="display:contents">${week_cells}</div>`;
  }

  return `<div class="month-card">
  <h2 class="month-title"><span>${month_name}</span>${count_label}</h2>
  <div class="day-grid" role="grid" aria-label="${month_name}">
    <div role="row" style="display:contents">${header_cells}</div>
    ${rows_html}
  </div>
</div>`;
}

export function render_calendar_grid(launches_by_day, year) {
  const cards = Array.from({ length: 12 }, (_, i) =>
    render_month_card(i, launches_by_day, year),
  ).join("\n");
  return `<div class="calendar-grid">\n${cards}\n</div>`;
}

export function fill_template(template, replacements) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) =>
    key in replacements ? replacements[key] : match,
  );
}

async function main() {
  const year = new Date().getFullYear();

  const [template, data_raw] = await Promise.all([
    readFile(TEMPLATE_PATH, "utf-8"),
    readFile(DATA_PATH, "utf-8"),
  ]);

  const data = JSON.parse(data_raw);
  const stats = compute_stats(data.byDay, year);
  const calendar_grid_html = render_calendar_grid(data.byDay, year);

  // Escape </script> sequences so inlined JSON cannot break the script tag
  const launches_json = JSON.stringify(data.byDay).replace(/<\/script>/gi, "<\\/script>");

  const output = fill_template(template, {
    STAT_TOTAL: stats.total.toLocaleString(),
    STAT_DAYS: String(stats.launch_days),
    STAT_BUSIEST: stats.busiest_label,
    STAT_GAP_DAYS: String(stats.gap_days),
    STAT_QUIETEST: stats.quietest_label,
    CALENDAR_GRID: calendar_grid_html,
    LAUNCHES_DATA_JSON: launches_json,
    FRESHNESS_ISO: data.meta.mostRecentLaunchDate,
    BUILD_YEAR: String(year),
  });

  await writeFile(OUTPUT_PATH, output, "utf-8");
  console.log(`Generated ${OUTPUT_PATH} (year=${year}, launches=${stats.total})`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
