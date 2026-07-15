import { loadConfig, saveConfig, setConfigValue, validateConfig } from "../src/config.ts";
import { getAppPaths } from "../src/paths.ts";
import { assertEquals } from "./helpers.ts";

Deno.test("validates config", () => {
  const config = validateConfig({
    version: 1,
    moonlightPath: "/Applications/Moonlight.app",
    watchdogEnabled: true,
    watchdogIntervalMs: 3000,
    attachToExisting: true,
    verbose: false,
  });
  assertEquals(config.watchdogIntervalMs, 3000);
});

Deno.test("rejects unreasonable watchdog interval", () => {
  try {
    setConfigValue(
      {
        version: 1,
        moonlightPath: "/Applications/Moonlight.app",
        watchdogEnabled: true,
        watchdogIntervalMs: 3000,
        attachToExisting: true,
        verbose: false,
      },
      "watchdogIntervalMs",
      "500",
    );
    throw new Error("expected failure");
  } catch (error) {
    assertEquals((error as Error).message.includes("1000"), true);
  }
});

Deno.test("recovers from corrupt config", async () => {
  const dir = await Deno.makeTempDir();
  const paths = getAppPaths(dir);
  await Deno.mkdir(paths.supportDir, { recursive: true });
  await Deno.writeTextFile(paths.configPath, "{bad");
  const loaded = await loadConfig(paths);
  assertEquals(loaded.recovered, true);
  assertEquals(loaded.config.version, 1);
});

Deno.test("saves readable config", async () => {
  const dir = await Deno.makeTempDir();
  const paths = getAppPaths(dir);
  await saveConfig(paths, {
    version: 1,
    moonlightPath: "/Applications/Moonlight.app",
    watchdogEnabled: false,
    watchdogIntervalMs: 5000,
    attachToExisting: false,
    verbose: true,
  });
  const loaded = await loadConfig(paths);
  assertEquals(loaded.config.watchdogEnabled, false);
});
