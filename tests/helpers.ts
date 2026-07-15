import { CommandResult, CommandRunner } from "../src/process.ts";

export function assert(condition: unknown, message = "Assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

export function assertEquals<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

export class MockRunner implements CommandRunner {
  calls: Array<{ command: string; args: string[] }> = [];
  responses: CommandResult[] = [];

  constructor(responses: CommandResult[] = []) {
    this.responses = responses;
  }

  run(command: string, args: string[] = []): Promise<CommandResult> {
    this.calls.push({ command, args });
    return Promise.resolve(this.responses.shift() ?? { code: 0, stdout: "", stderr: "" });
  }
}

export function ok(stdout = "") {
  return { code: 0, stdout, stderr: "" };
}

export function fail(stderr = "failed") {
  return { code: 1, stdout: "", stderr };
}
