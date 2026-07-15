import { AppPaths, ensureAppDirs } from "./paths.ts";

export interface LockInfo {
  version: 1;
  pid: number;
  startedAt: string;
}

export interface PidChecker {
  isAlive(pid: number): boolean | Promise<boolean>;
}

export const denoPidChecker: PidChecker = {
  async isAlive(pid: number): Promise<boolean> {
    const result = await new Deno.Command("/bin/kill", {
      args: ["-0", String(pid)],
      stdout: "null",
      stderr: "null",
    }).output();
    return result.code === 0;
  },
};

export async function readLock(path: string): Promise<LockInfo | undefined> {
  try {
    const value = JSON.parse(await Deno.readTextFile(path)) as LockInfo;
    if (value.version !== 1 || typeof value.pid !== "number") return undefined;
    return value;
  } catch {
    return undefined;
  }
}

export async function acquireLock(
  paths: AppPaths,
  checker: PidChecker = denoPidChecker,
): Promise<LockInfo> {
  await ensureAppDirs(paths);
  const existing = await readLock(paths.lockPath);
  if (existing && await checker.isAlive(existing.pid)) {
    throw new Error(`Another moonlight-awdl session is active (PID ${existing.pid})`);
  }
  const info: LockInfo = { version: 1, pid: Deno.pid, startedAt: new Date().toISOString() };
  await Deno.writeTextFile(paths.lockPath, `${JSON.stringify(info, null, 2)}\n`, {
    create: true,
    mode: 0o600,
  });
  return info;
}

export async function releaseLock(paths: AppPaths, ownerPid = Deno.pid): Promise<void> {
  const existing = await readLock(paths.lockPath);
  if (existing && existing.pid !== ownerPid) return;
  await Deno.remove(paths.lockPath).catch((error) => {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  });
}
