import { selectConsoleUser } from "../src/platform.ts";
import { assertEquals } from "./helpers.ts";

Deno.test("prefers sudo user over root id user", () => {
  assertEquals(selectConsoleUser({ sudoUser: "jim", idUser: "root", consoleUser: "jim" }), "jim");
});

Deno.test("does not select root as configured user", () => {
  assertEquals(
    selectConsoleUser({ sudoUser: "root", idUser: "root", consoleUser: "alice" }),
    "alice",
  );
});
