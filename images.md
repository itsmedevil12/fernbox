# Images

An image is a filesystem: the `/etc`, the commands, and the libraries an instance
boots with. Five ship inside the binary, and each is a **personality, not a
distribution** — the virtual filesystem is utf8 text with no symlinks, no
permissions, and no binaries, so an image cannot be Alpine or Ubuntu in any sense
a program could verify beyond the files it sees and the commands that answer.
What an image actually chooses is a directory layout and a userland.

Pick one with `--image`, which defaults to `base`:

```
fernbox run ./my-app --image alpine
fernbox images                      # list them, bundled and committed
```

## How an image is defined

A directory under `runtime/images/` is one image. Everything in it becomes a flat
`{ "posix/path": "contents" }` map at build time; the directory structure is the
only authoring format.

**Inheritance.** A `fernbox.json` in the image's root declares a parent:

```json
{ "from": "base", "description": "what this image layers on and why" }
```

The parent is merged underneath, and the child wins on any path both hold — the
same ordering the daemon's volume commit uses. The manifest itself is the one file
the walker never admits into the filesystem, and the emitted map stays flat, so
**inheritance is a build-time convenience, not a runtime concept**: neither the
isolate nor the daemon knows that layers exist, and `from` leaves no trace a script
can read. A cycle is a build error.

**Two conventions every image follows.**

1. `/etc/os-release` is where an image declares itself. It is the one path an app
   can ask "which image am I on" and always get an answer, so an image that layers
   on a parent replaces the parent's copy rather than adding its own.
2. Commands are found through a fixed PATH — `/usr/local/bin`, `/usr/bin`, `/bin`,
   in that order, defined once in `runtime/src/user/commands.js` and shared by the
   shell's lookup and by `require`'s refusal. A directory that holds commands is
   never one an app imports a library from.

**One constraint worth remembering:** boot-bundle modules are inlined by esbuild,
so a file inside an image cannot `require` one by path. What an image reaches, it
reaches by builtin name (`require("shell")`) or by its own files. This is why
alpine's applets live at `/usr/lib/busybox/applets.js` rather than in a command
directory — a shim in `/bin` has to be able to require them.

---

## minimal

*The floor. Everything else stands on it, directly or through `base`.*

```
minimal
└── etc/
    └── hosts              127.0.0.1 localhost
```

No commands, no shell, no `node`-shaped entrypoints beyond what the runtime itself
provides. It exists for the cases that want a bare isolate with the API surface
available and no userland at all — the `sandbox` path, and the parent of `base`
and `alpine`.

Nothing else inherits a userland from it by accident: `alpine` layers on `minimal`
*rather than* on `base`, which is why alpine ships no inherited `/bin`.

---

## base

*The common floor: `minimal`'s `/etc`, a `/bin` of small commands, and the `fflate`
inflator `npm` needs. What a service expects to find.*

```
base
├── bin/                   twelve commands, all run through child_process
│   ├── cat.js    echo.js     ls.js       mkdir.js
│   ├── mv.js     node.js     npm.js      printenv.js
│   ├── pwd.js     rm.js      rmdir.js    sh.js
├── etc/
│   ├── hostname           fernbox
│   ├── hosts              127.0.0.1 localhost
│   ├── os-release         NAME=FernBox, ID=fernbox, VERSION_ID=0.1
│   └── resolv.conf        nameserver 127.0.53 (the virtual resolver)
└── fernbox.json           from: minimal
```

`/node_modules/fflate/index.js` is injected by the build, not checked in, because
`npm install` has to inflate a tarball and the isolate has no native zlib.

**Commands.** Each is a `{ main(args) => status }` module writing to the captured
stdout and stderr a command always writes to.

| Command | Synopsis | Notes |
| --- | --- | --- |
| `cat` | `cat [FILE]...` | reads stdin with no files; a missing file is named on stderr and fails the run without swallowing the files after it |
| `echo` | `echo [-n] [ARG]...` | `-n` is the one flag anybody reaches for |
| `ls` | `ls [-a] [-l] [PATH]...` | flags combine, so `ls -al` is not a surprise |
| `mkdir` | `mkdir [-p] DIR...` | `-p` creates parents and stays quiet about an existing dir |
| `mv` | `mv SOURCE DEST` | one rename, so no partial state a crash could leave behind |
| `pwd` | `pwd` | the virtual process has one cwd for its whole life |
| `rm` | `rm [-r] [-f] PATH...` | a directory without `-r` is refused |
| `rmdir` | `rmdir DIR...` | directories only, and only when empty |
| `printenv` | `printenv [NAME]...` | exits 1 for the first name that is not set |
| `sh` | `sh [-c LINE \| ARGS...]` | with no args, a prompt loop over stdin |
| `npm` | `npm install SPEC...` | `pkg`, `pkg@1.2.3`, `pkg@latest`. The registry is a host like any other and DNS is virtual, so it resolves only if this instance's `/etc/hosts` maps it — which `base` deliberately does not, and the app does for itself (`fixtures/apps/npm_install`) |
| `node` | — | **not implemented.** A named failure with a message saying what to expect, rather than an empty success |

**Deliberately missing from `ls`:** `.` and `..`. The virtual filesystem has no
parent links to list, and inventing them would report state that is not there.

---

## fernos

*The FernBox personality: `base` underneath, plus the small toolbox a service
needs — in `/usr/local/bin`, where a distribution puts its own commands.*

```
fernos
├── etc/
│   ├── fernbox/fernbox.conf    the image's own description, where a real machine
│   │                            keeps its boot configuration
│   ├── motd                    what an interactive shell greets
│   ├── os-release              VARIANT_ID=fernos
│   └── hostname                (inherited: fernbox)
├── usr/local/bin/              eleven commands
│   ├── cp.js    env.js    head.js   sort.js  touch.js
│   ├── grep.js  tail.js   tee.js    uname.js wc.js    whoami.js
└── fernbox.json                from: base
```

`/etc/fernbox/fernbox.conf` is the runtime-readable counterpart to the manifest:
`from` in `fernbox.json` is a build-time detail that leaves no trace, so this file
is what an app asks when it wants to know which image it is on.

**Commands.**

| Command | Synopsis | Notes |
| --- | --- | --- |
| `cp` | `cp [-r] SOURCE... DEST` | onto a directory means into it; several sources require a directory destination |
| `env` | `env [NAME=VALUE...] [COMMAND [ARG]...]` | runs the command through the shell's own runner, so it inherits the capture, cwd, and deadline |
| `grep` | `grep [-c] [-i] [-n] [-v] PATTERN [FILE]...` | pattern is a regular expression; status 1 = no match, 2 = bad pattern or unreadable file |
| `head` | `head [-n N \| --lines=N \| -N] [FILE]...` | all three spellings, the way the real one accepts them |
| `sort` | `sort [-n] [-r] [-u] [FILE]...` | lexical by default, numeric with `-n` |
| `tail` | `tail [-n N \| --lines=N \| -N] [FILE]...` | the whole file is held in memory — the batch model a pipeline already has |
| `tee` | `tee [-a] FILE...` | a failing write is reported but does not stop the stream |
| `touch` | `touch [-c] FILE...` | the fs carries no timestamps, so an existing file is left exactly as it is |
| `wc` | `wc [-l] [-w] [-c] [FILE]...` | a line is a newline; characters are utf8 units |
| `uname` | `uname [-s] [-n] [-r]` | defaults to `-s`; kernel name and release are the image's own, not a host kernel's |
| `whoami` | `whoami` | the sandbox has one identity and it is not the host user's |

**Deliberately missing:** `uname -m` would name a processor the isolate never sees.
`whoami` answers `fernbox` rather than looking up whoever happened to be running the
daemon.

---

## alpine

*The Alpine personality: a BusyBox-shaped userland of one multi-call binary behind
applet shims, and no `/usr/local/bin` at all. Built on `minimal`, so it inherits no
userland — a distribution brings its own.*

```
alpine
├── bin/
│   ├── busybox.js              the multi-call binary: `busybox APPLET [ARGS]`,
│   │                            or the applet list with no argument
│   ├── sh.js  cat.js  echo.js  ls.js  mkdir.js  rmdir.js  rm.js  mv.js
│   ├── cp.js  pwd.js  head.js  tail.js  sort.js  wc.js  grep.js  touch.js
│   └── printenv.js  true.js  false.js
├── etc/
│   ├── os-release              NAME=Alpine, ID=alpine, VERSION_ID=3.20
│   └── hostname                alpine
├── usr/lib/busybox/
│   └── applets.js              all nineteen applet implementations
└── fernbox.json                from: minimal
```

Each shim in `/bin` stands in for the symlink a real filesystem would carry from
`/bin/<applet>` to `/bin/busybox`:

```js
module.exports = { main: (args) => require("/usr/lib/busybox/applets.js").head(args) };
```

The applets live outside the command directories because a command file has to be
able to require them, and `require` refuses every directory in the PATH.

**Applets.** Nineteen, and they are the smaller versions, the way BusyBox's are:
`sh`, `echo`, `cat`, `pwd`, `true`, `false`, `ls`, `mkdir`, `rmdir`, `rm`, `mv`,
`cp`, `touch`, `head`, `tail`, `sort`, `wc`, `grep`, `printenv`. The flags each one
accepts are the common ones — `ls -a`/`-l`, `mkdir -p`, `rm -r`/`-f`, `cp -r`,
`touch -c`, `head`/`tail -n N`, `sort -r`/`-u`, `wc -l`/`-w`/`-c`,
`grep -i`/`-v`/`-n`/`-c`. Where they differ from the fernos versions, they differ
by omission: alpine's `sort` has no `-n`, its `head` and `tail` take `-n` only.

`busybox` with no argument prints the applet list; `busybox no-such-applet` is
status 127.

---

## ubuntu

*The Ubuntu personality: `base` underneath, with Ubuntu's identity files in `/etc`
and nothing else. A personality rather than a distro, stated plainly.*

```
ubuntu
├── etc/
│   ├── os-release             Ubuntu 24.04.1 LTS, noble
│   ├── lsb-release            DISTRIB_ID=Ubuntu ...
│   ├── debian_version         trixie/sid
│   ├── apt/sources.list       commented: no apt command exists
│   └── hostname               ubuntu
└── fernbox.json               from: base
```

No commands of its own — the inherited `/bin` is the whole userland, and it answers
`ls` and `sh` the way `base` does. A real Ubuntu's usrmerge would make `/bin` a
symlink to `/usr/bin`; this filesystem has no symlinks, so the inherited `/bin`
simply is that one directory.

`/etc/apt/sources.list` is a statement of which distribution the image is, and
nothing reads it: there is no `apt`, and no package manager anywhere in the
sandbox. `apt list` is status 127, the same as any command an image does not ship
— a status, not a crash.

---

## Verifying an image

`fixtures/examples/<image>/main.js` is one app per image that runs every command
that image ships once and checks the answer — the flags it documents, the exit
codes it returns, and the inheritance it stands on. A failed check is recorded
rather than thrown, so one bad command does not hide the rest of the report.

```
fernbox run fixtures/examples/alpine --image alpine
```

The completion value is `{"image", "checks", "passed", "failures"}`, and stdout is
one `ok`/`FAIL` line per check. These examples are what caught alpine's applets
matching flag bundles as whole words: `ls -al` silently returned a plain listing
with no error, because `-al` was neither `-a` nor `-l`.

---

## Committed images

`fernbox commit <volume> <image> [--from <base>]` freezes a volume over a base
image into a new one, written to the state directory rather than bundled into the
binary. A committed image shadows a bundled one of the same name, so
`fernbox commit data base` replaces `base` for every run against that state
directory — the caller's filesystem, the caller's trust decision.
