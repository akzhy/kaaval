import { defineConfig } from "@flairjs/client";

const theme = defineConfig({
  prefix: "kaaval",
  selector: (content, themeName) => {
    if (!themeName) {
      return `body {${content}}`;
    }
    return `body[data-theme="${themeName}"] {${content}}`;
  },
  themes: {
    light: {
      tokens: {
        colors: {
          primary: "#0b6acb",
          surface: "#f4f7fb",
          "surface-dim": "#edf2f7",
          "surface-bright": "#ffffff",
          positive: "#1f8a4c",
          negative: "#b42318",
          border: "#d5dbe6",
          text: "#101828",
          "text-muted": "#5f6b7a",
        },
      },
    },
  },
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
