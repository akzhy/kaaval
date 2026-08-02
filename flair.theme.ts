import { defineConfig } from "@flairjs/client";

const theme = defineConfig({
  prefix: "kaaval",
  selector: "body",
  tokens: {
    colors: {
      primary: "#0078d4",
      surface: "#131313",
      "surface-dim": "#131313",
      "surface-bright": "#1a1a1a",
      positive: "#79dd68",
      negative: "#d93a3d",
      border: "#2f2f2f",
      text: "#f2f2f2",
      "text-muted": "#9a9a9a",
    },
    fonts: {
      family: "'Segoe UI', 'Segoe UI Variable', system-ui, sans-serif",
    },
    radii: {
      card: "4px",
    },
  },
});

export default theme;
export type Theme = typeof theme;
