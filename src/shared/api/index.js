// One import site for the api layer, so a screen writes
// `import { platformAPI } from "../shared/api"` and never reaches into a file.
export * from "./client";
export { authAPI } from "./auth.api";
export { platformAPI } from "./platform.api";
