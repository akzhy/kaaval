import { useMemo, useState } from "react";
import { css } from "@flairjs/client";
import { useModesStore } from "@/store/modesStore";
import type { AppMatcher, Mode, ModeType } from "@/utils/types";
import { X } from "lucide-react";

type ModeFormProps = {
  initialMode?: Mode | null;
  onClose: () => void;
};

const MODE_TYPE_OPTIONS: { value: ModeType; title: string; hint: string }[] = [
  {
    value: "block_all_except",
    title: "Block all except",
    hint: "Blocks every application, only the list below is allowed.",
  },
  {
    value: "block_these",
    title: "Block these",
    hint: "Allows every application, only the list below is blocked.",
  },
];

function matcherLabel(matcher: AppMatcher): string {
  if (matcher.kind === "path") {
    const parts = matcher.value.split(/[\\/]/);
    return parts[parts.length - 1] || matcher.value;
  }
  return matcher.value;
}

function matcherKey(matcher: AppMatcher): string {
  return `${matcher.kind}:${matcher.value.toLowerCase()}`;
}

function ModeForm({ initialMode, onClose }: ModeFormProps) {
  const knownApps = useModesStore((state) => state.knownApps);
  const createModeAction = useModesStore((state) => state.createMode);
  const updateModeAction = useModesStore((state) => state.updateMode);
  const pickIcon = useModesStore((state) => state.pickIcon);
  const pickExecutable = useModesStore((state) => state.pickExecutable);

  const [name, setName] = useState(initialMode?.name ?? "");
  const [iconDataUrl, setIconDataUrl] = useState<string | null>(
    initialMode?.icon_data_url ?? null,
  );
  const [modeType, setModeType] = useState<ModeType>(
    initialMode?.mode_type ?? "block_these",
  );
  const [matchers, setMatchers] = useState<AppMatcher[]>(
    initialMode?.matchers ?? [],
  );
  const [manualValue, setManualValue] = useState("");
  const [manualKind, setManualKind] = useState<"name" | "directory">("name");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const matcherKeys = useMemo(
    () => new Set(matchers.map(matcherKey)),
    [matchers],
  );

  function addMatcher(matcher: AppMatcher) {
    const key = matcherKey(matcher);
    if (matcherKeys.has(key)) {
      return;
    }
    setMatchers((prev) => [...prev, matcher]);
  }

  function removeMatcher(target: AppMatcher) {
    const key = matcherKey(target);
    setMatchers((prev) => prev.filter((m) => matcherKey(m) !== key));
  }

  function toggleKnownApp(path: string) {
    const matcher: AppMatcher = { kind: "path", value: path };
    if (matcherKeys.has(matcherKey(matcher))) {
      removeMatcher(matcher);
    } else {
      addMatcher(matcher);
    }
  }

  async function handleChooseIcon() {
    const picked = await pickIcon();
    if (picked) {
      setIconDataUrl(picked);
    }
  }

  async function handleBrowseExecutable() {
    const picked = await pickExecutable();
    if (picked) {
      addMatcher({ kind: "path", value: picked });
    }
  }

  function handleAddManual() {
    const value = manualValue.trim();
    if (!value) {
      return;
    }
    addMatcher({ kind: manualKind, value });
    setManualValue("");
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Give this mode a name.");
      return;
    }
    if (matchers.length === 0) {
      setError("Add at least one application, directory, or name.");
      return;
    }

    setSaving(true);
    setError("");
    const input = { name: name.trim(), iconDataUrl, modeType, matchers };
    const result = initialMode
      ? await updateModeAction(initialMode.id, input)
      : await createModeAction(input);
    setSaving(false);

    if (result) {
      onClose();
    } else {
      setError("Failed to save mode.");
    }
  }

  return (
    <div className="mode-form">
      {error ? <div className="mode-form-error">{error}</div> : null}

      <div className="mode-form-row">
        <label className="mode-form-label" htmlFor="mode-name">
          Title
        </label>
        <input
          id="mode-name"
          className="mode-form-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Gaming Mode"
        />
      </div>

      <div className="mode-form-row">
        <span className="mode-form-label">Icon</span>
        <div className="mode-form-icon-row">
          <div className="mode-form-icon-preview">
            {iconDataUrl ? (
              <img src={iconDataUrl} alt="" className="mode-form-icon-img" />
            ) : (
              <span className="mode-form-icon-placeholder">
                {name.trim().charAt(0).toUpperCase() || "?"}
              </span>
            )}
          </div>
          <button
            type="button"
            className="mode-form-btn-secondary"
            onClick={() => void handleChooseIcon()}
          >
            Choose Icon
          </button>
          {iconDataUrl ? (
            <button
              type="button"
              className="mode-form-btn-secondary"
              onClick={() => setIconDataUrl(null)}
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>

      <div className="mode-form-row">
        <span className="mode-form-label">Mode Type</span>
        <div className="mode-type-options">
          {MODE_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={
                option.value === modeType
                  ? "mode-type-option mode-type-option-active"
                  : "mode-type-option"
              }
              onClick={() => setModeType(option.value)}
            >
              <p className="mode-type-title">{option.title}</p>
              <p className="mode-type-hint">{option.hint}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="mode-form-row">
        <span className="mode-form-label">
          {modeType === "block_all_except"
            ? "Allowed applications"
            : "Blocked applications"}
        </span>

        <div className="mode-picker">
          <p className="mode-picker-subtitle">From recent usage</p>
          <div className="mode-picker-known-list">
            {knownApps.length === 0 ? (
              <p className="mode-picker-empty">No applications observed yet.</p>
            ) : (
              knownApps.map((app) => {
                const checked = matcherKeys.has(
                  matcherKey({ kind: "path", value: app.path }),
                );
                return (
                  <label key={app.path} className="mode-picker-known-row">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleKnownApp(app.path)}
                    />
                    <span className="mode-picker-known-name">{app.name}</span>
                    <span className="mode-picker-known-path">{app.path}</span>
                  </label>
                );
              })
            )}
          </div>

          <p className="mode-picker-subtitle">Add manually</p>
          <div className="mode-picker-manual">
            <button
              type="button"
              className="mode-form-btn-secondary"
              onClick={() => void handleBrowseExecutable()}
            >
              Browse for executable…
            </button>
          </div>
          <div className="mode-picker-manual">
            <select
              className="mode-form-select"
              value={manualKind}
              onChange={(e) =>
                setManualKind(e.target.value as "name" | "directory")
              }
            >
              <option value="name">App name</option>
              <option value="directory">Directory path</option>
            </select>
            <input
              className="mode-form-input"
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder={
                manualKind === "name"
                  ? "e.g. chrome.exe"
                  : "e.g. C:\\Program Files\\Game"
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddManual();
                }
              }}
            />
            <button
              type="button"
              className="mode-form-btn-secondary"
              onClick={handleAddManual}
            >
              Add
            </button>
          </div>

          <p className="mode-picker-subtitle">Selected ({matchers.length})</p>
          <div className="mode-picker-chips">
            {matchers.length === 0 ? (
              <p className="mode-picker-empty">Nothing selected yet.</p>
            ) : (
              matchers.map((matcher) => (
                <span key={matcherKey(matcher)} className="mode-chip-selected">
                  <span className="mode-chip-kind">{matcher.kind}</span>
                  {matcherLabel(matcher)}
                  <button
                    type="button"
                    className="mode-chip-remove"
                    onClick={() => removeMatcher(matcher)}
                    aria-label="Remove"
                  >
                    <X />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mode-form-footer">
        <button
          type="button"
          className="mode-form-btn-secondary"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="mode-form-btn-primary"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? "Saving…" : "Save Mode"}
        </button>
      </div>
    </div>
  );
}

ModeForm.flair = css`
  .mode-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .mode-form-error {
    border: 1px solid $colors.negative;
    background-color: color-mix(in srgb, $colors.negative 12%, transparent);
    color: $colors.negative;
    border-radius: $radii.card;
    padding: 8px 12px;
    font-size: 0.82rem;
  }

  .mode-form-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .mode-form-label {
    font-size: 0.78rem;
    font-weight: 600;
    color: $colors.text-muted;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .mode-form-input,
  .mode-form-select {
    background-color: $colors.surface;
    border: 1px solid $colors.border;
    border-radius: $radii.card;
    padding: 8px 10px;
    color: $colors.text;
    font-size: 0.85rem;
  }

  .mode-form-input:focus,
  .mode-form-select:focus {
    outline: 1px solid $colors.primary;
  }

  .mode-form-icon-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .mode-form-icon-preview {
    width: 44px;
    height: 44px;
    border-radius: $radii.card;
    background-color: $colors.surface;
    border: 1px solid $colors.border;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }

  .mode-form-icon-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .mode-form-icon-placeholder {
    color: $colors.text-muted;
    font-weight: 700;
  }

  .mode-form-btn-secondary {
    background-color: $colors.surface;
    border: 1px solid $colors.border;
    border-radius: $radii.card;
    padding: 7px 12px;
    color: $colors.text;
    font-size: 0.8rem;
    cursor: pointer;
  }

  .mode-form-btn-secondary:hover {
    border-color: $colors.primary;
  }

  .mode-form-btn-primary {
    background-color: $colors.primary;
    border: none;
    border-radius: $radii.card;
    padding: 8px 16px;
    color: white;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
  }

  .mode-form-btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .mode-type-options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .mode-type-option {
    text-align: left;
    background-color: $colors.surface;
    border: 1px solid $colors.border;
    border-radius: $radii.card;
    padding: 10px 12px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .mode-type-option-active {
    border-color: $colors.primary;
    background-color: color-mix(in srgb, $colors.primary 14%, $colors.surface);
  }

  .mode-type-title {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
    color: $colors.text;
  }

  .mode-type-hint {
    margin: 0;
    font-size: 0.74rem;
    color: $colors.text-muted;
  }

  .mode-picker {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background-color: $colors.surface;
    border: 1px solid $colors.border;
    border-radius: $radii.card;
    padding: 12px;
  }

  .mode-picker-subtitle {
    margin: 6px 0 0;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: $colors.text-muted;
  }

  .mode-picker-known-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 140px;
    overflow-y: auto;
  }

  .mode-picker-known-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
    color: $colors.text;
    padding: 4px 2px;
  }

  .mode-picker-known-path {
    color: $colors.text-muted;
    font-size: 0.72rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mode-picker-manual {
    display: flex;
    gap: 8px;
  }

  .mode-picker-manual .mode-form-input {
    flex: 1;
  }

  .mode-picker-empty {
    margin: 0;
    font-size: 0.78rem;
    color: $colors.text-muted;
  }

  .mode-picker-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .mode-chip-selected {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background-color: $colors.surface-bright;
    border: 1px solid $colors.border;
    border-radius: $radii.card;
    padding: 4px 8px;
    font-size: 0.76rem;
    color: $colors.text;
  }

  .mode-chip-kind {
    text-transform: uppercase;
    font-size: 0.62rem;
    color: $colors.primary;
    font-weight: 700;
  }

  .mode-chip-remove {
    background: none;
    border: none;
    color: $colors.text-muted;
    cursor: pointer;
    font-size: 0.9rem;
    line-height: 1;
    padding: 0;
  }

  .mode-chip-remove:hover {
    color: $colors.negative;
  }

  .mode-form-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 4px;
  }
`;

export default ModeForm;
