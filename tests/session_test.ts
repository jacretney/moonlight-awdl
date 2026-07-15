import { cleanupManagedSession, runWatchdogOnceForTest } from "../src/session.ts";
import { assertEquals, MockRunner, ok } from "./helpers.ts";

Deno.test("cleanup restores when launcher disabled AWDL", async () => {
  let restored = false;
  const result = await cleanupManagedSession({
    disabledAwdl: true,
    restore: () => {
      restored = true;
      return Promise.resolve();
    },
  });
  assertEquals(restored, true);
  assertEquals(result, true);
});

Deno.test("cleanup does not restore when AWDL was initially disabled", async () => {
  let restored = false;
  const result = await cleanupManagedSession({
    disabledAwdl: false,
    restore: () => {
      restored = true;
      return Promise.resolve();
    },
  });
  assertEquals(restored, false);
  assertEquals(result, false);
});

Deno.test("watchdog re-disables AWDL", async () => {
  const runner = new MockRunner([ok("awdl0: flags=8863<UP>\n\tstatus: active\n"), ok()]);
  let redisabled = false;
  const result = await runWatchdogOnceForTest(runner, () => redisabled = true);
  assertEquals(result, true);
  assertEquals(redisabled, true);
  assertEquals(runner.calls[1].command, "/usr/bin/sudo");
});
