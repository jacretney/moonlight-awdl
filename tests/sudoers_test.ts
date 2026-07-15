import {
  canOverwriteSudoers,
  escapeSudoersUser,
  generateSudoersContent,
  isOwnedSudoersContent,
} from "../src/sudoers.ts";
import { assertEquals } from "./helpers.ts";

Deno.test("generates narrowly scoped sudoers content", () => {
  const content = generateSudoersContent("jim");
  assertEquals(
    content.includes("NOPASSWD: /sbin/ifconfig awdl0 down, /sbin/ifconfig awdl0 up"),
    true,
  );
  assertEquals(content.includes("ifconfig *"), false);
});

Deno.test("escapes sudoers usernames", () => {
  assertEquals(escapeSudoersUser("Jane Doe"), "Jane\\ Doe");
  assertEquals(escapeSudoersUser("ops#1"), "ops\\#1");
});

Deno.test("identifies owned sudoers content", () => {
  assertEquals(isOwnedSudoersContent(generateSudoersContent("jim")), true);
  assertEquals(isOwnedSudoersContent("# unrelated\njim ALL=(ALL) ALL\n"), false);
});

Deno.test("refuses to overwrite unrelated sudoers file", async () => {
  const file = await Deno.makeTempFile();
  await Deno.writeTextFile(file, "# unrelated\n");
  assertEquals(await canOverwriteSudoers(file), false);
});
