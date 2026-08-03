import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useSearch } from "@tanstack/react-router";
import { css } from "@flairjs/client";
import { open } from "@tauri-apps/plugin-dialog";
import Card from "@/components/Card";
import Modal from "@/components/Modal";
import { useModesStore } from "@/store/modesStore";
import { exportModesFile } from "@/utils/api";
import type { Mode } from "@/utils/types";
import ModeForm from "../components/ModeForm";
import {
  buildImportedName,
  createExportPayload,
  modeTypeLabel,
  validateImportedModes,
  type ImportedMode,
  type ImportDecision,
} from "../utils/modesTransfer";

type ModesPageSearch = {
  modeId?: string;
};

function ModesPage() {
  const search = useSearch({ strict: false }) as ModesPageSearch | undefined;
  const modes = useModesStore((state) => state.modes);
  const error = useModesStore((state) => state.error);
  const refresh = useModesStore((state) => state.refresh);
  const deleteModeAction = useModesStore((state) => state.deleteMode);
  const setActive = useModesStore((state) => state.setActive);
  const createModeAction = useModesStore((state) => state.createMode);
  const updateModeAction = useModesStore((state) => state.updateMode);

  const [editingMode, setEditingMode] = useState<Mode | null | undefined>(
    undefined,
  );
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState("");
  const [exportSelectionOpen, setExportSelectionOpen] = useState(false);
  const [selectedForExport, setSelectedForExport] = useState<Record<string, boolean>>({});
  const [pendingConflict, setPendingConflict] = useState<{
    modeName: string;
    existingName: string;
    resolve: (decision: ImportDecision) => void;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const modeId = typeof search?.modeId === "string" ? search.modeId : null;
    if (modeId) {
      const matchingMode = modes.find((mode) => mode.id === modeId);
      if (matchingMode) {
        setEditingMode(matchingMode);
      }
    }
  }, [modes, search]);

  function openCreate() {
    refresh();
    setEditingMode(null);
  }

  function openExportPicker() {
    const nextSelection = Object.fromEntries(
      modes.map((mode) => [mode.id, true]),
    ) as Record<string, boolean>;
    setSelectedForExport(nextSelection);
    setExportSelectionOpen(true);
    setNotice("");
  }

  function toggleExportSelection(id: string) {
    setSelectedForExport((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleAllExportSelection(selectAll: boolean) {
    setSelectedForExport(
      Object.fromEntries(modes.map((mode) => [mode.id, selectAll])),
    );
  }

  async function handleExportSelected() {
    const selectedModes = modes.filter((mode) => selectedForExport[mode.id]);
    if (selectedModes.length === 0) {
      setNotice("Select at least one mode to export.");
      return;
    }

    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: "Choose export folder",
      });

      const resolvedPath =
        typeof selectedPath === "string"
          ? selectedPath
          : Array.isArray(selectedPath)
            ? selectedPath[0]
            : null;

      if (!resolvedPath) {
        setNotice("Export cancelled.");
        return;
      }

      const payload = createExportPayload(selectedModes);
      const dateToken = new Date().toISOString().slice(0, 10);
      const fileName = `kaaval-modes-${dateToken}.json`;
      const destination = `${resolvedPath.replace(/\\/g, "/")}/${fileName}`;
      const content = JSON.stringify(payload, null, 2);
      await exportModesFile(content, destination);

      setNotice(`Exported ${selectedModes.length} mode(s) to ${destination}.`);
      setExportSelectionOpen(false);
    } catch (error) {
      setNotice(
        error instanceof Error ? `Export failed: ${error.message}` : "Export failed.",
      );
    }
  }

  function openImportPicker() {
    fileInputRef.current?.click();
  }

  function requestConflictDecision(
    modeName: string,
    existingName: string,
  ): Promise<ImportDecision> {
    return new Promise((resolve) => {
      setPendingConflict({ modeName, existingName, resolve });
    });
  }

  function resolveConflict(decision: ImportDecision) {
    if (pendingConflict) {
      const { resolve } = pendingConflict;
      setPendingConflict(null);
      resolve(decision);
    }
  }

  async function handleImportFile(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setImporting(true);
    setNotice("");

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as unknown;
      const importedModes = validateImportedModes(parsed);

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
      let activated = 0;

      for (const step of plan) {
        const input = {
          name: step.importedMode.name,
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
            throw new Error(`Failed replacing mode '${step.importedMode.name}'.`);
          }
          replaced += 1;

          if (step.importedMode.active !== undefined) {
            await setActive(step.targetId, step.importedMode.active);
            activated += 1;
          }
          continue;
        }

        const createdMode = await createModeAction(input);
        if (!createdMode) {
          throw new Error(`Failed creating mode '${step.importedMode.name}'.`);
        }
        created += 1;

        if (step.importedMode.active) {
          await setActive(createdMode.id, true);
          activated += 1;
        }
      }

      await refresh();
      setNotice(
        `Import complete: ${created} created, ${replaced} replaced, ${skipped} skipped${activated > 0 ? `, ${activated} active state updates` : ""}.`,
      );
    } catch (e) {
      setNotice(e instanceof Error ? `Import failed: ${e.message}` : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="modes-page">
      <div className="modes-page-head">
        <div>
          <p className="modes-page-title">Modes</p>
          <p className="modes-page-subtitle">
            Group applications into switchable allow/block profiles.
          </p>
        </div>
        <div className="modes-page-head-actions">
          <button
            type="button"
            className="modes-page-head-btn"
            onClick={openExportPicker}
          >
            Export
          </button>
          <button
            type="button"
            className="modes-page-head-btn"
            onClick={openImportPicker}
            disabled={importing}
          >
            {importing ? "Importing..." : "Import JSON"}
          </button>
          <button
            type="button"
            className="modes-page-create"
            onClick={openCreate}
          >
            + Create New Mode
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="modes-page-file-input"
            onChange={(event) => void handleImportFile(event)}
          />
        </div>
      </div>

      {error ? <div className="modes-page-error">{error}</div> : null}
      {notice ? <div className="modes-page-notice">{notice}</div> : null}

      {exportSelectionOpen ? (
        <Modal title="Export modes" onClose={() => setExportSelectionOpen(false)}>
          <div className="mode-export-picker">
            <p className="mode-export-picker-title">
              Choose which modes to include in the export.
            </p>
            <label className="mode-export-select-all">
              <input
                type="checkbox"
                checked={modes.every((mode) => selectedForExport[mode.id])}
                onChange={(event) =>
                  toggleAllExportSelection(event.target.checked)
                }
              />
              <span>Select all</span>
            </label>
            <div className="mode-export-list">
              {modes.map((mode) => (
                <label key={mode.id} className="mode-export-row">
                  <input
                    type="checkbox"
                    checked={selectedForExport[mode.id] ?? false}
                    onChange={() => toggleExportSelection(mode.id)}
                  />
                  <span className="mode-export-row-name">{mode.name}</span>
                </label>
              ))}
            </div>
            <div className="mode-export-actions">
              <button
                type="button"
                className="mode-export-btn"
                onClick={() => setExportSelectionOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="mode-export-btn mode-export-btn-primary"
                onClick={handleExportSelected}
              >
                Export selected
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {pendingConflict ? (
        <Modal
          title="Import conflict"
          onClose={() => resolveConflict("cancel")}
        >
          <div className="mode-import-conflict">
            <p className="mode-import-conflict-title">
              {pendingConflict.modeName} already exists as {pendingConflict.existingName}.
            </p>
            <p className="mode-import-conflict-hint">
              Choose how to handle this imported mode.
            </p>
            <div className="mode-import-conflict-actions">
              <button
                type="button"
                className="mode-import-conflict-btn mode-import-conflict-btn-primary"
                onClick={() => resolveConflict("replace")}
              >
                Replace existing
              </button>
              <button
                type="button"
                className="mode-import-conflict-btn"
                onClick={() => resolveConflict("copy")}
              >
                Import as copy
              </button>
              <button
                type="button"
                className="mode-import-conflict-btn"
                onClick={() => resolveConflict("skip")}
              >
                Skip this mode
              </button>
              <button
                type="button"
                className="mode-import-conflict-btn mode-import-conflict-btn-secondary"
                onClick={() => resolveConflict("cancel")}
              >
                Cancel import
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      <div className="modes-page-grid">
        {modes.map((mode) => (
          <Card key={mode.id}>
            <div className="mode-card">
              <div className="mode-card-head">
                <div className="mode-card-heading">
                  {mode.icon_data_url ? (
                    <img
                      src={mode.icon_data_url}
                      alt=""
                      className="mode-card-icon"
                    />
                  ) : (
                    <span className="mode-card-icon mode-card-icon-fallback">
                      {mode.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <p className="mode-card-name">{mode.name}</p>
                </div>
                <span
                  className={
                    mode.active
                      ? "mode-status mode-status-active"
                      : "mode-status"
                  }
                >
                  <span
                    className={mode.active ? "mode-active-dot" : "mode-active-dot mode-active-dot-inactive"}
                    aria-label={mode.active ? "Active mode" : "Inactive mode"}
                  />
                  {mode.active ? "Active" : "Inactive"}
                </span>
              </div>

              <p className="mode-card-label">{modeTypeLabel(mode)}</p>
              <div className="mode-card-chips">
                {mode.matchers.slice(0, 6).map((matcher) => (
                  <span
                    key={`${matcher.kind}:${matcher.value}`}
                    className="mode-chip"
                  >
                    {matcher.value}
                  </span>
                ))}
                {mode.matchers.length > 6 ? (
                  <span className="mode-chip">
                    +{mode.matchers.length - 6} more
                  </span>
                ) : null}
              </div>

              <div className="mode-card-actions">
                <button
                  type="button"
                  className={
                    mode.active
                      ? "mode-action-btn mode-action-btn-danger"
                      : "mode-action-btn mode-action-btn-primary"
                  }
                  onClick={() => void setActive(mode.id, !mode.active)}
                >
                  {mode.active ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  className="mode-action-btn"
                  onClick={() => setEditingMode(mode)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="mode-action-btn"
                  onClick={() => void deleteModeAction(mode.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          </Card>
        ))}

        <Card dashed>
          <button type="button" className="mode-create" onClick={openCreate}>
            <span className="mode-create-icon">+</span>
            <p className="mode-create-title">Create New Mode</p>
            <p className="mode-create-hint">
              Define custom rules for apps and protocols
            </p>
          </button>
        </Card>
      </div>

      {editingMode !== undefined ? (
        <Modal
          title={editingMode ? "Edit Mode" : "Create New Mode"}
          onClose={() => setEditingMode(undefined)}
        >
          <ModeForm
            initialMode={editingMode}
            onClose={() => setEditingMode(undefined)}
          />
        </Modal>
      ) : null}
    </div>
  );
}

ModesPage.flair = css`
  .modes-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .modes-page-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .modes-page-head-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .modes-page-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: $colors.text;
  }

  .modes-page-subtitle {
    margin: 4px 0 0;
    font-size: 0.82rem;
    color: $colors.text-muted;
  }

  .modes-page-create {
    background-color: $colors.primary;
    border: none;
    border-radius: $radii.card;
    padding: 8px 14px;
    color: white;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .modes-page-head-btn {
    background-color: $colors.surface;
    border: 1px solid $colors.border;
    border-radius: $radii.card;
    padding: 8px 12px;
    color: $colors.text;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .modes-page-head-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .modes-page-file-input {
    display: none;
  }

  .modes-page-error {
    border: 1px solid $colors.negative;
    background-color: color-mix(in srgb, $colors.negative 12%, transparent);
    color: $colors.negative;
    border-radius: $radii.card;
    padding: 10px 14px;
    font-size: 0.85rem;
  }

  .modes-page-notice {
    border: 1px solid $colors.border;
    background-color: color-mix(in srgb, $colors.primary 10%, transparent);
    color: $colors.text;
    border-radius: $radii.card;
    padding: 10px 14px;
    font-size: 0.85rem;
  }

  .mode-export-picker {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .mode-export-picker-title {
    margin: 0;
    font-weight: 600;
    color: $colors.text;
  }

  .mode-export-select-all {
    display: flex;
    align-items: center;
    gap: 8px;
    color: $colors.text;
    font-size: 0.85rem;
  }

  .mode-export-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 280px;
    overflow-y: auto;
    padding-right: 4px;
  }

  .mode-export-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border: 1px solid $colors.border;
    border-radius: $radii.card;
    color: $colors.text;
  }

  .mode-export-row-name {
    font-size: 0.84rem;
  }

  .mode-export-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .mode-export-btn {
    border: 1px solid $colors.border;
    background-color: $colors.surface;
    border-radius: $radii.card;
    padding: 8px 12px;
    color: $colors.text;
    font-size: 0.82rem;
    cursor: pointer;
  }

  .mode-export-btn-primary {
    background-color: $colors.primary;
    border-color: $colors.primary;
    color: white;
  }

  .modes-page-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 14px;
  }

  .mode-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
  }

  .mode-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .mode-card-heading {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .mode-card-icon {
    width: 26px;
    height: 26px;
    border-radius: $radii.card;
    object-fit: cover;
    flex-shrink: 0;
  }

  .mode-card-icon-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: $colors.surface;
    border: 1px solid $colors.border;
    color: $colors.text-muted;
    font-weight: 700;
    font-size: 0.8rem;
  }

  .mode-active-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background-color: #2ecc71;
    box-shadow: 0 0 0 2px color-mix(in srgb, #2ecc71 20%, transparent);
    flex-shrink: 0;
  }

  .mode-active-dot-inactive {
    background-color: $colors.text-muted;
    box-shadow: none;
  }

  .mode-card-name {
    margin: 0;
    font-weight: 600;
    color: $colors.text;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mode-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: $colors.text-muted;
    white-space: nowrap;
  }

  .mode-status-active {
    color: $colors.primary;
    font-weight: 700;
  }

  .mode-card-label {
    margin: 0;
    font-size: 0.75rem;
    color: $colors.text-muted;
  }

  .mode-card-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .mode-chip {
    font-size: 0.72rem;
    background-color: $colors.surface;
    border: 1px solid $colors.border;
    border-radius: $radii.card;
    padding: 3px 8px;
    color: $colors.text;
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mode-card-actions {
    margin-top: auto;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .mode-action-btn {
    flex: 1 1 74px;
    background-color: $colors.surface;
    border: 1px solid $colors.border;
    border-radius: $radii.card;
    padding: 6px 8px;
    color: $colors.text;
    font-size: 0.76rem;
    cursor: pointer;
  }

  .mode-action-btn-primary {
    background-color: $colors.primary;
    border-color: $colors.primary;
    color: white;
    font-weight: 600;
  }

  .mode-action-btn-danger {
    background-color: transparent;
    border-color: $colors.negative;
    color: $colors.negative;
  }

  .mode-create {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 6px;
    height: 100%;
    min-height: 140px;
    width: 100%;
    color: $colors.text-muted;
    background: none;
    border: none;
    cursor: pointer;
  }

  .mode-create-icon {
    font-size: 1.4rem;
    color: $colors.primary;
  }

  .mode-create-title {
    margin: 0;
    font-weight: 600;
    color: $colors.text;
  }

  .mode-create-hint {
    margin: 0;
    font-size: 0.75rem;
  }
`;

export default ModesPage;
