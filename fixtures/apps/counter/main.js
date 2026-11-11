// Exercises the app layer, the base image layer, and a persistent volume in
// one run:
//   - `/lib/greet.js` is this folder's own file, so reading it proves the app
//     layer loaded.
//   - `/etc/hosts` comes from the base image, so reading it proves the layer
//     underneath is still there.
//   - `/data/count` is the volume, so its value across two runs proves the
//     mount subtree survives.
const source = fernbox.read("/lib/greet.js");
if (source === null) throw new Error("/lib/greet.js is missing from the app layer");
const greet = new Function(`${source}\nreturn greet;`)();

const hosts = fernbox.read("/etc/hosts");
if (hosts === null) throw new Error("/etc/hosts is missing from the base image");

const previous = Number(fernbox.read("/data/count") ?? 0);
const next = previous + 1;
fernbox.write("/data/count", String(next));
fernbox.write("/data/sub/nested", "written into the mount subtree");

`${greet(`run ${next}`)}; hosts=${hosts.trim().split("\n")[0]}; count=${next}`;
