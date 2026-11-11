// Part of the app layer: readable at the path it has on disk. Written as a
// plain script because the sandbox has no module loader — files are text, and
// main.js evaluates this one itself.
function greet(name) {
  return `hello ${name} from the app layer`;
}
