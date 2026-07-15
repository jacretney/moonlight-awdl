export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface CommandRunner {
  run(command: string, args?: string[], options?: Deno.CommandOptions): Promise<CommandResult>;
}

const decoder = new TextDecoder();

export class DenoCommandRunner implements CommandRunner {
  async run(command: string, args: string[] = [], options: Deno.CommandOptions = {}) {
    const child = new Deno.Command(command, {
      ...options,
      args,
      stdout: "piped",
      stderr: "piped",
    });
    const output = await child.output();
    return {
      code: output.code,
      stdout: decoder.decode(output.stdout),
      stderr: decoder.decode(output.stderr),
    };
  }
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await Deno.stat(path)).isDirectory;
  } catch {
    return false;
  }
}

export async function isRegularFile(path: string): Promise<boolean> {
  try {
    return (await Deno.lstat(path)).isFile;
  } catch {
    return false;
  }
}

export function absolutize(path: string): string {
  if (path.startsWith("~/")) {
    const home = Deno.env.get("HOME");
    if (!home) throw new Error("HOME is not set");
    return `${home}${path.slice(1)}`;
  }
  if (path.startsWith("/")) return path;
  return `${Deno.cwd()}/${path}`;
}

export function quoteArgs(args: string[]): string {
  return args.map((arg) => JSON.stringify(arg)).join(" ");
}
