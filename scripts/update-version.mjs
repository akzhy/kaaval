#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const packageJsonPath = path.join(projectRoot, "package.json");
const tauriConfigPath = path.join(projectRoot, "src-tauri", "tauri.conf.json");

function parseVersionArg(argv) {
  const [first, second] = argv;

  if (!first || first === "--help" || first === "-h") {
    return null;
  }

  if (first === "--version") {
    return second ?? "";
  }

  return first;
}

async function readJson(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function writeJson(filePath, json) {
  await fs.writeFile(filePath, `${JSON.stringify(json, null, 2)}\n`, "utf8");
}

async function main() {
  const version = parseVersionArg(process.argv.slice(2));

  if (!version) {
    console.log("Usage: node scripts/update-version.mjs <version>");
    console.log("   or: node scripts/update-version.mjs --version <version>");
    process.exitCode = 1;
    return;
  }

  const [packageJson, tauriConfig] = await Promise.all([
    readJson(packageJsonPath),
    readJson(tauriConfigPath),
  ]);

  packageJson.version = version;
  tauriConfig.version = version;

  await Promise.all([
    writeJson(packageJsonPath, packageJson),
    writeJson(tauriConfigPath, tauriConfig),
  ]);

  console.log(`Updated versions to v${version} in package.json and src-tauri/tauri.conf.json`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
