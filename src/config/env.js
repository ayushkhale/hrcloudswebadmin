// One read of import.meta.env for the whole app, so a screen never reaches
// into Vite's globals and no two files disagree about a default.
export const ENV = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api",

  /**
   * The platform plane does not exist on the backend yet — the endpoints in
   * `platform.api.js` are the shape it will take, not something you can call
   * today. While this is on, those reads resolve from `src/data/sample.js`
   * instead, so the console can be built and reviewed against realistic
   * numbers. Turn it OFF the day the first real endpoint ships, one read at a
   * time; nothing above the api layer changes when you do.
   */
  USE_SAMPLE_DATA: import.meta.env.VITE_USE_SAMPLE_DATA !== "false",
};
