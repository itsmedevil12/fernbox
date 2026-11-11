// The virtual fs round trip: write, read back, and list.
// If the sandbox is working, this is the only way to touch a file.
const written = fernbox.write("/tmp/note.txt", "hello from the sandbox");
const back = fernbox.read("/tmp/note.txt");
const listing = fernbox.list();

JSON.stringify({ written, back, hasNote: listing.includes("/tmp/note.txt") });
