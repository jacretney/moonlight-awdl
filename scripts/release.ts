async function run(command: string, args: string[]) {
  const result = await new Deno.Command(command, {
    args,
    stdout: "inherit",
    stderr: "inherit",
  }).output();
  if (result.code !== 0) throw new Error(`${command} ${args.join(" ")} failed`);
}

async function sha256(path: string): Promise<string> {
  const data = await Deno.readFile(path);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

if (import.meta.main) {
  await Deno.mkdir("dist", { recursive: true });
  const builds = [
    { target: "aarch64-apple-darwin", output: "dist/moonlight-awdl-arm64" },
    { target: "x86_64-apple-darwin", output: "dist/moonlight-awdl-x86_64" },
  ];
  for (const build of builds) {
    await run("deno", [
      "compile",
      "--allow-run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "--target",
      build.target,
      "--output",
      build.output,
      "src/main.ts",
    ]);
  }
  const lines = [];
  for (const build of builds) lines.push(`${await sha256(build.output)}  ${build.output}`);
  await Deno.writeTextFile("dist/SHA256SUMS", `${lines.join("\n")}\n`);
  console.log("Release artifacts written to dist/");
}
