import { validateImportedModes } from "../utils/modesTransfer";
import {
  normalizeCatalogPath,
  normalizeIndexManifest,
  type CatalogEntry,
  type RemotePack,
} from "../utils/communityModes";

const COMMUNITY_MODES_BASE_URL = "https://akzhy.github.io/kaaval/resources/modes";
const COMMUNITY_MODES_INDEX_URL = `${COMMUNITY_MODES_BASE_URL}/index.json`;

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`);
  }

  return response.json() as Promise<unknown>;
}

export async function loadCommunityCatalog(): Promise<CatalogEntry[]> {
  const raw = await fetchJson(COMMUNITY_MODES_INDEX_URL);
  return normalizeIndexManifest(raw).sort((left, right) =>
    left.title.localeCompare(right.title),
  );
}

function remotePackUrl(path: string): string {
  return `${COMMUNITY_MODES_BASE_URL}/${normalizeCatalogPath(path)}`;
}

export async function loadRemotePack(entry: CatalogEntry): Promise<RemotePack> {
  const raw = await fetchJson(remotePackUrl(entry.path));
  const modes = validateImportedModes(raw);
  return { entry, modes };
}