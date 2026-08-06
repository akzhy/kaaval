import type { ImportedMode } from "./modesTransfer";

export type CatalogEntry = {
  title: string;
  path: string;
  description: string;
};

export type RemotePack = {
  entry: CatalogEntry;
  modes: ImportedMode[];
};

type IndexManifest = {
  modes?: unknown;
};

export function normalizeCatalogPath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^resources\/modes\//i, "");
}

function titleFromPath(path: string): string {
  const fileName = normalizeCatalogPath(path).split("/").pop() ?? path;
  return fileName
    .replace(/\.json$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeIndexManifest(raw: unknown): CatalogEntry[] {
  if (typeof raw !== "object" || raw === null) {
    return [];
  }

  const manifest = raw as IndexManifest;
  if (!Array.isArray(manifest.modes)) {
    return [];
  }

  const entries: CatalogEntry[] = [];

  for (const item of manifest.modes) {
    if (typeof item !== "object" || item === null) {
      continue;
    }

    const mode = item as {
      title?: unknown;
      path?: unknown;
      description?: unknown;
    };

    if (typeof mode.path !== "string" || !mode.path.trim()) {
      continue;
    }

    const path = normalizeCatalogPath(mode.path.trim());
    entries.push({
      title:
        typeof mode.title === "string" && mode.title.trim()
          ? mode.title.trim()
          : titleFromPath(path),
      path,
      description:
        typeof mode.description === "string" ? mode.description.trim() : "",
    });
  }

  return entries;
}