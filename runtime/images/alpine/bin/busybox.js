// `busybox`, the multi-call binary: every applet in one file, reached by name.
// An applet named on the command line runs with the arguments that follow it,
// which is how a real BusyBox answers a symlink it was invoked through.
const applets = require("/usr/lib/busybox/applets.js");

module.exports = {
  main(args) {
    const [name, ...rest] = args;
    if (!name) {
      process.stdout.write(`BusyBox v0.1 (FernBox) multi-call binary.\n\nUsage: busybox APPLET [ARGS]\n\nApplets:\n${Object.keys(applets).sort().map((a) => `  ${a}`).join("\n")}\n`);
      return 0;
    }
    const applet = applets[name];
    if (!applet) {
      process.stderr.write(`busybox: applet not found: ${name}\n`);
      return 127;
    }
    return applet(rest);
  },
};
