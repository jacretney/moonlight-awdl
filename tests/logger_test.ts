import { timestampPrefix } from "../src/logger.ts";
import { assertEquals } from "./helpers.ts";

Deno.test("formats timestamp prefix as ISO string", () => {
  assertEquals(timestampPrefix(new Date("2026-07-16T12:34:56.000Z")), "2026-07-16T12:34:56.000Z");
});
