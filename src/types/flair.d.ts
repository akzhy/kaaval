import type { Theme } from "../../flair.theme";

declare module "@flairjs/client" {
  export interface FlairTheme extends Theme {}
}
