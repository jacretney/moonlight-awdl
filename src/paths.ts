export const APP_ID = "moonlight-awdl";

export interface AppPaths {
  home: string;
  supportDir: string;
  logsDir: string;
  configPath: string;
  statePath: string;
  lockPath: string;
  logPath: string;
}

export function getAppPaths(home = Deno.env.get("HOME")): AppPaths {
  if (!home) throw new Error("HOME is not set");
  const supportDir = `${home}/Library/Application Support/${APP_ID}`;
  const logsDir = `${home}/Library/Logs/${APP_ID}`;
  return {
    home,
    supportDir,
    logsDir,
    configPath: `${supportDir}/config.json`,
    statePath: `${supportDir}/session-state.json`,
    lockPath: `${supportDir}/session.lock`,
    logPath: `${logsDir}/${APP_ID}.log`,
  };
}

export async function ensureAppDirs(paths: AppPaths): Promise<void> {
  await Deno.mkdir(paths.supportDir, { recursive: true, mode: 0o700 });
  await Deno.mkdir(paths.logsDir, { recursive: true, mode: 0o700 });
}
