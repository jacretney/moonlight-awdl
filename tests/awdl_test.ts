import {
  AWDL_DOWN_ARGS,
  AWDL_UP_ARGS,
  parseAwdlState,
  setAwdlDown,
  setAwdlUp,
} from "../src/awdl.ts";
import { assertEquals, MockRunner, ok } from "./helpers.ts";

Deno.test("parses active AWDL output", () => {
  assertEquals(parseAwdlState("awdl0: flags=8863<UP>\n\tstatus: active\n"), "enabled");
});

Deno.test("parses inactive AWDL output", () => {
  assertEquals(parseAwdlState("awdl0: flags=8802<BROADCAST>\n\tstatus: inactive\n"), "disabled");
});

Deno.test("parses missing AWDL output", () => {
  assertEquals(parseAwdlState("", "ifconfig: interface awdl0 does not exist", 1), "missing");
});

Deno.test("constructs exact privileged AWDL commands", async () => {
  const runner = new MockRunner([ok(), ok()]);
  await setAwdlDown(runner);
  await setAwdlUp(runner);
  assertEquals(runner.calls[0].command, "/usr/bin/sudo");
  assertEquals(JSON.stringify(runner.calls[0].args), JSON.stringify([...AWDL_DOWN_ARGS]));
  assertEquals(JSON.stringify(runner.calls[1].args), JSON.stringify([...AWDL_UP_ARGS]));
});
