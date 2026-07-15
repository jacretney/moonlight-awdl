import { CommandRunner } from "./process.ts";

export type AwdlState = "enabled" | "disabled" | "missing" | "unknown";

export const IFCONFIG = "/sbin/ifconfig";
export const SUDO = "/usr/bin/sudo";
export const AWDL_DOWN_ARGS = ["-n", IFCONFIG, "awdl0", "down"] as const;
export const AWDL_UP_ARGS = ["-n", IFCONFIG, "awdl0", "up"] as const;

export function parseAwdlState(stdout: string, stderr = "", exitCode = 0): AwdlState {
  const combined = `${stdout}\n${stderr}`;
  if (
    exitCode !== 0 &&
    /interface awdl0 does not exist|no such interface|does not exist/i.test(combined)
  ) {
    return "missing";
  }
  if (/^\s*status:\s*active\s*$/im.test(stdout)) return "enabled";
  if (/^\s*status:\s*inactive\s*$/im.test(stdout)) return "disabled";
  if (/^\s*flags=.*\bUP\b/im.test(stdout) && !/^\s*status:\s*inactive\s*$/im.test(stdout)) {
    return "enabled";
  }
  if (exitCode !== 0) return "missing";
  return "unknown";
}

export async function getAwdlState(runner: CommandRunner): Promise<AwdlState> {
  const result = await runner.run(IFCONFIG, ["awdl0"]);
  return parseAwdlState(result.stdout, result.stderr, result.code);
}

export async function setAwdlDown(runner: CommandRunner): Promise<void> {
  const result = await runner.run(SUDO, [...AWDL_DOWN_ARGS]);
  if (result.code !== 0) throw new Error(`Failed to disable awdl0: ${result.stderr.trim()}`);
}

export async function setAwdlUp(runner: CommandRunner): Promise<void> {
  const result = await runner.run(SUDO, [...AWDL_UP_ARGS]);
  if (result.code !== 0) throw new Error(`Failed to enable awdl0: ${result.stderr.trim()}`);
}

export async function verifyPasswordlessAwdl(runner: CommandRunner): Promise<boolean> {
  const down = await runner.run(SUDO, [...AWDL_DOWN_ARGS]);
  const up = await runner.run(SUDO, [...AWDL_UP_ARGS]);
  return down.code === 0 && up.code === 0;
}

export async function verifyPasswordlessAwdlPreservingState(
  runner: CommandRunner,
): Promise<{ down: boolean; up: boolean }> {
  const before = await getAwdlState(runner);
  const down = await runner.run(SUDO, [...AWDL_DOWN_ARGS]);
  const up = await runner.run(SUDO, [...AWDL_UP_ARGS]);
  if (before === "disabled") await runner.run(SUDO, [...AWDL_DOWN_ARGS]);
  return { down: down.code === 0, up: up.code === 0 };
}
