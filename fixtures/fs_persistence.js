// Two runs share one isolate. The second must see what the first wrote:
// the virtual fs lives in the system context, which outlives each run.
const before = fernbox.read("/tmp/persistent.txt");
fernbox.write("/tmp/persistent.txt", "run two sees this");
const after = fernbox.read("/tmp/persistent.txt");

JSON.stringify({ before: before === null ? "null" : before, after });
