import { CommandRunner } from "./process.ts";

export function assertMacOS(): void {
  if (Deno.build.os !== "darwin") throw new Error("moonlight-awdl only supports macOS");
}

export function selectConsoleUser(input: {
  sudoUser?: string;
  idUser?: string;
  consoleUser?: string;
}): string {
  for (const value of [input.sudoUser, input.consoleUser, input.idUser]) {
    if (value && value !== "root" && value.trim()) return value.trim();
  }
  throw new Error("Could not determine a non-root console user");
}

export async function detectConsoleUser(runner: CommandRunner): Promise<string> {
  const sudoUser = Deno.env.get("SUDO_USER");
  const consoleResult = await runner.run("/usr/bin/stat", ["-f", "%Su", "/dev/console"]);
  const idResult = await runner.run("/usr/bin/id", ["-un"]);
  return selectConsoleUser({
    sudoUser,
    consoleUser: consoleResult.code === 0 ? consoleResult.stdout.trim() : undefined,
    idUser: idResult.code === 0 ? idResult.stdout.trim() : undefined,
  });
}
