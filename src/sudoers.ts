import { getAwdlState, setAwdlDown, setAwdlUp } from "./awdl.ts";
import { CommandRunner, isRegularFile } from "./process.ts";

export const SUDOERS_PATH = "/etc/sudoers.d/moonlight-awdl";
export const SUDOERS_MARKER = "moonlight-awdl generated sudoers file v1";

export function escapeSudoersUser(user: string): string {
  if (!user || user === "root" || /[\n\r:]/.test(user)) throw new Error("Invalid sudoers user");
  return user.replace(/([\\\s,#=])/g, "\\$1");
}

export function generateSudoersContent(user: string): string {
  const escaped = escapeSudoersUser(user);
  return [
    `# ${SUDOERS_MARKER}`,
    "# Allows only the exact AWDL up/down commands needed by moonlight-awdl.",
    `${escaped} ALL=(root) NOPASSWD: /sbin/ifconfig awdl0 down, /sbin/ifconfig awdl0 up`,
    "",
  ].join("\n");
}

export function isOwnedSudoersContent(text: string): boolean {
  return text.startsWith(`# ${SUDOERS_MARKER}\n`);
}

export async function canOverwriteSudoers(path = SUDOERS_PATH): Promise<boolean> {
  try {
    const info = await Deno.lstat(path);
    if (!info.isFile || info.isSymlink) return false;
    return isOwnedSudoersContent(await Deno.readTextFile(path));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return true;
    throw error;
  }
}

export async function validateSudoersFile(path: string, runner: CommandRunner): Promise<void> {
  const result = await runner.run("/usr/sbin/visudo", ["-cf", path]);
  if (result.code !== 0) throw new Error(`visudo rejected sudoers file: ${result.stderr.trim()}`);
}

export async function installSudoers(user: string, runner: CommandRunner): Promise<void> {
  if (!await canOverwriteSudoers()) {
    throw new Error(`${SUDOERS_PATH} exists but is not owned by moonlight-awdl`);
  }
  const tempFile = await Deno.makeTempFile({ prefix: "moonlight-awdl-sudoers-" });
  try {
    await Deno.writeTextFile(tempFile, generateSudoersContent(user), { mode: 0o400 });
    await validateSudoersFile(tempFile, runner);
    const result = await runner.run("/usr/bin/sudo", [
      "/usr/bin/install",
      "-o",
      "root",
      "-g",
      "wheel",
      "-m",
      "0440",
      tempFile,
      SUDOERS_PATH,
    ]);
    if (result.code !== 0) {
      throw new Error(`Failed to install sudoers file: ${result.stderr.trim()}`);
    }
  } finally {
    await Deno.remove(tempFile).catch(() => {});
  }
}

export async function removeSudoers(runner: CommandRunner): Promise<void> {
  if (!await isRegularFile(SUDOERS_PATH)) return;
  if (!isOwnedSudoersContent(await Deno.readTextFile(SUDOERS_PATH))) {
    throw new Error(`${SUDOERS_PATH} is not a moonlight-awdl file; refusing to remove it`);
  }
  const result = await runner.run("/usr/bin/sudo", ["/bin/rm", SUDOERS_PATH]);
  if (result.code !== 0) throw new Error(`Failed to remove sudoers file: ${result.stderr.trim()}`);
}

export async function verifyAndPreserveAwdlState(runner: CommandRunner): Promise<void> {
  const before = await getAwdlState(runner);
  await setAwdlDown(runner);
  await setAwdlUp(runner);
  if (before === "disabled") await setAwdlDown(runner);
}
