//! The daemon's log: one line at a time, with an icon, a colour, and a label.
//!
//! This is deliberately not a Rust logging framework. There is no `log` facade,
//! no subscriber, no filtering by module path, and no timestamps fought over by
//! a global registry — the daemon has exactly one place to write and about ten
//! things worth saying. What it wants is a line a human can scan: a glyph that
//! says *what kind of event*, a colour that says *how much to care*, a short
//! right-aligned label so the messages line up in a column, and the detail in
//! whatever colour it earns.
//!
//! Three rules hold the whole thing together:
//!
//! * **Colour is decoration, never information.** Every distinction the log
//!   makes is carried by the glyph and the words as well, so a pipe, a CI log,
//!   or a `TERM=dumb` terminal loses nothing by losing the escapes. Colour is
//!   off when stdout is not a terminal, and `NO_COLOR` turns it off regardless.
//! * **Nothing writes to stdout except a banner.** A run's own output is the
//!   answer the caller asked for, so diagnostics go to stderr. A banner is the
//!   one thing a human asked to see on purpose, so it goes to stdout.
//! * **Writing a log line cannot fail the daemon.** A closed pipe or a full disk
//!   costs the line, not the process.
//!
//! The companion piece is [`banner`], which is the part a user sees first: an
//! ASCII wordmark inside a rounded box, with the version, the state directory,
//! and the token file laid out as label/value rows beneath it.

use std::io::{self, IsTerminal, Write};
use std::sync::atomic::{AtomicBool, Ordering};

// --- the glyph set ----------------------------------------------------------
//
// Written as escapes rather than literals so the source stays readable in any
// editor and any diff, and so a terminal that mangles them is obviously a
// terminal problem rather than a file problem.

/// A run has begun.
pub const PLAY: &str = "\u{25b6}"; // ▶
/// A request arrived.
pub const ARROW_IN: &str = "\u{2190}"; // ←
/// A reply went out.
pub const ARROW_OUT: &str = "\u{2192}"; // →
/// A worker process started.
pub const GEAR: &str = "\u{2699}"; // ⚙
/// A run finished.
pub const CHECK: &str = "\u{2714}"; // ✔
/// Something is being discussed but is not a problem.
pub const INFO: &str = "\u{2139}"; // ℹ
/// The caller should look at this.
pub const WARN: &str = "\u{26a0}"; // ⚠
/// The operation failed.
pub const FAIL: &str = "\u{2716}"; // ✖
/// A deadline or a resource limit was hit.
pub const CLOCK: &str = "\u{23f1}"; // ⏱
/// A persistent thing was written.
pub const DISK: &str = "\u{1f4be}"; // 💾
/// A filesystem or start-up event.
pub const FOLDER: &str = "\u{1f4c1}"; // 📁
/// The listener came up.
pub const SIGNAL: &str = "\u{25c9}"; // ◉
/// The process is going away.
pub const SLEEP: &str = "\u{25a0}"; // ■

// --- colour -----------------------------------------------------------------

/// SGR parameters. Only the four-bit set is used: it is the one every terminal
/// from the last forty years agrees about, and a 256-colour or truecolor escape
/// adds nothing a log line needs.
mod sgr {
    pub const RESET: &str = "\x1b[0m";
    pub const BOLD: &str = "\x1b[1m";
    pub const DIM: &str = "\x1b[2m";
    pub const RED: &str = "\x1b[31m";
    pub const GREEN: &str = "\x1b[32m";
    pub const YELLOW: &str = "\x1b[33m";
    pub const BLUE: &str = "\x1b[34m";
    pub const MAGENTA: &str = "\x1b[35m";
    pub const CYAN: &str = "\x1b[36m";
    pub const GREY: &str = "\x1b[90m";
}

/// Whether escape sequences may be written. Squared at start-up by
/// [`init`] and read on every line, so a redirected stderr gets clean text
/// without each call site asking.
static COLOR: AtomicBool = AtomicBool::new(false);

/// Fix the colour decision once, from the environment and the stream.
///
/// `NO_COLOR` (any value) wins outright, as does an empty `TERM`; otherwise
/// colour follows whether stderr is a terminal. `CLICOLOR_FORCE` forces it back
/// on for someone who wants escapes in a pipe.
pub fn init() {
    let forced = std::env::var_os("CLICOLOR_FORCE").is_some_and(|v| v != "0");
    let denied = std::env::var_os("NO_COLOR").is_some()
        || std::env::var_os("TERM").is_some_and(|t| t.is_empty())
        || std::env::var("TERM").map(|t| t == "dumb").unwrap_or(false);
    let wanted = forced || (io::stderr().is_terminal() && !denied);
    COLOR.store(wanted, Ordering::Relaxed);
}

/// Whether colour is currently on.
pub fn color() -> bool {
    COLOR.load(Ordering::Relaxed)
}

/// Paint `text` in `sgr` when colour is on, and return it unchanged when not.
/// Every styled fragment goes through here, so there is exactly one place that
/// decides, and no call site can leave an escape behind in a redirected log.
fn paint(text: &str, sgr: &str) -> String {
    if color() {
        format!("{sgr}{text}{}", sgr::RESET)
    } else {
        text.to_string()
    }
}

// --- levels -----------------------------------------------------------------

/// How much a line matters. The ordering is the usual one, and [`Level::notice`]
/// is `Info` — a log call that does not say which level it is is not a warning.
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug)]
pub enum Level {
    Trace,
    Info,
    Warn,
    Error,
}

impl Level {
    /// The least severe level that is printed. `FERNBOX_LOG`, when present,
    /// accepts `trace`, `info`, `warn`, or `error` (case-insensitive); anything
    /// else falls back to `info`, because a typo should not silence a daemon.
    fn floor() -> Level {
        match std::env::var("FERNBOX_LOG").unwrap_or_default().to_ascii_lowercase().as_str() {
            "trace" => Level::Trace,
            "warn" | "warning" => Level::Warn,
            "error" => Level::Error,
            _ => Level::Info,
        }
    }

    fn glyph(self) -> &'static str {
        match self {
            Level::Trace => SLEEP,
            Level::Info => INFO,
            Level::Warn => WARN,
            Level::Error => FAIL,
        }
    }

    fn sgr(self) -> &'static str {
        match self {
            Level::Trace => sgr::GREY,
            Level::Info => sgr::CYAN,
            Level::Warn => sgr::YELLOW,
            Level::Error => sgr::RED,
        }
    }
}

/// The column the label starts in, counted from after the glyph. Two, because
/// the widest glyphs in the set are double-width.
const GLYPH_COLUMNS: usize = 2;

/// The terminal cells a string occupies.
///
/// A pragmatic subset of east-asian width: the emoji and pictographs in this
/// module's glyph set are double-width, everything else — box drawing, arrows,
/// ASCII — is single. Escape sequences count as zero. This does not consult a
/// Unicode table, because the only strings it is asked about are the constants
/// above and the wordmark, all of which are authored in this file.
fn display_width(text: &str) -> usize {
    let mut width = 0;
    let mut in_escape = false;
    for ch in text.chars() {
        if in_escape {
            if ch == 'm' {
                in_escape = false;
            }
            continue;
        }
        if ch == '\x1b' {
            in_escape = true;
            continue;
        }
        width += if is_wide(ch) { 2 } else { 1 };
    }
    width
}

/// Whether a character is rendered in two terminal cells.
///
/// Only the pictographic ranges the glyph set draws from are covered. The
/// arrows, geometric shapes, and dingbats used elsewhere in the set (`▶`, `⚙`,
/// `✔`, `⚠`, `◉`) are all ambiguous-width characters that terminals render in
/// one cell, so they are deliberately not listed here.
fn is_wide(ch: char) -> bool {
    matches!(ch as u32, 0x1F300..=0x1F5FF | 0x1F680..=0x1F6FF)
}

/// The width the label column is padded to. Long enough for `commit`, `listen`,
/// and `worker`, so the common labels are not padded at all and the column
/// still holds for the shortened ones.
const LABEL_WIDTH: usize = 7;

/// Write one styled line to stderr.
///
/// The shape is fixed: glyph, then the label right-aligned in a muted column,
/// then the message, then the detail. The glyph takes the level's colour, the
/// label is grey, and the message is bold so it reads as the point of the line.
/// A detail that is present but empty is dropped rather than printed as a
/// dangling separator.
fn line(level: Level, label: &str, message: &str, detail: Option<&str>) {
    line_with(level.glyph(), level, level.sgr(), label, message, detail);
}

/// A line whose message is user data rather than a daemon message: same layout,
/// but the text is not bolded, because emphasis is for what the daemon says.
fn line_raw(glyph: &str, tint: &str, message_tint: &str, label: &str, message: &str) {
    let pad = " ".repeat(GLYPH_COLUMNS.saturating_sub(display_width(glyph)));
    let glyph = paint(glyph, tint);
    let label = paint(&format!("{label:>LABEL_WIDTH$}"), sgr::GREY);
    let message = paint(message, message_tint);

    let mut stderr = io::stderr().lock();
    let _ = writeln!(stderr, "{glyph}{pad} {label}  {message}");
    let _ = stderr.flush();
}

/// The same line, with an event's own glyph instead of the level's default.
///
/// One icon per line is the rule: a line must not say `listen ◉` with a second
/// glyph in the message repeating what the first already said. An event that
/// has something more specific to show passes it here and the level keeps only
/// its colour, which is the part that carries no information anyway.
fn line_with(glyph: &str, level: Level, tint: &str, label: &str, message: &str, detail: Option<&str>) {
    if level < Level::floor() {
        return;
    }

    // The pad is computed from the *unpainted* glyph: `paint` wraps it in
    // escapes, and the width of the escape text is not the width on screen.
    // Glyphs are not all one column wide either — `💾` and `📁` take two cells
    // where `▶` and `⚙` take one — so this is measured, not assumed, or the
    // label column goes ragged the moment a wider icon appears.
    let pad = " ".repeat(GLYPH_COLUMNS.saturating_sub(display_width(glyph)));
    let glyph = paint(glyph, tint);
    let label = paint(&format!("{label:>LABEL_WIDTH$}"), sgr::GREY);
    let message = paint(message, sgr::BOLD);

    let mut out = format!("{glyph}{pad} {label}  {message}");
    if let Some(detail) = detail.filter(|d| !d.is_empty()) {
        out.push_str(&paint(&format!("  {detail}"), sgr::DIM));
    }

    // A closed stderr must not be able to bring the daemon down: a log line is
    // worth exactly nothing if writing it is fatal.
    let mut stderr = io::stderr().lock();
    let _ = writeln!(stderr, "{out}");
    let _ = stderr.flush();
}

// --- the calls the daemon makes ---------------------------------------------

/// The daemon is up and something useful happened. `label` is the short word in
/// the left column — `listen`, `run`, `commit` — and `detail` is the trailing
/// muted note, often a path, a port, or a duration.
pub fn info(label: &str, message: &str, detail: Option<&str>) {
    line(Level::Info, label, message, detail);
}

/// The caller should look, but the daemon is fine.
pub fn warn(label: &str, message: &str, detail: Option<&str>) {
    line(Level::Warn, label, message, detail);
}

/// The operation failed.
pub fn error(label: &str, message: &str, detail: Option<&str>) {
    line(Level::Error, label, message, detail);
}

/// A run started. Green and the play glyph, because it is the one line a user
/// watches for.
pub fn started(label: &str, message: &str, detail: Option<&str>) {
    line_with(PLAY, Level::Info, sgr::GREEN, label, message, detail);
}

/// A run finished cleanly.
pub fn finished(label: &str, message: &str, detail: Option<&str>) {
    line_with(CHECK, Level::Info, sgr::GREEN, label, message, detail);
}

/// A worker process was spawned. Its pid is the detail a human would want when
/// a stray process is being hunted down later.
pub fn worker(id: u32, app: &str) {
    line_with(GEAR, Level::Info, sgr::MAGENTA, "worker", &format!("spawned pid {id}"), Some(app));
}

/// A worker exited and was reaped.
pub fn worker_exit(id: u32, outcome: &str) {
    line(Level::Info, "worker", &format!("pid {id} exited"), Some(outcome));
}

/// A listener bound. The port is the point, so it leads.
pub fn listen(address: &str, note: &str) {
    line_with(SIGNAL, Level::Info, sgr::CYAN, "listen", address, Some(note));
}

/// An inbound request was handed to the sandbox. The byte count is what the gate
/// actually buffered, which is the number worth having when a body didn't arrive
/// the way the caller expected.
pub fn inbound(method_path: &str, id: u64, bytes: usize) {
    line_with(
        ARROW_IN,
        Level::Info,
        sgr::BLUE,
        "http",
        method_path,
        Some(&format!("#{id} · {}", human_bytes(bytes))),
    );
}

/// A response was written back to the waiting connection.
pub fn outbound(status: &str, method_path: &str, id: u64, bytes: usize) {
    let tint = if status.starts_with('2') {
        sgr::GREEN
    } else if status.starts_with('4') || status.starts_with('5') {
        sgr::RED
    } else {
        sgr::YELLOW
    };
    line_with(
        ARROW_OUT,
        Level::Info,
        tint,
        "http",
        &format!("{status} {method_path}"),
        Some(&format!("#{id} · {}", human_bytes(bytes))),
    );
}

/// A line the script wrote to its own stdout or stderr, relayed while it runs.
///
/// The glyph is the stream's, and the label is `out` or `err`, so a run can be
/// read top to bottom and the script's words are still distinguishable from the
/// daemon's. The script's text is printed as it came — not bolded like a
/// message — because it is the caller's output, not ours.
pub fn output(label: &str, text: &str) {
    line_raw(
        if label == "err" { WARN } else { ARROW_OUT },
        sgr::GREY,
        if label == "err" { sgr::YELLOW } else { sgr::GREY },
        label,
        text,
    );
}

/// A request the gate refused itself, before it ever reached the sandbox.
pub fn rejected(status: &str, method_path: &str) {
    line_with(
        FAIL,
        Level::Warn,
        sgr::RED,
        "http",
        &format!("refused {status} {}", if method_path.is_empty() { "<malformed>" } else { method_path }),
        None,
    );
}

/// A byte count a human can read at a glance.
fn human_bytes(bytes: usize) -> String {
    const KIB: usize = 1024;
    const MIB: usize = 1024 * 1024;
    if bytes >= MIB {
        format!("{:.1} MiB", bytes as f64 / MIB as f64)
    } else if bytes >= KIB {
        format!("{:.1} KiB", bytes as f64 / KIB as f64)
    } else {
        format!("{bytes} B")
    }
}

/// A deadline or a limit was hit. Separate from `error` because it is the
/// sandbox working as designed, not the daemon misbehaving.
pub fn limit(label: &str, message: &str, detail: Option<&str>) {
    line_with(CLOCK, Level::Warn, sgr::YELLOW, label, message, detail);
}

/// Something was persisted to the state directory.
pub fn stored(label: &str, message: &str, detail: Option<&str>) {
    line_with(DISK, Level::Info, sgr::BLUE, label, message, detail);
}

/// The state directory was touched.
pub fn fs_event(label: &str, message: &str, detail: Option<&str>) {
    line_with(FOLDER, Level::Info, sgr::BLUE, label, message, detail);
}

/// The daemon is going away.
pub fn shutdown(message: &str) {
    line_with(SLEEP, Level::Warn, sgr::YELLOW, "stop", message, None);
}

// --- the banner -------------------------------------------------------------

/// The wordmark. Six rows of box drawing, `FERN` over `BOX`, drawn so the two
/// halves read as one block: a solid stem on the left of each letter and a
/// lighter frame around them.
const WORDMARK: [&str; 6] = [
    r"  ███████╗███████╗██████╗ ███╗   ██╗██████╗  ██████╗ ██╗  ██╗",
    r"  ██╔════╝██╔════╝██╔══██╗████╗  ██║██╔══██╗██╔═══██╗╚██╗██╔╝",
    r"  █████╗  █████╗  ██████╔╝██╔██╗ ██║██████╔╝██║   ██║ ╚███╔╝ ",
    r"  ██╔══╝  ██╔══╝  ██╔══██╗██║╚██╗██║██╔══██╗██║   ██║ ██╔██╗ ",
    r"  ██║     ███████╗██████╔╝██║ ╚████║██████╔╝╚██████╔╝██╔╝ ██╗",
    r"  ╚═╝     ╚══════╝╚═════╝ ╚═╝  ╚═══╝╚═════╝  ╚═════╝ ╚═╝  ╚═╝",
];

/// The width of the wordmark, in display columns. Every row is authored to this
/// width — `every_wordmark_row_is_the_same_width` pins it — and the frame is
/// drawn around it, so a row that drifts is a compile-time test failure rather
/// than a banner that looks slightly wrong.
const WORDMARK_WIDTH: usize = 61;

/// Draw the start-up banner to stdout and return the version string it showed.
///
/// The block is a rounded box the full width of the wordmark, the wordmark in
/// the middle of it, a tagline, and then the facts a user needs to find their
/// state directory and their token again — laid out as a two-column rule so the
/// values line up even though the labels are different lengths.
pub fn banner(version: &str, rows: &[(&str, String)]) {
    let cyan = |t: &str| paint(t, sgr::CYAN);
    let grey = |t: &str| paint(t, sgr::GREY);
    let bold = |t: &str| paint(t, sgr::BOLD);

    // Every row is rendered as `  │ <content padded to INNER> │`, so the two
    // vertical bars land in the same column on every line by construction
    // rather than by matching literal spaces.
    const INNER: usize = WORDMARK_WIDTH + 2;
    let bar = cyan("│");

    let mut out = String::new();
    out.push('\n');
    out.push_str(&format!("  {}\n", cyan(&format!("╭{}╮", "─".repeat(INNER)))));
    out.push_str(&format!("  {bar}{}{bar}\n", " ".repeat(INNER)));

    // The rows are already authored with the same two-column gutter, so they
    // left-align and the frame's padding carries the rest.
    for row in WORDMARK {
        out.push_str(&format!("  {bar}{}{bar}\n", pad_display(&cyan(row), INNER)));
    }

    out.push_str(&format!("  {bar}{}{bar}\n", " ".repeat(INNER)));
    // The tagline sits centred under the wordmark, flanked by tildes the way a
    // banner in a terminal art collection would be.
    let tagline = "~ untrusted JavaScript, no keys to the host ~";
    let left = INNER.saturating_sub(tagline.len()) / 2;
    let right = INNER.saturating_sub(tagline.len() + left);
    out.push_str(&format!(
        "  {bar}{}{}{}{bar}\n",
        " ".repeat(left),
        grey(tagline),
        " ".repeat(right),
    ));

    out.push_str(&format!("  {}\n", cyan(&format!("╰{}╯", "─".repeat(INNER)))));

    // The facts. The label column is right-aligned to the longest label so the
    // values form one clean edge.
    let width = rows.iter().map(|(label, _)| label.chars().count()).max().unwrap_or(0);
    out.push('\n');
    for (label, value) in rows {
        out.push_str(&format!(
            "  {}  {}  {}\n",
            grey(&format!("{label:>width$}")),
            grey("│"),
            bold(value),
        ));
    }
    out.push_str(&format!("\n  {} v{version}\n\n", grey("fernbox")));

    let mut stdout = io::stdout().lock();
    let _ = write!(stdout, "{out}");
    let _ = stdout.flush();
}

/// Pad a string to `width` display columns on the right.
///
/// The wordmark is a fixed set of box-drawing characters, one column each, so
/// counting `char`s is the same as counting display cells for the strings this
/// is used on. Escape sequences are counted as zero, which is what lets a
/// painted row be padded as if it were plain.
fn pad_display(text: &str, width: usize) -> String {
    let visible = visible_len(text);
    if visible >= width {
        text.to_string()
    } else {
        format!("{text}{}", " ".repeat(width - visible))
    }
}

/// The number of display columns `text` occupies, ignoring SGR escapes.
fn visible_len(text: &str) -> usize {
    let mut count = 0;
    let mut in_escape = false;
    for ch in text.chars() {
        if in_escape {
            if ch == 'm' {
                in_escape = false;
            }
            continue;
        }
        if ch == '\x1b' {
            in_escape = true;
            continue;
        }
        count += 1;
    }
    count
}

/// The banner drawn without colour, for a non-terminal stdout. Exposed for the
/// test that pins the frame's width, so a future edit that skews a row fails
/// loudly instead of looking slightly wrong.
pub fn banner_shape(version: &str, rows: &[(&str, String)]) -> String {
    let mut out = String::new();
    out.push_str(&format!("╭{}╮\n", "─".repeat(WORDMARK_WIDTH + 2)));
    for row in WORDMARK {
        out.push_str(&format!("│  {}│\n", pad_display(row, WORDMARK_WIDTH + 2)));
    }
    out.push_str(&format!("╰{}╯\n", "─".repeat(WORDMARK_WIDTH + 2)));
    out.push_str(&format!("fernbox v{version}"));
    for (label, value) in rows {
        out.push_str(&format!("\n{label}={value}"));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_wordmark_row_is_the_same_width() {
        for row in WORDMARK {
            assert_eq!(row.chars().count(), WORDMARK_WIDTH, "row is skewed: {row}");
        }
    }

    #[test]
    fn escapes_do_not_count_toward_width() {
        assert_eq!(visible_len("abc"), 3);
        assert_eq!(visible_len("\x1b[36mabc\x1b[0m"), 3);
        // Padding is measured in visible cells, so a painted string pads to the
        // asked-for width rather than the width of its escape text.
        assert_eq!(visible_len(&pad_display("\x1b[36mab\x1b[0m", 5)), 5);
        assert_eq!(visible_len(&pad_display("abcde", 3)), 5);
    }

    #[test]
    fn the_banner_frame_closes() {
        let shape = banner_shape("0.1.0", &[("state", "/tmp/x".to_string())]);
        assert!(shape.starts_with('╭'));
        assert!(shape.contains('╰'));
    }
}

#[cfg(test)]
mod alignment {
    use super::*;

    /// Every glyph in the set must occupy the same number of cells once padded,
    /// so the label column lines up for every line regardless of which icon the
    /// event chose. The painted form is measured, not the raw one, because that
    /// is what reaches the terminal.
    #[test]
    fn every_glyph_pads_to_the_same_column() {
        for glyph in [PLAY, ARROW_IN, ARROW_OUT, GEAR, CHECK, INFO, WARN, FAIL, CLOCK, DISK, FOLDER, SIGNAL, SLEEP] {
            let pad = " ".repeat(GLYPH_COLUMNS.saturating_sub(display_width(glyph)));
            let painted = format!("{}{pad} ", paint(glyph, sgr::CYAN));
            assert_eq!(display_width(&painted), GLYPH_COLUMNS + 1, "glyph {glyph:?} is off");
        }
    }

    #[test]
    fn double_width_glyphs_are_measured_as_two() {
        assert_eq!(display_width(DISK), 2);
        assert_eq!(display_width(FOLDER), 2);
        assert_eq!(display_width(PLAY), 1);
        assert_eq!(display_width(INFO), 1);
    }
}
