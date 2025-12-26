#!/usr/bin/env zx

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { buildEnergyScheduleFromWhoop } from "../src/energy/whoopEnergyModel.js";

function asNumber(x, fallback) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

async function readJson(filePath) {
  const abs = resolve(process.cwd(), filePath);
  const raw = await readFile(abs, "utf8");
  return JSON.parse(raw);
}

function usage() {
  return `
Usage:
  zx scripts/whoop-energy.mjs [--sleepJson <path>] [--recoveryJson <path>] [--chronotypeOffsetHours <n>] [--dayDate <YYYY-MM-DD>] [--pretty|--raw]

Examples:
  zx scripts/whoop-energy.mjs --pretty
  zx scripts/whoop-energy.mjs --chronotypeOffsetHours=-0.5 --raw
  npm run whoop:energy -- --raw
`.trim();
}

// `zx` includes the script path in argv; strip it if present so we can be flags-only.
const rawArgs = process.argv.slice(2);
const args = rawArgs[0]?.endsWith("whoop-energy.mjs")
  ? rawArgs.slice(1)
  : rawArgs;

const { values } = parseArgs({
  args,
  options: {
    sleepJson: { type: "string" },
    recoveryJson: { type: "string" },
    chronotypeOffsetHours: { type: "string" },
    dayDate: { type: "string" },
    pretty: { type: "boolean", default: true },
    raw: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
  allowPositionals: false,
});

if (values.help) {
  console.log(usage());
  process.exit(0);
}

const pretty = values.raw ? false : Boolean(values.pretty);

const sleepJsonPath = values.sleepJson ?? ".devnotes/sleep-data-example.json";
const recoveryJsonPath =
  values.recoveryJson ?? ".devnotes/recovery-data-example.json";

const sleep = await readJson(sleepJsonPath);
const recovery = await readJson(recoveryJsonPath);

const out = buildEnergyScheduleFromWhoop(sleep, recovery, {
  chronotypeOffsetHours: asNumber(values.chronotypeOffsetHours, 0.5),
  dayDate: values.dayDate ?? undefined,
});

// Allow piping to tools like `head` without crashing on EPIPE.
process.stdout.on("error", (err) => {
  if (err?.code === "EPIPE") process.exit(0);
});

process.stdout.write(JSON.stringify(out, null, pretty ? 2 : 0) + "\n");
