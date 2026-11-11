// `echo`. The whole command is joining arguments, and `-n` is the one flag
// anybody reaches for.
module.exports = {
  main(args) {
    let newline = true;
    const words = [];
    for (const arg of args) {
      if (arg === "-n" && words.length === 0) {
        newline = false;
        continue;
      }
      words.push(arg);
    }
    const line = words.join(" ");
    if (newline) process.stdout.write(`${line}\n`);
    else process.stdout.write(line);
    return 0;
  },
};
