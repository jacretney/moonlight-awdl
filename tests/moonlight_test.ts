import { findMoonlightProcesses } from "../src/moonlight.ts";
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
