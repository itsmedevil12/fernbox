// The directories the shell searches for a command, in order. This is the
// sandbox's PATH, fixed rather than configured: an image ships its commands in
// whichever of these it likes — `base` uses `/bin`, the others `/usr/bin` and
// `/usr/local/bin` — and the lookup finds them wherever they are, the way a real
// PATH hides the layout difference between distributions.
//
// `require` refuses every directory in this list, so the list lives here where
// the two checks share one source of truth: a directory that holds commands must
// never be one an app imports a library from.
export const COMMAND_DIRS = ["/usr/local/bin", "/usr/bin", "/bin"];
