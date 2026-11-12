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

## Built images: the FernBoxfile

The five images above are compiled into the binary, so adding one means rebuilding
Rust. A **FernBoxfile** is the way to make an image without a compiler: a text file
of keywords in a folder, built into the state directory.

```
# FernBoxfile
FROM base
WORKDIR /app
ENV NODE_ENV=production
COPY ./src /app
COPY ./config.json /app/config.json
CMD /app/main.js
```

```
fernbox build -f FernBoxfile -t my-app
fernbox run ./anywhere --image my-app --entrypoint /app/main.js
```

The six keywords are the whole language:

| Keyword | Meaning |
| --- | --- |
| `FROM <image>` | the image to layer on; required, exactly once. A bundled name or one built earlier |
| `COPY <host> <image>` | copy a file or directory tree in. The source stays inside the build context |
| `RUN <command>` | execute a shell command during the build |
| `ENV <KEY>=<value>` | an environment default; `ENV KEY value` also works |
| `CMD <path>` | the entrypoint a run uses when none is given |
| `WORKDIR <path>` | recorded for reference; the runtime has no `cd` |

**`COPY` respects ignore files.** A `COPY` of a directory applies that directory's
`.gitignore`, and then its `.fernboxignore`. A context that ignores `node_modules`
does not copy it; a project that wants something back can re-include it in
`.fernboxignore` without editing the file its VCS owns. The rules are the subset of
git's that a build uses: `!` negation, `*`, `?`, `[...]`, `**`, a trailing `/` for
directories only, a pattern with no `/` matching a name at any depth, and one with
a `/` anchored to the root. Both ignore files are themselves never copied in, the
same way git never tracks them.

Two limitations worth knowing. The rules are read once from the **copied**
directory, not from the build context above it, so `COPY ./src /app` honours
`src/.gitignore` and not the context's — which is what git does within a submodule
and what surprises people least. And a file inside an excluded directory cannot be
re-included, exactly as in git.

**`RUN` is sandboxed.** A build step boots a real worker with the image built so
far mounted at `/` as a volume, runs the command through the image's own shell,
and takes the resulting filesystem as the next layer. That means a step gets:

- no network, unless the build's `NetPolicy` grants it (it does not, by default);
- a 120-second deadline, so a hanging command fails the build rather than the
  terminal;
- 256 MiB of heap;
- the build's own `ENV`, so `ENV NODE_ENV=production` before a `RUN` is what the
  step sees.

It cannot do anything at build time that the same command could not do at run
time. That equivalence is the only reason `RUN` is acceptable: the trust story is
unchanged. A failing step fails the build and writes no image at all, and the
scratch volume it borrowed is deleted — including on failure.

Ordinary proof that it works:

```dockerfile
FROM base
COPY ./src /app
RUN mkdir -p /node_modules/dep && cat /app/vendor/dep.js > /node_modules/dep/index.js
ENV NODE_ENV=production
CMD /app/main.js
```

The image then contains the dependency, and a run against an empty folder resolves
it with no `node_modules` on the host.

Note that `base` ships no `cp` — use `cat ... >` or pick an image that has one
(`fernos` puts `cp` in `/usr/local/bin`).

**Rules the parser enforces**, each because the failure it prevents is confusing
rather than because it is tidy:

- *Unknown keywords are errors naming the line.* A typo'd `COPY` silently ignored
  produces an image missing files, and the failure surfaces later as an `ENOENT`
  in a script.
- *`COPY` sources are contained.* A source must resolve inside the build context,
  checked both lexically (no `..`) and after canonicalising, so a symlink cannot
  walk out either. A build file is shared code and must not be able to read the
  host.
- *`COPY` destinations are absolute and free of `..`.* They become real paths
  under `images/<tag>/`, and a `..` there would escape the image.
- *Later keywords win.* `ENV` twice sets the second value; a `COPY` onto an
  existing path replaces it. The same overwrite-in-order rule `commit` uses.

**`CMD` and `ENV` need somewhere to live.** An image is a bare `{path: contents}`
map and anything inside the directory would be a file in the sandbox, so what the
build declares about *running* is written beside the image as
`images/<tag>.meta.json` — a sibling file, which `list_dirs` never mistakes for an
image. A run merges that metadata under whatever the caller passed, so `--env`
overrides the build file's default and the caller keeps the last word.

**Running from the image alone.** A run normally reads its entrypoint from the app
folder on the host. When that file is not there, the daemon falls back to the
image's copy — which is what makes `fernbox run ./empty --image my-app` work at
all. A file in the app folder still wins, because that layer sits on top of the
image in the seed; the app folder is a per-run override.

**A rebuild replaces.** `write_image` clears the image directory first, so a file
dropped from the FernBoxfile does not survive into the next build. An image is
meant to be exactly what its build file says.

---

## Committed images

`fernbox commit <volume> <image> [--from <base>]` freezes a volume over a base
image into a new one, written to the state directory rather than bundled into the
binary. A committed image shadows a bundled one of the same name, so
`fernbox commit data base` replaces `base` for every run against that state
directory — the caller's filesystem, the caller's trust decision.
