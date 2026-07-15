import { getAwdlState, setAwdlDown, setAwdlUp } from "./awdl.ts";
import { Config } from "./config.ts";
import { Logger, logLine } from "./logger.ts";
import { findMoonlightProcesses, launchMoonlight, waitForMoonlightPid } from "./moonlight.ts";
import { AppPaths } from "./paths.ts";
import { CommandRunner } from "./process.ts";
import { acquireLock, releaseLock } from "./lock.ts";
import { clearSessionState, readSessionState, SessionState, writeSessionState } from "./state.ts";

export interface ManagedSessionOptions {
  config: Config;
  paths: AppPaths;
  runner: CommandRunner;
  logger: Logger;
  disableMetal?: boolean;
}

export interface CleanupDeps {
  disabledAwdl: boolean;
  restore: () => Promise<void>;
  stopWatchdog?: () => void;
  clearState?: () => Promise<void>;
  releaseLock?: () => Promise<void>;
}

export async function cleanupManagedSession(deps: CleanupDeps): Promise<boolean> {
  deps.stopWatchdog?.();
  let restored = false;
  if (deps.disabledAwdl) {
    await deps.restore();
    restored = true;
  }
  await deps.clearState?.();
  await deps.releaseLock?.();
  return restored;
}

export async function recoverStaleSession(
  paths: AppPaths,
  runner: CommandRunner,
  logger: Logger,
): Promise<string | undefined> {
  const stale = await readSessionState(paths);
  if (!stale) return undefined;
  const moonlightRunning = (await findMoonlightProcesses(runner)).length > 0;
  if (!moonlightRunning && stale.disabledAwdl) {
    await setAwdlUp(runner);
    await logger.event("awdl_restored", { reason: "stale_session" });
    await clearSessionState(paths);
    return "Recovered stale session and restored AWDL.";
  }
  if (!moonlightRunning) {
    await clearSessionState(paths);
    return "Removed stale session state.";
  }
  return "Previous session state found while Moonlight is still running; leaving AWDL unchanged.";
}

export async function runManagedSession(options: ManagedSessionOptions): Promise<void> {
  const { config, paths, runner, logger, disableMetal = false } = options;
  await acquireLock(paths);
  let disabledAwdl = false;
  let watchdogTimer: number | undefined;
  let shuttingDown = false;

  const stopWatchdog = () => {
    if (watchdogTimer !== undefined) clearInterval(watchdogTimer);
    watchdogTimer = undefined;
  };

  const cleanup = async (exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    await cleanupManagedSession({
      disabledAwdl,
      restore: async () => {
        logLine("Restoring AWDL...");
        await setAwdlUp(runner);
        await logger.event("awdl_restored");
      },
      stopWatchdog,
      clearState: () => clearSessionState(paths),
      releaseLock: () => releaseLock(paths),
    });
    await logger.event("cleanup_completed", { exitCode });
  };

  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    Deno.addSignalListener(signal, () => {
      cleanup(130).finally(() => Deno.exit(130));
    });
  }

  try {
    const staleMessage = await recoverStaleSession(paths, runner, logger);
    if (staleMessage) logLine(staleMessage);

    const before = await getAwdlState(runner);
    logLine(`AWDL state before launch: ${before}`);
    await logger.event("awdl_state_detected", { state: before });
    if (before === "enabled") {
      logLine("Disabling AWDL...");
      await setAwdlDown(runner);
      disabledAwdl = true;
      await logger.event("awdl_disabled");
      logLine("AWDL disabled.");
    }

    let process = (await findMoonlightProcesses(runner))[0];
    if (process && config.attachToExisting) {
      logLine(`Attaching to Moonlight process ${process.pid}...`);
      if (disableMetal) {
        logLine(
          "--disable-metal was requested, but Moonlight is already running; attaching cannot change renderer environment.",
        );
      }
      await logger.event("moonlight_attached", { pid: process.pid });
    } else {
      logLine(
        disableMetal
          ? "Launching Moonlight with Metal renderer disabled..."
          : "Launching Moonlight...",
      );
      await launchMoonlight(config.moonlightPath, runner, { disableMetal });
      process = await waitForMoonlightPid(runner) ??
        (() => {
          throw new Error("Moonlight did not appear after launch");
        })();
      await logger.event("moonlight_launched", { pid: process.pid });
    }

    const state: SessionState = {
      version: 1,
      launcherPid: Deno.pid,
      moonlightPid: process.pid,
      startedAt: new Date().toISOString(),
      disabledAwdl,
      awdlStateBefore: before,
      lastOperation: "running",
    };
    await writeSessionState(paths, state);

    if (config.watchdogEnabled) {
      watchdogTimer = setInterval(async () => {
        try {
          const state = await getAwdlState(runner);
          if (state === "enabled") {
            logLine("AWDL has started again - attempting to disable it...");
            await setAwdlDown(runner);
            logLine("AWDL disabled.");
            await logger.event("watchdog_redisabled_awdl");
          }
        } catch (error) {
          await logger.event("error", { phase: "watchdog", message: String(error) });
        }
      }, config.watchdogIntervalMs);
    }

    logLine("Monitoring Moonlight process...");
    while ((await findMoonlightProcesses(runner)).some((item) => item.pid === process.pid)) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    logLine("Moonlight exited.");
    await logger.event("moonlight_exited", { pid: process.pid });
    await cleanup(0);
    logLine("Done.");
  } catch (error) {
    await logger.event("error", {
      message: error instanceof Error ? error.message : String(error),
    });
    await cleanup(1);
    throw error;
  }
}

export async function runWatchdogOnceForTest(
  runner: CommandRunner,
  onRedisable?: () => void,
): Promise<boolean> {
  if (await getAwdlState(runner) === "enabled") {
    await setAwdlDown(runner);
    onRedisable?.();
    return true;
  }
  return false;
}
