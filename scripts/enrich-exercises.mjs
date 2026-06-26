#!/usr/bin/env node
/**
 * Enrich a local copy of `yuhonas/free-exercise-db`'s exercises.json:
 *   1. Prepend the official raw GitHub base URL to every image path so they're
 *      absolute and renderable directly.
 *   2. Add a `youtubeLink` property with a clean YouTube search URL based on
 *      the exercise name (and equipment when meaningful).
 *
 * Usage:
 *   node scripts/enrich-exercises.mjs [inputPath] [outputPath]
 *
 * Defaults:
 *   input  = ./exercises.json
 *   output = ./exercises-enriched.json
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";

const IMAGE_BASE =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
const YT_BASE = "https://www.youtube.com/results?search_query=";

const [, , inArg = "exercises.json", outArg = "exercises-enriched.json"] =
  process.argv;

function youtubeLink(name, equipment) {
  const parts = ["how to do", String(name || "").trim()];
  const eq = String(equipment || "").trim().toLowerCase();
  if (eq && eq !== "body only" && eq !== "none" && eq !== "null") {
    parts.push(String(equipment).trim());
  }
  parts.push("form");
  // Use %20 for spaces (not "+") so YouTube reliably parses the query.
  const query = parts.filter(Boolean).join(" ");
  return YT_BASE + encodeURIComponent(query).replaceAll("+", "%20");
}

function enrich(ex) {
  return {
    ...ex,
    images: Array.isArray(ex.images)
      ? ex.images.map((p) => IMAGE_BASE + p)
      : ex.images,
    youtubeLink: youtubeLink(ex.name ?? "", ex.equipment ?? ""),
  };
}

const inputPath = resolve(process.cwd(), inArg);
const outputPath = resolve(process.cwd(), outArg);

const raw = await readFile(inputPath, "utf8");
const data = JSON.parse(raw);
if (!Array.isArray(data)) {
  throw new Error(`Expected ${inArg} to be a JSON array of exercises`);
}

const enriched = data.map(enrich);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(enriched, null, 2), "utf8");

console.log(
  `Enriched ${enriched.length} exercises → ${outputPath}`,
);
