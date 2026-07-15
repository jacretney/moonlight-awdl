import { AppPaths, ensureAppDirs } from "./paths.ts";

export type LogEvent =
  | "setup_started"
  | "sudoers_validated"
  | "sudoers_installed"
  | "awdl_state_detected"
  | "awdl_disabled"
  | "watchdog_redisabled_awdl"
  | "moonlight_launched"
  | "moonlight_attached"
  | "moonlight_exited"
  | "awdl_restored"
  | "cleanup_completed"
  | "error";

export class Logger {
  constructor(private readonly paths: AppPaths, private readonly verbose = false) {}

  async event(event: LogEvent, data: Record<string, unknown> = {}): Promise<void> {
    const entry = JSON.stringify({ timestamp: new Date().toISOString(), event, ...data });
    await ensureAppDirs(this.paths);
    await this.rotateIfNeeded();
    await Deno.writeTextFile(this.paths.logPath, `${entry}\n`, { append: true, create: true });
    if (this.verbose) console.log(`[${event}] ${JSON.stringify(data)}`);
  }

  private async rotateIfNeeded(): Promise<void> {
    try {
      const stat = await Deno.stat(this.paths.logPath);
      if (stat.size > 256_000) {
        await Deno.rename(this.paths.logPath, `${this.paths.logPath}.1`);
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  }
}
