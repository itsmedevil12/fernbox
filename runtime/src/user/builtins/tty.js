// The `tty` builtin. There is no terminal in the sandbox: `isatty` answers
// false, which is what every color/progress library checks before decorating
// its output, and the stream classes are refused if anyone tries to open one.
import tty from "tty";

export const isatty = () => false;
export const ReadStream = tty.ReadStream;
export const WriteStream = tty.WriteStream;

export default { ...tty, isatty };
