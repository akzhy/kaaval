import { useEffect, useMemo, useState } from "react";
import { css } from "@flairjs/client";
import { Link } from "@tanstack/react-router";
import { RefreshCw, Search } from "lucide-react";
import { useModesStore } from "@/store/modesStore";
import CommunityModesCatalogPanel from "../components/CommunityModesCatalogPanel";
import CommunityModesConflictModal from "../components/CommunityModesConflictModal";
import CommunityModesSelectedPackPanel from "../components/CommunityModesSelectedPackPanel";
import { loadCommunityCatalog, loadRemotePack } from "../api/communityModes";
import type { CatalogEntry, RemotePack } from "../utils/communityModes";
import {
  buildImportedName,
  type ImportedMode,
  type ImportDecision,
} from "../utils/modesTransfer";

function CommunityModesPage() {
  const modes = useModesStore((state) => state.modes);
  const refresh = useModesStore((state) => state.refresh);
  const createModeAction = useModesStore((state) => state.createMode);
  const updateModeAction = useModesStore((state) => state.updateMode);

  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedPack, setSelectedPack] = useState<RemotePack | null>(null);
  const [packLoading, setPackLoading] = useState(false);
  const [packError, setPackError] = useState("");
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState("");
  const [pendingConflict, setPendingConflict] = useState<{
    modeName: string;
    existingName: string;
    resolve: (decision: ImportDecision) => void;
  } | null>(null);

  async function refreshCatalog() {
    setCatalogLoading(true);
    setCatalogError("");

    try {
      const entries = await loadCommunityCatalog();
      setCatalog(entries);
      setSelectedPath((current) => {
        if (current && entries.some((entry) => entry.path === current)) {
          return current;
        }
        return null;
      });
    } catch (error) {
      setCatalog([]);
      setSelectedPath(null);
      setCatalogError(
        error instanceof Error
          ? error.message
          : "Failed to load community modes.",
      );
    } finally {
      setCatalogLoading(false);
    }
  }

  useEffect(() => {
    refreshCatalog();
  }, []);

  const filteredCatalog = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) {
      return catalog;
    }

    return catalog.filter((entry) => {
      return (
        entry.title.toLowerCase().includes(value) ||
        entry.path.toLowerCase().includes(value) ||
        entry.description.toLowerCase().includes(value)
      );
    });
  }, [catalog, search]);

  const selectedEntry = useMemo(
    () => catalog.find((entry) => entry.path === selectedPath) ?? null,
    [catalog, selectedPath],
  );

  useEffect(() => {
    if (!selectedEntry) {
      setSelectedPack(null);
      setPackError("");
      return;
    }

    let active = true;
    setPackLoading(true);
    setPackError("");

    loadRemotePack(selectedEntry)
      .then((pack) => {
        if (active) {
          setSelectedPack(pack);
        }
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setSelectedPack(null);
        setPackError(
          error instanceof Error
            ? error.message
            : "Failed to load the selected pack.",
        );
      })
      .finally(() => {
        if (active) {
          setPackLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedEntry?.path]);

  function requestConflictDecision(
    modeName: string,
    existingName: string,
  ): Promise<ImportDecision> {
    return new Promise((resolve) => {
      setPendingConflict({ modeName, existingName, resolve });
    });
  }

  function resolveConflict(decision: ImportDecision) {
    if (!pendingConflict) {
      return;
    }

    const { resolve } = pendingConflict;
    setPendingConflict(null);
    resolve(decision);
  }

  async function importPack() {
    if (!selectedPack) {
      return;
    }

    setImporting(true);
    setNotice("");

    try {
      const importedModes = selectedPack.modes;
      const existingById = new Map(modes.map((mode) => [mode.id, mode]));
      const existingByName = new Map(
        modes.map((mode) => [mode.name.trim().toLowerCase(), mode]),
      );
      const takenNames = new Set(
        modes.map((mode) => mode.name.trim().toLowerCase()),
      );

      const plan: {
        type: "create" | "replace";
        importedMode: ImportedMode;
        targetId?: string;
      }[] = [];

      let skipped = 0;

      for (const importedMode of importedModes) {
        const byId = importedMode.id
          ? existingById.get(importedMode.id)
          : undefined;
        const byName = existingByName.get(importedMode.name.toLowerCase());
        const conflict = byId ?? byName;

        if (!conflict) {
          plan.push({ type: "create", importedMode });
          takenNames.add(importedMode.name.toLowerCase());
          continue;
        }

        const decision = await requestConflictDecision(
          importedMode.name,
          conflict.name,
        );
        if (decision === "cancel") {
          setNotice("Import cancelled.");
          setImporting(false);
          return;
        }
        if (decision === "skip") {
          skipped += 1;
          continue;
        }
        if (decision === "replace") {
          plan.push({
            type: "replace",
            importedMode,
            targetId: conflict.id,
          });
          takenNames.add(importedMode.name.toLowerCase());
          continue;
        }

        const copiedName = buildImportedName(importedMode.name, takenNames);
        plan.push({
          type: "create",
          importedMode: { ...importedMode, name: copiedName },
        });
      }

      let created = 0;
      let replaced = 0;

      for (const step of plan) {
        const input = {
          name: step.importedMode.name,
          description: step.importedMode.description ?? null,
          iconDataUrl: step.importedMode.icon_data_url,
          modeType: step.importedMode.mode_type,
          matchers: step.importedMode.matchers,
        };

        if (step.type === "replace") {
          if (!step.targetId) {
            throw new Error(`Cannot replace mode '${step.importedMode.name}'.`);
          }
          const updated = await updateModeAction(step.targetId, input);
          if (!updated) {
            throw new Error(
              `Failed replacing mode '${step.importedMode.name}'.`,
            );
          }
          replaced += 1;
          continue;
        }

        const createdMode = await createModeAction(input);
        if (!createdMode) {
          throw new Error(`Failed creating mode '${step.importedMode.name}'.`);
        }
        created += 1;
      }

      await refresh();
      setNotice(
        `Import complete: ${created} created, ${replaced} replaced, ${skipped} skipped.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? `Import failed: ${error.message}`
          : "Import failed.",
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="community-modes-page">
      <div className="community-modes-head">
        <div>
          <p className="community-modes-title">Community Modes</p>
          <p className="community-modes-subtitle">
            Browse remote packs from the Kaaval repository, inspect their rules,
            and import them into your local modes.
          </p>
        </div>

        <div className="community-modes-head-actions">
          <Link to="/modes" className="community-modes-back-link">
            Back to Modes
          </Link>
          <button
            type="button"
            className="community-modes-refresh-btn"
            onClick={() => refreshCatalog()}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {catalogError ? (
        <div className="community-modes-error">{catalogError}</div>
      ) : null}
      {notice ? <div className="community-modes-notice">{notice}</div> : null}

      <div className="community-modes-toolbar">
        <label className="community-modes-search">
          <Search size={14} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search for modes"
          />
        </label>
        <div className="community-modes-summary">
          {catalogLoading
            ? "Loading catalog..."
            : `${filteredCatalog.length} pack${filteredCatalog.length === 1 ? "" : "s"}`}
        </div>
      </div>

      <div className="community-modes-layout">
        <CommunityModesCatalogPanel
          catalogLoading={catalogLoading}
          filteredCatalog={filteredCatalog}
          selectedPath={selectedEntry?.path ?? null}
          onSelectPath={setSelectedPath}
        />
      </div>

      <CommunityModesSelectedPackPanel
        selectedEntry={selectedEntry}
        selectedPack={selectedPack}
        packLoading={packLoading}
        packError={packError}
        importing={importing}
        onImport={() => importPack()}
        onClose={() => setSelectedPath(null)}
      />

      <CommunityModesConflictModal
        conflict={pendingConflict}
        onResolve={resolveConflict}
      />
    </div>
  );
}

CommunityModesPage.flair = css`
  .community-modes-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .community-modes-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .community-modes-head-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .community-modes-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: $colors.text;
  }

  .community-modes-subtitle {
    margin: 4px 0 0;
    font-size: 0.82rem;
    color: $colors.text-muted;
    max-width: 72ch;
  }

  .community-modes-back-link,
  .community-modes-refresh-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border-radius: $radii.card;
    padding: 8px 12px;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .community-modes-back-link {
    background-color: $colors.surface;
    border: 1px solid $colors.border;
    color: $colors.text;
    text-decoration: none;
  }

  .community-modes-refresh-btn,
  .community-modes-refresh-btn {
    background-color: $colors.primary;
    border: 1px solid $colors.primary;
    color: white;
  }

  .community-modes-error,
  .community-modes-notice {
    border-radius: $radii.card;
    padding: 10px 14px;
    font-size: 0.85rem;
  }

  .community-modes-error {
    border: 1px solid $colors.negative;
    background-color: color-mix(in srgb, $colors.negative 12%, transparent);
    color: $colors.negative;
  }

  .community-modes-notice {
    border: 1px solid $colors.border;
    background-color: color-mix(in srgb, $colors.primary 10%, transparent);
    color: $colors.text;
  }

  .community-modes-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .community-modes-search {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 260px;
    border: 1px solid $colors.border;
    border-radius: $radii.card;
    padding: 8px 12px;
    background-color: $colors.surface;
    color: $colors.text-muted;
  }

  .community-modes-search input {
    border: none;
    outline: none;
    background: transparent;
    color: $colors.text;
    font: inherit;
    width: 100%;
  }

  .community-modes-summary {
    color: $colors.text-muted;
    font-size: 0.82rem;
  }

  .community-modes-layout {
    display: block;
  }

  @media (max-width: 1080px) {
    .community-modes-layout {
      display: block;
    }
  }
`;

export default CommunityModesPage;
