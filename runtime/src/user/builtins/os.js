// The `os` builtin: constants and nothing that reaches the host. Every value
// describes the virtual machine, which is the only machine an app can ask
// about — the real one is none of its business. `release`/`arch` describe the
// image's Linux ABI, which is what dependency feature-detection reads them for.

export const platform = "linux";
export const EOL = "\n";

export function homedir() {
  return "/";
}

export function tmpdir() {
  return "/tmp";
}

export function hostname() {
  return "localhost";
}

export function type() {
  return "Linux";
}

export function release() {
  return "0.0.0";
}

export function version() {
  return "#1 FernBox";
}

export function arch() {
  return "x64";
}

export function machine() {
  return "x86_64";
}

export function endianness() {
  return "LE";
}

export function cpus() {
  return [
    {
      model: "FernBox virtual CPU",
      speed: 0,
      times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 },
    },
  ];
}

export function totalmem() {
  return 0;
}

export function freemem() {
  return 0;
}

export function uptime() {
  return 0;
}

export function loadavg() {
  return [0, 0, 0];
}

export function networkInterfaces() {
  return {};
}

export function userInfo() {
  return { uid: 1000, gid: 1000, username: "fernbox", homedir: "/", shell: "/bin/sh" };
}

export const constants = {
  signals: {
    SIGHUP: 1,
    SIGINT: 2,
    SIGKILL: 9,
    SIGTERM: 15,
  },
  errno: {},
};
