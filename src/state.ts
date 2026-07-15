import { AppPaths, ensureAppDirs } from "./paths.ts";

export interface SessionState {
  version: 1;
  launcherPid: number;
  moonlightPid?: number;
  startedAt: string;
  disabledAwdl: boolean;
  awdlStateBefore: string;
  lastOperation: string;
  lastError?: string;
}

export async function writeSessionState(paths: AppPaths, state: SessionState): Promise<void> {
  await ensureAppDirs(paths);
  await Deno.writeTextFile(paths.statePath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

export async function readSessionState(paths: AppPaths): Promise<SessionState | undefined> {
  try {
    const value = JSON.parse(await Deno.readTextFile(paths.statePath)) as SessionState;
    if (value.version !== 1) return undefined;
    return value;
  } catch {
    return undefined;
  }
}

export async function clearSessionState(paths: AppPaths): Promise<void> {
  await Deno.remove(paths.statePath).catch((error) => {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  });
}
