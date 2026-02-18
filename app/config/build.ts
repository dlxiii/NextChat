import tauriConfig from "../../src-tauri/tauri.conf.json";
import { DEFAULT_INPUT_TEMPLATE } from "../constant";

export const getBuildConfig = () => {
  if (typeof process === "undefined") {
    throw Error(
      "[Server Config] you are importing a nodejs-only module outside of nodejs",
    );
  }

  const buildMode = process.env.BUILD_MODE ?? "standalone";
  const isApp = !!process.env.BUILD_APP;
  const version = "v" + tauriConfig.package.version;
  const enabledByEnv = (value?: string) =>
    value === "1" || value?.toLowerCase() === "true";

  const commitInfo = (() => {
    try {
      const childProcess = require("child_process");
      const commitDate: string = childProcess
        .execSync('git log -1 --format="%at000" --date=unix')
        .toString()
        .trim();
      const commitHash: string = childProcess
        .execSync('git log --pretty=format:"%H" -n 1')
        .toString()
        .trim();

      return { commitDate, commitHash };
    } catch (e) {
      console.error("[Build Config] No git or not from git repo.");
      return {
        commitDate: "unknown",
        commitHash: "unknown",
      };
    }
  })();

  return {
    version,
    ...commitInfo,
    buildMode,
    isApp,
    template: process.env.DEFAULT_INPUT_TEMPLATE ?? DEFAULT_INPUT_TEMPLATE,
    settingsVisibility: {
      // These switches default to `false` so the related settings sections are
      // temporarily hidden unless explicitly enabled via environment variables.
      showSyncSection: enabledByEnv(process.env.ENABLE_SETTINGS_SYNC_SECTION),
      showModelSection: enabledByEnv(process.env.ENABLE_SETTINGS_MODEL_SECTION),
      showRealtimeSection: enabledByEnv(
        process.env.ENABLE_SETTINGS_REALTIME_SECTION,
      ),
      showTTSSection: enabledByEnv(process.env.ENABLE_SETTINGS_TTS_SECTION),
    },
  };
};

export type BuildConfig = ReturnType<typeof getBuildConfig>;
