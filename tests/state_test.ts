import { clearSessionState, readSessionState, writeSessionState } from "../src/state.ts";
import { getAppPaths } from "../src/paths.ts";
import { assertEquals } from "./helpers.ts";

Deno.test("writes and clears setup session state", async () => {
  const paths = getAppPaths(await Deno.makeTempDir());
  await writeSessionState(paths, {
    version: 1,
    launcherPid: 1,
    startedAt: new Date().toISOString(),
    disabledAwdl: true,
    awdlStateBefore: "enabled",
    lastOperation: "running",
  });
  assertEquals((await readSessionState(paths))?.disabledAwdl, true);
  await clearSessionState(paths);
  assertEquals(await readSessionState(paths), undefined);
});
