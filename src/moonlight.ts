import { CommandRunner, isDirectory } from "./process.ts";

export const MOONLIGHT_BUNDLE_ID = "com.moonlight-stream.Moonlight";

export interface MoonlightProcess {
  pid: number;
  command: string;
}

export async function validateMoonlightPath(path: string): Promise<boolean> {
  return path.startsWith("/") && path.endsWith(".app") && await isDirectory(path);
}

export async function validateMoonlightBundle(
  path: string,
  runner: CommandRunner,
): Promise<boolean> {
  const result = await runner.run("/usr/bin/mdls", [
    "-name",
    "kMDItemCFBundleIdentifier",
    "-raw",
    path,
  ]);
  if (result.code !== 0) return false;
  return result.stdout.trim() === MOONLIGHT_BUNDLE_ID;
}

export async function detectMoonlight(runner: CommandRunner, home = Deno.env.get("HOME")) {
  const candidates = ["/Applications/Moonlight.app"];
  if (home) candidates.push(`${home}/Applications/Moonlight.app`);
  for (const candidate of candidates) {
    if (await validateMoonlightPath(candidate)) return candidate;
  }
  const result = await runner.run("/usr/bin/mdfind", [
    `kMDItemCFBundleIdentifier == '${MOONLIGHT_BUNDLE_ID}'`,
  ]);
  if (result.code === 0) {
    for (const line of result.stdout.split("\n").map((line) => line.trim()).filter(Boolean)) {
      if (await validateMoonlightPath(line)) return line;
    }
  }
  return undefined;
}

export async function findMoonlightProcesses(runner: CommandRunner): Promise<MoonlightProcess[]> {
  const result = await runner.run("/bin/ps", ["-axo", "pid=,comm="]);
  if (result.code !== 0) return [];
  const processes: MoonlightProcess[] = [];
  for (const line of result.stdout.split("\n")) {
    const match = line.trim().match(/^(\d+)\s+(.+)$/);
    if (!match) continue;
    const pid = Number(match[1]);
    const command = match[2];
    if (/\/Moonlight(?:\.app)?(?:\/|$)/.test(command) || command.endsWith("/Moonlight")) {
      processes.push({ pid, command });
    }
  }
  return processes;
}

export interface LaunchMoonlightOptions {
  disableMetal?: boolean;
}

export function moonlightOpenArgs(
  path: string,
  options: LaunchMoonlightOptions = {},
): string[] {
  return options.disableMetal ? ["--env", "VT_FORCE_METAL=0", path] : [path];
}

export async function launchMoonlight(
  path: string,
  runner: CommandRunner,
  options: LaunchMoonlightOptions = {},
): Promise<void> {
  const result = await runner.run("/usr/bin/open", moonlightOpenArgs(path, options));
  if (result.code !== 0) throw new Error(`Failed to launch Moonlight: ${result.stderr.trim()}`);
}

export async function waitForMoonlightPid(
  runner: CommandRunner,
  timeoutMs = 10000,
): Promise<MoonlightProcess | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const processes = await findMoonlightProcesses(runner);
    if (processes.length > 0) return processes[0];
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return undefined;
}

export async function isMoonlightRunning(runner: CommandRunner): Promise<boolean> {
  return (await findMoonlightProcesses(runner)).length > 0;
}
