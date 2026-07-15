import { AppPaths, ensureAppDirs } from "./paths.ts";

export interface Config {
  version: 1;
  moonlightPath: string;
  watchdogEnabled: boolean;
  watchdogIntervalMs: number;
  attachToExisting: boolean;
  verbose: boolean;
}

export const DEFAULT_CONFIG: Config = {
  version: 1,
  moonlightPath: "/Applications/Moonlight.app",
  watchdogEnabled: true,
  watchdogIntervalMs: 3000,
  attachToExisting: true,
  verbose: false,
};

export function validateConfig(value: unknown): Config {
  if (!value || typeof value !== "object") throw new Error("Config must be an object");
  const obj = value as Record<string, unknown>;
  if (obj.version !== 1) throw new Error("Unsupported config version");
  if (typeof obj.moonlightPath !== "string" || !obj.moonlightPath.endsWith(".app")) {
    throw new Error("moonlightPath must be an .app path");
  }
  if (typeof obj.watchdogEnabled !== "boolean") throw new Error("watchdogEnabled must be boolean");
  if (
    typeof obj.watchdogIntervalMs !== "number" ||
    !Number.isInteger(obj.watchdogIntervalMs) ||
    obj.watchdogIntervalMs < 1000 ||
    obj.watchdogIntervalMs > 60000
  ) {
    throw new Error("watchdogIntervalMs must be an integer from 1000 to 60000");
  }
  if (typeof obj.attachToExisting !== "boolean") {
    throw new Error("attachToExisting must be boolean");
  }
  if (typeof obj.verbose !== "boolean") throw new Error("verbose must be boolean");
  return {
    version: 1,
    moonlightPath: obj.moonlightPath,
    watchdogEnabled: obj.watchdogEnabled,
    watchdogIntervalMs: obj.watchdogIntervalMs,
    attachToExisting: obj.attachToExisting,
    verbose: obj.verbose,
  };
}

export async function loadConfig(paths: AppPaths): Promise<{ config: Config; recovered: boolean }> {
  try {
    const text = await Deno.readTextFile(paths.configPath);
    return { config: validateConfig(JSON.parse(text)), recovered: false };
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return { config: DEFAULT_CONFIG, recovered: true };
    return { config: DEFAULT_CONFIG, recovered: true };
  }
}

export async function saveConfig(paths: AppPaths, config: Config): Promise<void> {
  await ensureAppDirs(paths);
  const validated = validateConfig(config);
  await Deno.writeTextFile(paths.configPath, `${JSON.stringify(validated, null, 2)}\n`, {
    mode: 0o600,
  });
}

export function setConfigValue(config: Config, key: string, rawValue: string): Config {
  if (key === "moonlightPath") return validateConfig({ ...config, moonlightPath: rawValue });
  if (key === "watchdog" || key === "watchdogEnabled") {
    return validateConfig({ ...config, watchdogEnabled: parseBool(rawValue) });
  }
  if (key === "watchdogIntervalMs") {
    return validateConfig({ ...config, watchdogIntervalMs: Number(rawValue) });
  }
  if (key === "attachToExisting") {
    return validateConfig({ ...config, attachToExisting: parseBool(rawValue) });
  }
  if (key === "verbose") return validateConfig({ ...config, verbose: parseBool(rawValue) });
  throw new Error(`Unknown config key: ${key}`);
}

function parseBool(value: string): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("Boolean config values must be true or false");
}
