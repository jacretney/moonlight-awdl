import { findMoonlightProcesses, launchMoonlight, moonlightOpenArgs } from "../src/moonlight.ts";
import { assertEquals, MockRunner, ok } from "./helpers.ts";

Deno.test("detects Moonlight process without broad command-line matching", async () => {
  const runner = new MockRunner([
    ok(` 123 /Applications/Moonlight.app/Contents/MacOS/Moonlight
 456 /usr/bin/python moonlight notes
`),
  ]);
  const processes = await findMoonlightProcesses(runner);
  assertEquals(processes.length, 1);
  assertEquals(processes[0].pid, 123);
});

Deno.test("builds open args for disabling Metal renderer", () => {
  assertEquals(
    JSON.stringify(moonlightOpenArgs("/Applications/Moonlight.app", { disableMetal: true })),
    JSON.stringify(["--env", "VT_FORCE_METAL=0", "/Applications/Moonlight.app"]),
  );
});

Deno.test("launches Moonlight with Metal renderer disabled", async () => {
  const runner = new MockRunner([ok()]);
  await launchMoonlight("/Applications/Moonlight.app", runner, { disableMetal: true });
  assertEquals(runner.calls[0].command, "/usr/bin/open");
  assertEquals(
    JSON.stringify(runner.calls[0].args),
    JSON.stringify(["--env", "VT_FORCE_METAL=0", "/Applications/Moonlight.app"]),
  );
});
