import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const modesDir = path.join(projectRoot, "resources", "modes");
const indexFile = path.join(modesDir, "index.json");

function titleFromFileName(fileName) {
  return fileName
    .replace(/\.json$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function readJson(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function main() {
  const entries = [];
  const dirEntries = await fs.readdir(modesDir, { withFileTypes: true });

  for (const entry of dirEntries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".json")) {
      continue;
    }

    if (entry.name.toLowerCase() === "index.json") {
      continue;
    }

    const modePath = path.join(modesDir, entry.name);
    let title = titleFromFileName(entry.name);
    let description = "";

    try {
      const raw = await readJson(modePath);
      const modes = Array.isArray(raw?.modes) ? raw.modes : [];
      const firstMode = modes.find((mode) => mode && typeof mode === "object");

      if (firstMode && typeof firstMode.title === "string" && firstMode.title.trim()) {
        title = firstMode.title.trim();
      } else if (firstMode && typeof firstMode.name === "string" && firstMode.name.trim()) {
        title = firstMode.name.trim();
      }

      if (firstMode && typeof firstMode.description === "string") {
        description = firstMode.description.trim();
      }
    } catch {
      // Keep filename-based fallback when a mode file cannot be parsed.
    }

    entries.push({
      title,
      description,
      path: entry.name,
    });
  }

  entries.sort((left, right) => left.title.localeCompare(right.title));

  const output = `${JSON.stringify({ modes: entries }, null, 2)}\n`;
  await fs.writeFile(indexFile, output, "utf8");
  console.log(`Generated ${path.relative(projectRoot, indexFile)} from ${entries.length} mode file(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});