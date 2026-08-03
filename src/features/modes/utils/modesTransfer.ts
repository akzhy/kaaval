import type { AppMatcher, Mode, ModeType } from "@/utils/types";

export type ImportedMode = {
  id?: string;
  name: string;
  icon_data_url: string | null;
  mode_type: ModeType;
  matchers: AppMatcher[];
  active?: boolean;
};

export type ModesTransferFile = {
  schema: "kaaval.modes.v1";
  exported_at: string;
  app: string;
  modes: ImportedMode[];
};

export type ImportDecision = "replace" | "copy" | "skip" | "cancel";

export function modeTypeLabel(mode: Mode): string {
  return mode.mode_type === "block_all_except"
    ? "Block all except"
    : "Block these";
}

export function createExportPayload(modes: Mode[]): ModesTransferFile {
  return {
    schema: "kaaval.modes.v1",
    exported_at: new Date().toISOString(),
    app: "kaaval",
    modes: modes.map((mode) => ({
      id: mode.id,
      name: mode.name,
      icon_data_url: mode.icon_data_url,
      mode_type: mode.mode_type,
      matchers: mode.matchers,
      active: mode.active,
    })),
  };
}

export function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function isMatcherKind(value: unknown): value is AppMatcher["kind"] {
  return value === "path" || value === "directory" || value === "name";
}

export function validateImportedModes(raw: unknown): ImportedMode[] {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Invalid JSON root. Expected an object.");
  }

  const json = raw as { schema?: unknown; modes?: unknown };
  if (json.schema !== "kaaval.modes.v1") {
    throw new Error("Invalid schema. Expected 'kaaval.modes.v1'.");
  }
  if (!Array.isArray(json.modes)) {
    throw new Error("Invalid payload. 'modes' must be an array.");
  }

  const seenNames = new Set<string>();
  const imported: ImportedMode[] = json.modes.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`Mode #${index + 1} is invalid.`);
    }
    const mode = entry as {
      id?: unknown;
      name?: unknown;
      icon_data_url?: unknown;
      mode_type?: unknown;
      matchers?: unknown;
      active?: unknown;
    };

    if (typeof mode.name !== "string" || !mode.name.trim()) {
      throw new Error(`Mode #${index + 1} has an invalid name.`);
    }
    if (mode.id !== undefined && typeof mode.id !== "string") {
      throw new Error(`Mode '${mode.name}' has an invalid id.`);
    }
    if (
      mode.icon_data_url !== null &&
      mode.icon_data_url !== undefined &&
      typeof mode.icon_data_url !== "string"
    ) {
      throw new Error(`Mode '${mode.name}' has an invalid icon_data_url.`);
    }
    if (
      mode.mode_type !== "block_all_except" &&
      mode.mode_type !== "block_these"
    ) {
      throw new Error(`Mode '${mode.name}' has an invalid mode_type.`);
    }
    if (!Array.isArray(mode.matchers) || mode.matchers.length === 0) {
      throw new Error(`Mode '${mode.name}' must include at least one matcher.`);
    }

    const matchers: AppMatcher[] = mode.matchers.map((matcher, matcherIndex) => {
      if (typeof matcher !== "object" || matcher === null) {
        throw new Error(
          `Mode '${mode.name}' matcher #${matcherIndex + 1} is invalid.`,
        );
      }
      const typedMatcher = matcher as { kind?: unknown; value?: unknown };
      if (!isMatcherKind(typedMatcher.kind)) {
        throw new Error(
          `Mode '${mode.name}' matcher #${matcherIndex + 1} has an invalid kind.`,
        );
      }
      if (typeof typedMatcher.value !== "string" || !typedMatcher.value.trim()) {
        throw new Error(
          `Mode '${mode.name}' matcher #${matcherIndex + 1} has an invalid value.`,
        );
      }
      return { kind: typedMatcher.kind, value: typedMatcher.value };
    });

    const trimmedName = mode.name.trim();
    const key = trimmedName.toLowerCase();
    if (seenNames.has(key)) {
      throw new Error(`Duplicate mode name in import: '${trimmedName}'.`);
    }
    seenNames.add(key);

    if (mode.active !== undefined && typeof mode.active !== "boolean") {
      throw new Error(`Mode '${trimmedName}' has an invalid active flag.`);
    }

    return {
      id: mode.id,
      name: trimmedName,
      icon_data_url: mode.icon_data_url ?? null,
      mode_type: mode.mode_type,
      matchers,
      active: mode.active,
    };
  });

  return imported;
}

export function sanitizeFileName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "") || "mode"
  );
}

export function buildImportedName(
  baseName: string,
  takenNames: Set<string>,
): string {
  const suffix = " (imported)";
  const initialName = `${baseName}${suffix}`;
  if (!takenNames.has(initialName.toLowerCase())) {
    takenNames.add(initialName.toLowerCase());
    return initialName;
  }

  let index = 2;
  while (true) {
    const candidate = `${baseName}${suffix} ${index}`;
    const key = candidate.toLowerCase();
    if (!takenNames.has(key)) {
      takenNames.add(key);
      return candidate;
    }
    index += 1;
  }
}
