import { getAwdlState, verifyPasswordlessAwdlPreservingState } from "./awdl.ts";
import { Config } from "./config.ts";
import { findMoonlightProcesses, validateMoonlightPath } from "./moonlight.ts";
import { AppPaths } from "./paths.ts";
import { CommandRunner, pathExists } from "./process.ts";
import { canOverwriteSudoers, SUDOERS_PATH, validateSudoersFile } from "./sudoers.ts";
import { readLock } from "./lock.ts";

export interface CheckResult {
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

export async function runDoctor(
  paths: AppPaths,
  config: Config,
  runner: CommandRunner,
): Promise<CheckResult[]> {
  const checks: CheckResult[] = [];
  const add = (name: string, status: CheckResult["status"], detail: string) =>
    checks.push({ name, status, detail });

  add("macOS", Deno.build.os === "darwin" ? "pass" : "fail", Deno.build.os);
  add("CPU architecture", "pass", Deno.build.arch);
  add("Deno runtime", "pass", Deno.version.deno);
  add("/sbin/ifconfig", await pathExists("/sbin/ifconfig") ? "pass" : "fail", "/sbin/ifconfig");
  add("/usr/bin/sudo", await pathExists("/usr/bin/sudo") ? "pass" : "fail", "/usr/bin/sudo");
  add(
    "/usr/sbin/visudo",
    await pathExists("/usr/sbin/visudo") ? "pass" : "fail",
    "/usr/sbin/visudo",
  );

  const awdl = await getAwdlState(runner);
  add("awdl0", awdl === "missing" ? "fail" : "pass", awdl);
  add(
    "Moonlight path",
    await validateMoonlightPath(config.moonlightPath) ? "pass" : "fail",
    config.moonlightPath,
  );
  add(
    "Moonlight process",
    (await findMoonlightProcesses(runner)).length > 0 ? "pass" : "warn",
    "running check",
  );
  add("configuration", await pathExists(paths.configPath) ? "pass" : "warn", paths.configPath);
  try {
    add(
      "sudoers ownership marker",
      await canOverwriteSudoers(SUDOERS_PATH) ? "pass" : "fail",
      SUDOERS_PATH,
    );
  } catch (error) {
    add("sudoers ownership marker", "warn", sudoersReadErrorDetail(error));
  }
  try {
    await validateSudoersFile(SUDOERS_PATH, runner);
    add("sudoers syntax", "pass", SUDOERS_PATH);
  } catch (error) {
    add("sudoers syntax", "warn", error instanceof Error ? error.message : String(error));
  }
  const sudo = await verifyPasswordlessAwdlPreservingState(runner);
  add("sudo -n awdl0 down", sudo.down ? "pass" : "fail", sudo.down ? "ok" : "failed");
  add("sudo -n awdl0 up", sudo.up ? "pass" : "fail", sudo.up ? "ok" : "failed");
  const lock = await readLock(paths.lockPath);
  add("session lock", lock ? "warn" : "pass", lock ? `PID ${lock.pid}` : "none");
  add("watchdog", config.watchdogEnabled ? "pass" : "warn", `${config.watchdogIntervalMs} ms`);
  return checks;
}

function sudoersReadErrorDetail(error: unknown): string {
  if (error instanceof Deno.errors.PermissionDenied) {
    return `${SUDOERS_PATH} is not readable by this user; run setup/status checks without sudo where possible, or run doctor with sudo for file marker inspection.`;
  }
  return error instanceof Error ? error.message : String(error);
}

export function printDoctor(checks: CheckResult[], json = false): void {
  if (json) {
    console.log(JSON.stringify({ checks }, null, 2));
    return;
  }
  for (const check of checks) {
    const mark = check.status === "pass" ? "PASS" : check.status === "warn" ? "WARN" : "FAIL";
    console.log(`${mark} ${check.name}: ${check.detail}`);
  }
}
