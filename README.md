# moonlight-awdl

A small terminal-based macOS launcher for Moonlight that temporarily disables Apple Wireless Direct
Link (`awdl0`) while Moonlight is running.

## Read This First

This is an unofficial workaround that temporarily changes a macOS network interface. It is not
affiliated with Moonlight, Sunshine, Apple, or Deno.

Before running `moonlight-awdl`, you should understand what it changes:

- It temporarily disables the macOS `awdl0` network interface while Moonlight is running.
- It installs a sudoers rule at `/etc/sudoers.d/moonlight-awdl`.
- That rule allows your user to run only these two commands without a password:
  - `/sbin/ifconfig awdl0 down`
  - `/sbin/ifconfig awdl0 up`
- While `awdl0` is disabled, Apple nearby-device features such as AirDrop, Handoff, Sidecar,
  Universal Control, and some AirPlay behavior may stop working.
- The app tries to restore AWDL on normal exit, but hard termination, power loss, or `SIGKILL` can
  prevent cleanup. Use `moonlight-awdl restore` if AWDL remains disabled.

Review the source and the exact sudoers rule before installing. Do not run this if you are not
comfortable with a tool temporarily changing a system network interface.

## The Moonlight Issue

Some macOS users (like myself) see severe periodic Moonlight audio/video stuttering, especially on
Wi-Fi. The stream can be otherwise healthy, then audio and video repeatedly hitch or freeze. For
affected users, the stuttering immediately clears after disabling AWDL:

```sh
sudo /sbin/ifconfig awdl0 down
```

That manual command is the workaround this project automates. This does not claim to fix every
Moonlight streaming issue; it is only for the class of problems that improve when `awdl0` is
disabled.

## What AWDL Is

AWDL is Apple Wireless Direct Link. It supports peer-to-peer Apple features such as AirDrop,
Handoff, Sidecar, Universal Control, some AirPlay behavior, and nearby-device discovery. Those
features may be unavailable while `moonlight-awdl run` is managing a Moonlight session.

AWDL can periodically use the Wi-Fi radio for peer-to-peer discovery and nearby-device traffic. On
some setups, that appears to interfere with latency-sensitive Moonlight streaming enough to cause
audio/video stalls. Disabling `awdl0` removes that source of Wi-Fi activity during the stream, at
the cost of temporarily disabling the Apple features above.

## What This Tool Automates

You can run the manual `ifconfig` command yourself, but macOS may re-enable AWDL later, and it is
easy to forget to turn it back on. This launcher manages the full session:

- Detects Moonlight.
- Installs a narrowly scoped sudoers rule for only `awdl0 down` and `awdl0 up`.
- Disables AWDL before launching or attaching to Moonlight.
- Watches for macOS re-enabling AWDL and disables it again.
- Restores AWDL when Moonlight exits, but only if this launcher disabled it.
- Provides `doctor`, `status`, `restore`, and `uninstall` commands for diagnostics and recovery.

To do that, it requires Deno for source usage or a compiled executable, one administrator approval
during `setup`, and the sudoers rule described above.

## Install And Setup

### Option 1: Download A Release

Download the latest macOS executable from:

```text
https://github.com/jacretney/moonlight-awdl/releases/latest
```

Choose the binary for your Mac:

- Apple Silicon: `moonlight-awdl-arm64`
- Intel: `moonlight-awdl-x86_64`

Then make it executable and run setup:

```sh
chmod +x ./moonlight-awdl-arm64
./moonlight-awdl-arm64 setup
./moonlight-awdl-arm64 run
```

For Intel Macs, use `moonlight-awdl-x86_64` in the commands above.

You can verify the download with `SHA256SUMS` from the same release:

```sh
shasum -a 256 -c SHA256SUMS
```

### Option 2: Run From Source

Install Deno 2.x, then run:

```sh
deno task dev setup
deno task dev run
```

### Option 3: Build From Source

Compile a standalone executable locally:

```sh
deno task compile
./dist/moonlight-awdl setup
./dist/moonlight-awdl run
```

`setup` finds Moonlight, explains the AWDL trade-off, and installs this sudoers file:

```text
/etc/sudoers.d/moonlight-awdl
```

The rule grants passwordless access only to these exact commands for the detected console user:

```text
/sbin/ifconfig awdl0 down
/sbin/ifconfig awdl0 up
```

The administrator password may be requested once during setup. After setup, `run` should not prompt
for a password.

## Usage

```sh
moonlight-awdl setup
moonlight-awdl run
moonlight-awdl run --disable-metal
moonlight-awdl status
moonlight-awdl doctor
moonlight-awdl restore
moonlight-awdl uninstall
moonlight-awdl config show
moonlight-awdl config set watchdogIntervalMs 3000
moonlight-awdl config set watchdog true
```

Running without arguments prints help.

`run` records the initial AWDL state, disables AWDL if it was enabled, launches or attaches to
Moonlight, keeps AWDL disabled with a watchdog, then restores AWDL only if this launcher disabled
it.

Use `--disable-metal` to launch Moonlight with `VT_FORCE_METAL=0`:

```sh
moonlight-awdl run --disable-metal
```

If Moonlight is already running and the launcher attaches to it, this flag cannot change that
existing process. Quit Moonlight first, or set `attachToExisting` to `false`, if you need a fresh
launch with Metal disabled.

## Configuration

Non-sensitive config is stored at:

```text
~/Library/Application Support/moonlight-awdl/config.json
```

Default config:

```json
{
  "version": 1,
  "moonlightPath": "/Applications/Moonlight.app",
  "watchdogEnabled": true,
  "watchdogIntervalMs": 3000,
  "attachToExisting": true,
  "verbose": false
}
```

Logs are capped and stored under:

```text
~/Library/Logs/moonlight-awdl/
```

## Security Design

The executable runs as the normal user. It never stores passwords and never constructs shell command
strings. Privileged work is limited to direct `Deno.Command` calls with fixed argument arrays.

The sudoers rule does not permit arbitrary `ifconfig` use or arbitrary root commands. Moonlight
paths are treated as unprivileged data and never influence privileged command construction.

Remove the sudoers file with:

```sh
moonlight-awdl uninstall
```

## Failure Recovery

Normal Moonlight exit and handled signals restore AWDL when this launcher disabled it. `SIGKILL`,
power loss, or a hard crash can prevent cleanup.

If AWDL remains disabled, run:

```sh
moonlight-awdl restore
```

On startup, `run` checks for stale session state and performs a safe restore when Moonlight is no
longer running and the previous session recorded that it disabled AWDL.

## Troubleshooting

Moonlight not detected:

```sh
moonlight-awdl setup --moonlight-path /Applications/Moonlight.app
```

Password prompt during `run`:

```sh
moonlight-awdl doctor
moonlight-awdl setup
```

Invalid sudoers rule:

```sh
sudo /usr/sbin/visudo -cf /etc/sudoers.d/moonlight-awdl
moonlight-awdl uninstall
moonlight-awdl setup
```

`awdl0` missing means the current Mac or network configuration is not exposing that interface.

If AWDL immediately re-enables, keep the watchdog enabled or lower the interval, with a minimum of
1000 ms:

```sh
moonlight-awdl config set watchdog true
moonlight-awdl config set watchdogIntervalMs 1000
```

If Moonlight is already running, the launcher attaches by default. Disable that behavior with:

```sh
moonlight-awdl config set attachToExisting false
```

For stale locks, confirm no launcher is active, then remove:

```sh
rm ~/Library/Application\ Support/moonlight-awdl/session.lock
```

If AirDrop does not work after a crash:

```sh
moonlight-awdl restore
```

Manual uninstall fallback:

```sh
moonlight-awdl restore
sudo rm /etc/sudoers.d/moonlight-awdl
rm -rf ~/Library/Application\ Support/moonlight-awdl
rm -rf ~/Library/Logs/moonlight-awdl
```

## Build And Release

Local build:

```sh
deno task check
deno task lint
deno task test
deno task compile
```

Release outputs:

```sh
deno task release
```

This writes:

```text
dist/moonlight-awdl-arm64
dist/moonlight-awdl-x86_64
dist/SHA256SUMS
```

The release task uses `deno compile --target aarch64-apple-darwin` and
`--target x86_64-apple-darwin`. If cross-compilation fails for a Deno release, build each
architecture on native hardware.

If both outputs are compatible, you can create a universal binary manually:

```sh
lipo -create -output dist/moonlight-awdl-universal dist/moonlight-awdl-arm64 dist/moonlight-awdl-x86_64
```

GitHub releases are published automatically when a tag is pushed:

```sh
git tag v0.1.0
git push origin v0.1.0
```

The release workflow runs formatting, linting, type checks, tests, then uploads:

- `moonlight-awdl-arm64`
- `moonlight-awdl-x86_64`
- `SHA256SUMS`

## Manual Integration Checklist

- Fresh `setup`
- Normal launch and exit
- Moonlight already running
- Ctrl+C during a session
- Moonlight crash
- AWDL manually re-enabled during a session
- Reboot or forced launcher termination followed by `restore`
- `uninstall`
- AirDrop unavailable during streaming and restored afterward

## Scope

This project is intentionally small: no native app, no auto-updater, no telemetry, and no network
access. It exists only to automate the AWDL workaround during a managed Moonlight session.
