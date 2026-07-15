import { getAwdlState, setAwdlUp, verifyPasswordlessAwdlPreservingState } from "./awdl.ts";
import { loadConfig, saveConfig, setConfigValue } from "./config.ts";
import { printDoctor, runDoctor } from "./doctor.ts";
import { Logger } from "./logger.ts";
import { detectMoonlight, isMoonlightRunning, validateMoonlightPath } from "./moonlight.ts";
import { ensureAppDirs, getAppPaths } from "./paths.ts";
import { DenoCommandRunner } from "./process.ts";
import { assertMacOS, detectConsoleUser } from "./platform.ts";
import { runManagedSession } from "./session.ts";
import { installSudoers, removeSudoers, verifyAndPreserveAwdlState } from "./sudoers.ts";
import { clearSessionState } from "./state.ts";

export async function main(args: string[]): Promise<void> {
  const json = args.includes("--json");
  const yes = args.includes("--yes");
  const disableMetal = args.includes("--disable-metal");
  const moonlightArg = valueAfter(args, "--moonlight-path");
  const command = args.find((arg) => !arg.startsWith("--"));
  const paths = getAppPaths();
  const runner = new DenoCommandRunner();
  const loaded = await loadConfig(paths);
  let config = loaded.config;
  const verbose = args.includes("--verbose") || config.verbose;
  const logger = new Logger(paths, verbose);

  if (!command) {
    printHelp();
    return;
  }

  switch (command) {
    case "setup": {
      assertMacOS();
      await logger.event("setup_started");
      await ensureAppDirs(paths);
      const user = await detectConsoleUser(runner);
      const detected = moonlightArg ?? await detectMoonlight(runner);
      if (!detected || !await validateMoonlightPath(detected)) {
        throw new Error(
          "Moonlight was not found. Re-run with --moonlight-path /Applications/Moonlight.app",
        );
      }
      config = { ...config, moonlightPath: detected };
      console.log(`Moonlight found: ${detected}`);
      console.log(
        "AWDL supports AirDrop, Handoff, Sidecar, Universal Control, and nearby-device features.",
      );
      console.log("Those features may be unavailable while a managed Moonlight session is active.");
      await installSudoers(user, runner);
      await logger.event("sudoers_installed", { user });
      await verifyAndPreserveAwdlState(runner);
      await logger.event("sudoers_validated");
      await saveConfig(paths, config);
      console.log(`Setup complete. Config saved to ${paths.configPath}`);
      break;
    }
    case "run": {
      assertMacOS();
      if (moonlightArg) config = { ...config, moonlightPath: moonlightArg };
      if (!await validateMoonlightPath(config.moonlightPath)) {
        throw new Error(`Invalid Moonlight path: ${config.moonlightPath}`);
      }
      await runManagedSession({ config, paths, runner, logger, disableMetal });
      break;
    }
    case "status": {
      const status = {
        moonlightPath: config.moonlightPath,
        moonlightRunning: await isMoonlightRunning(runner),
        awdlState: await getAwdlState(runner),
        sudoersInstalled: Object.values(await verifyPasswordlessAwdlPreservingState(runner)).every(
          Boolean,
        ),
        watchdogEnabled: config.watchdogEnabled,
        watchdogIntervalMs: config.watchdogIntervalMs,
        configPath: paths.configPath,
        recoveredConfig: loaded.recovered,
      };
      if (json) console.log(JSON.stringify(status, null, 2));
      else {
        for (const [key, value] of Object.entries(status)) console.log(`${key}: ${value}`);
      }
      break;
    }
    case "doctor":
      printDoctor(await runDoctor(paths, config, runner), json);
      break;
    case "restore":
      await setAwdlUp(runner);
      await clearSessionState(paths);
      await logger.event("awdl_restored", { command: "restore" });
      console.log("AWDL restore command completed.");
      break;
    case "uninstall": {
      if (
        !yes && !confirm("Restore AWDL and remove moonlight-awdl config, state, and sudoers file?")
      ) {
        console.log("Uninstall cancelled.");
        return;
      }
      await setAwdlUp(runner);
      await removeSudoers(runner);
      await Deno.remove(paths.supportDir, { recursive: true }).catch(() => {});
      console.log("Removed moonlight-awdl files. Moonlight and Deno were not removed.");
      break;
    }
    case "config":
      await handleConfig(args.slice(args.indexOf("config") + 1), paths, config);
      break;
    default:
      printHelp();
      Deno.exitCode = 64;
  }
}

async function handleConfig(
  args: string[],
  paths: ReturnType<typeof getAppPaths>,
  config: typeof import("./config.ts").DEFAULT_CONFIG,
) {
  const subcommand = args[0] ?? "show";
  if (subcommand === "show") {
    console.log(JSON.stringify(config, null, 2));
    return;
  }
  if (subcommand === "set") {
    const key = args[1];
    const value = args[2];
    if (!key || value === undefined) {
      throw new Error("Usage: moonlight-awdl config set <key> <value>");
    }
    const updated = setConfigValue(config, key, value);
    await saveConfig(paths, updated);
    console.log(`Updated ${key}.`);
    return;
  }
  throw new Error("Usage: moonlight-awdl config show|set");
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function printHelp(): void {
  console.log(`moonlight-awdl

Usage:
  moonlight-awdl setup [--moonlight-path /Applications/Moonlight.app]
  moonlight-awdl run [--disable-metal] [--verbose]
  moonlight-awdl status [--json]
  moonlight-awdl doctor [--json]
  moonlight-awdl restore
  moonlight-awdl uninstall [--yes]
  moonlight-awdl config show
  moonlight-awdl config set watchdogIntervalMs 3000`);
}
