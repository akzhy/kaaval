import { useEffect } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { css } from "@flairjs/client";
import Card from "@/components/Card";
import ModeCard from "@/features/modes/components/ModeCard";
import { useModesStore } from "@/store/modesStore";

function ModesPreview() {
  const modes = useModesStore((state) => state.modes);
  const refresh = useModesStore((state) => state.refresh);
  const setActive = useModesStore((state) => state.setActive);
  const router = useRouter();

  useEffect(() => {
    refresh();
  }, [refresh]);

  const preview = modes.slice(0, 2);

  return (
    <section className="modes-preview">
      <div className="modes-preview-head">
        <div>
          <p className="modes-preview-title">Active Modes</p>
        </div>
        <Link to="/modes" className="modes-preview-link">
          View All Modes ›
        </Link>
      </div>
      {preview.length === 0 && (
        <p className="modes-preview-empty">
          No modes yet. Create one by clicking the "Create New Mode" button below.
        </p>
      )}
      <div className="modes-preview-grid">
        {preview.map((mode) => (
          <ModeCard
            key={mode.id}
            mode={mode}
            showIcon={false}
            matcherLimit={4}
            onToggleActive={(checked) => setActive(mode.id, checked)}
            onEdit={() => {
              router.navigate({
                to: "/modes",
                search: { modeId: mode.id },
              });
            }}
          />
        ))}

        <Card dashed>
          <Link to="/modes" className="mode-create">
            <span className="mode-create-icon">+</span>
            <p className="mode-create-title">Create New Mode</p>
            <p className="mode-create-hint">
              Define custom rules for apps and protocols
            </p>
          </Link>
        </Card>
      </div>
    </section>
  );
}

ModesPreview.flair = css`
  .modes-preview {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .modes-preview-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .modes-preview-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: $colors.text;
  }

  .modes-preview-link {
    color: $colors.primary;
    font-size: 0.82rem;
    text-decoration: none;
  }

  .modes-preview-empty {
    margin: 0;
    font-size: 0.82rem;
    color: $colors.text-muted;
  }

  .modes-preview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }

  .mode-create {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 6px;
    height: 100%;
    min-height: 120px;
    color: $colors.text-muted;
    text-decoration: none;
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

export default ModesPreview;
