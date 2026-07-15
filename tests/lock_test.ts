import { acquireLock, readLock, releaseLock } from "../src/lock.ts";
import { getAppPaths } from "../src/paths.ts";
import { assertEquals } from "./helpers.ts";

Deno.test("acquires lock", async () => {
  const paths = getAppPaths(await Deno.makeTempDir());
  await acquireLock(paths, { isAlive: () => false });
  const lock = await readLock(paths.lockPath);
  assertEquals(typeof lock?.pid, "number");
});

Deno.test("refuses active lock", async () => {
  const paths = getAppPaths(await Deno.makeTempDir());
  await acquireLock(paths, { isAlive: () => false });
  try {
    await acquireLock(paths, { isAlive: () => true });
    throw new Error("expected failure");
  } catch (error) {
    assertEquals((error as Error).message.includes("Another moonlight-awdl session"), true);
  }
});

Deno.test("recovers stale lock", async () => {
  const paths = getAppPaths(await Deno.makeTempDir());
  await acquireLock(paths, { isAlive: () => false });
  await acquireLock(paths, { isAlive: () => false });
  await releaseLock(paths);
  assertEquals(await readLock(paths.lockPath), undefined);
});
