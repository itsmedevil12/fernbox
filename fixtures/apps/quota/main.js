// Writes past the volume quota on purpose, into one of two attached volumes.
// The run itself succeeds — the writes happen inside the isolate — but storing
// the volumes back to disk must refuse the oversized map rather than truncate
// it. Because every volume is sized before any is written, the well-behaved
// one is left untouched on disk too, so the whole set stays consistent.
fernbox.write("/ok/small", "this one fits");
fernbox.write("/data/too_big", "x".repeat(17 * 1024 * 1024));
"wrote a small file and 17MiB into two volumes";
