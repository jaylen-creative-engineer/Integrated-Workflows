#!/usr/bin/env node

/**
 * Quick test script: POST the fixture JSON files to the local /api/energy endpoint.
 *
 * Usage:
 *   node scripts/post-energy-fixture.mjs [--port 3000]
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    port: { type: "string", default: "3000" },
  },
  allowPositionals: false,
});

const port = values.port;
const baseUrl = `http://localhost:${port}`;

async function readJson(relativePath) {
  const abs = resolve(process.cwd(), relativePath);
  const raw = await readFile(abs, "utf8");
  return JSON.parse(raw);
}

async function main() {
  const sleep = await readJson(".devnotes/sleep-data-example.json");
  const recovery = await readJson(".devnotes/recovery-data-example.json");

  const body = {
    sleep,
    recovery,
    chronotypeOffsetHours: 0.5,
  };

  console.log(`POST ${baseUrl}/api/energy`);
  console.log("Request body:", JSON.stringify(body, null, 2).slice(0, 300) + "...\n");

  const res = await fetch(`${baseUrl}/api/energy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  console.log(`Response status: ${res.status}`);
  console.log("Response body:", JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});

