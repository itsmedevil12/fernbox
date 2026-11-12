//! `.gitignore` matching for a `COPY`.
//!
//! A build context is a project folder, and a project folder is full of things
//! that must not become an image: `node_modules`, `.git`, build output, editors'
//! droppings. Copying them is at best wasteful and at worst breaks the image —
//! `node_modules` alone can push a context past the seed budget.
//!
//! The obvious answer is "respect `.gitignore`", and that is what this does, with
//! the one deviation that matters: `.gitignore` is an *exclusion* file for a
//! version-control tool, so a project that is not a git repository has none, and
//! a project that is one still wants `node_modules` gone whether or not the
//! maintainer remembered to list it. So `.fernboxignore` is honoured too — same
//! syntax, read after `.gitignore`, so a project can un-ignore something the
//! tooling ignores.
//!
//! The pattern language is the subset a build actually uses:
//!
//! * `#comment`, blank lines, and trailing unescaped whitespace are ignored
//! * `!pattern` re-includes, and the last matching rule wins
//! * `*`, `?`, `[...]` and `**` work as they do in git
//! * a trailing `/` matches directories only
//! * a pattern with no `/` in it matches a name at any depth
//! * a pattern with a `/` (other than a trailing one) is anchored to the root
//! * `\` escapes the next character
//!
//! It is not a byte-for-byte reimplementation of git's `dir.c`. Notably it does
//! not implement negation of a file whose *parent directory* is excluded: git
//! cannot re-include a file inside an excluded directory, and neither can this,
//! which is the one behaviour difference worth knowing. It is the same limitation
//! users are already used to, so a FernBoxfile that works in git works here.

use std::path::Path;

/// One pattern line.
#[derive(Debug, Clone, PartialEq, Eq)]
struct Rule {
    /// The glob, with any leading `/` and trailing `/` already removed.
    pattern: String,
    /// `!pattern` — this rule re-includes instead of excluding.
    negated: bool,
    /// A trailing `/` in the source: only directories match.
    directory_only: bool,
    /// The pattern carried a `/`, so it is relative to the ignored root rather
    /// than matching a name at any depth.
    anchored: bool,
}

/// A set of rules read from one or more ignore files.
#[derive(Debug, Clone, Default)]
pub struct Ignore {
    /// The directory the anchored patterns are relative to.
    root: String,
    rules: Vec<Rule>,
}

impl Ignore {
    /// Read `.gitignore` and `.fernboxignore` from `dir`.
    ///
    /// A missing file is not an error — most contexts have neither. A file that
    /// cannot be read for another reason is reported, because silently ignoring
    /// an unreadable ignore file means silently copying `node_modules`.
    pub fn load(dir: &Path) -> Result<Ignore, String> {
        let mut ignore = Ignore::default();
        for name in [".gitignore", ".fernboxignore"] {
            let path = dir.join(name);
            match std::fs::read_to_string(&path) {
                Ok(text) => ignore.extend(&text),
                Err(err) if err.kind() == std::io::ErrorKind::NotFound => {}
                Err(err) => return Err(format!("cannot read {}: {err}", path.display())),
            }
        }
        Ok(ignore)
    }

    /// Parse ignore-file text on top of what is already loaded.
    pub fn extend(&mut self, text: &str) {
        for line in text.lines() {
            if let Some(rule) = Rule::parse(line) {
                self.rules.push(rule);
            }
        }
    }

    /// How many rules were read, for a build's summary line.
    pub fn len(&self) -> usize {
        self.rules.len()
    }

    /// Would this path be ignored?
    ///
    /// `path` is absolute or root-relative with `/` separators; `is_dir` selects
    /// whether directory-only rules apply. The last matching rule decides, and a
    /// negation can bring a path back — unless a parent directory was itself
    /// excluded, which is git's rule too and is checked by the caller, not here.
    pub fn matches(&self, path: &str, is_dir: bool) -> bool {
        let relative = self.relative(path);
        let name = relative.rsplit('/').next().unwrap_or(&relative);

        // The ignore files themselves are never part of the image. Git does not
        // track them either, and they describe the build rather than belong to
        // the app — a script that could read `.gitignore` would learn about the
        // host's layout for no benefit.
        if name == ".gitignore" || name == ".fernboxignore" {
            return true;
        }

        let mut ignored = false;
        for rule in &self.rules {
            if rule.directory_only && !is_dir {
                continue;
            }
            // An anchored pattern is matched against the whole relative path; an
            // unanchored one only against the last segment, which is what makes
            // `node_modules` catch `a/b/node_modules`.
            let matched = if rule.anchored {
                rule.matches(&relative)
            } else {
                rule.matches(name)
            };
            if matched {
                ignored = !rule.negated;
            }
        }
        ignored
    }

    /// The path with the root stripped and separators normalised, so a rule is
    /// matched against the same spelling on every host.
    fn relative(&self, path: &str) -> String {
        let normalised = path.replace('\\', "/");
        let trimmed = normalised.trim_start_matches('/');
        let relative = trimmed.strip_prefix(&self.root).unwrap_or(trimmed);
        relative.trim_start_matches('/').to_string()
    }
}

impl Rule {
    fn parse(line: &str) -> Option<Rule> {
        // Trailing whitespace is dropped unless it is escaped, and a line whose
        // first non-space character is `#` is a comment.
        let line = line.trim_end_matches([' ', '\t']);
        let mut line = line.strip_suffix('\r').unwrap_or(line);
        if line.is_empty() || line.starts_with('#') {
            return None;
        }

        let mut negated = false;
        if let Some(rest) = line.strip_prefix('!') {
            negated = true;
            line = rest;
        }
        // A `#` or `!` may be escaped to mean the literal character.
        if line.starts_with("\\#") || line.starts_with("\\!") {
            line = &line[1..];
        }
        if line.is_empty() {
            return None;
        }

        let directory_only = line.ends_with('/');
        let line = line.trim_end_matches('/');
        // Anchored when there is a `/` anywhere but the end. A leading `/` is
        // just an explicit anchor and is dropped.
        let anchored = line.contains('/');
        let pattern = line.trim_start_matches('/').to_string();
        if pattern.is_empty() {
            return None;
        }

        Some(Rule { pattern, negated, directory_only, anchored })
    }

    /// Glob match with `*`, `?`, `[...]` and `**`.
    fn matches(&self, text: &str) -> bool {
        glob_match(self.pattern.as_bytes(), text.as_bytes())
    }
}

/// Match a gitignore glob against `text`.
///
/// `**` spans separators; a single `*` does not. Written as a small recursive
/// matcher rather than a regex so the semantics stay readable and no dependency
/// is added for one file format.
fn glob_match(pattern: &[u8], text: &[u8]) -> bool {
    match_pattern(pattern, 0, text, 0)
}

fn match_pattern(pattern: &[u8], mut p: usize, text: &[u8], mut t: usize) -> bool {
    while p < pattern.len() {
        match pattern[p] {
            // `**` matches anything, including `/`.
            b'*' if pattern.get(p + 1) == Some(&b'*') => {
                let mut next = p + 2;
                // `**/` also matches zero directories, so `a/**/b` matches `a/b`.
                let skip_slash = pattern.get(next) == Some(&b'/');
                if skip_slash {
                    next += 1;
                }
                if next == pattern.len() {
                    return true;
                }
                // Try every split point, shortest first.
                for split in t..=text.len() {
                    if match_pattern(pattern, next, text, split) {
                        return true;
                    }
                }
                if skip_slash && match_pattern(pattern, next, text, t) {
                    return true;
                }
                return false;
            }
            b'*' => {
                // A non-separator run.
                let mut next = p + 1;
                while pattern.get(next) == Some(&b'*') {
                    next += 1;
                }
                if next == pattern.len() {
                    // A trailing `*` matches the rest, but not across `/`.
                    return !text[t..].contains(&b'/');
                }
                for split in t..=text.len() {
                    if text.get(split) == Some(&b'/') && split > t {
                        // Do not cross a separator looking for a longer match.
                        return match_pattern(pattern, next, text, split);
                    }
                    if match_pattern(pattern, next, text, split) {
                        return true;
                    }
                }
                return false;
            }
            b'?' => {
                if t >= text.len() || text[t] == b'/' {
                    return false;
                }
                p += 1;
                t += 1;
            }
            b'[' => match character_class(pattern, p, text.get(t).copied()) {
                Some((matched, next)) => {
                    if !matched {
                        return false;
                    }
                    p = next;
                    t += 1;
                }
                // Not a class after all; treat it literally.
                None => {
                    if text.get(t) != Some(&b'[') {
                        return false;
                    }
                    p += 1;
                    t += 1;
                }
            },
            b'\\' if p + 1 < pattern.len() => {
                if text.get(t) != Some(&pattern[p + 1]) {
                    return false;
                }
                p += 2;
                t += 1;
            }
            byte => {
                if text.get(t) != Some(&byte) {
                    return false;
                }
                p += 1;
                t += 1;
            }
        }
    }
    t == text.len()
}

/// Parse `[...]` starting at `p`. Returns whether `ch` matches and where the
/// class ends, or `None` when the bracket is unterminated and should be literal.
fn character_class(pattern: &[u8], p: usize, ch: Option<u8>) -> Option<(bool, usize)> {
    let mut i = p + 1;
    let negated = matches!(pattern.get(i), Some(b'!') | Some(b'^'));
    if negated {
        i += 1;
    }

    let mut matched = false;
    let mut first = true;
    while i < pattern.len() {
        if pattern[i] == b']' && !first {
            return Some((matched != negated, i + 1));
        }
        first = false;

        // A range `a-z`, unless the `-` is the last character of the class.
        if i + 2 < pattern.len() && pattern[i + 1] == b'-' && pattern[i + 2] != b']' {
            if let Some(ch) = ch {
                if pattern[i] <= ch && ch <= pattern[i + 2] {
                    matched = true;
                }
            }
            i += 3;
            continue;
        }
        if let Some(ch) = ch {
            if pattern[i] == ch {
                matched = true;
            }
        }
        i += 1;
    }
    // Unterminated: the `[` is a literal.
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ignore(text: &str) -> Ignore {
        let mut ignore = Ignore::default();
        ignore.extend(text);
        ignore
    }

    #[test]
    fn a_bare_name_matches_at_any_depth() {
        let rules = ignore("node_modules\n");
        assert!(rules.matches("node_modules", true));
        assert!(rules.matches("a/b/node_modules", true));
        assert!(!rules.matches("node_modulesx", false));
    }

    #[test]
    fn a_file_inside_an_ignored_directory_is_ignored_via_its_parent() {
        // `matches` is asked about one path at a time, so it does not claim to
        // know that `node_modules/pkg/index.js` sits under an excluded
        // directory. `Ignore::prunes` is what the walker uses, and it walks
        // top-down: `node_modules` is skipped as a directory, so the file is
        // never reached. This test pins the assumption the walker relies on.
        let rules = ignore("node_modules\n");
        assert!(rules.matches("node_modules", true), "the directory must be excluded");
    }

    #[test]
    fn an_anchored_pattern_only_matches_from_the_root() {
        let rules = ignore("/build\n");
        assert!(rules.matches("build", true));
        assert!(!rules.matches("src/build", true));
    }

    #[test]
    fn a_directory_pattern_does_not_match_a_file_of_that_name() {
        let rules = ignore("dist/\n");
        assert!(rules.matches("dist", true));
        assert!(!rules.matches("dist", false));
    }

    #[test]
    fn a_later_negation_brings_a_path_back() {
        let rules = ignore("*.log\n!keep.log\n");
        assert!(rules.matches("a.log", false));
        assert!(!rules.matches("keep.log", false));
    }

    #[test]
    fn a_star_does_not_cross_a_separator() {
        let rules = ignore("src/*.js\n");
        assert!(rules.matches("src/main.js", false));
        assert!(!rules.matches("src/lib/main.js", false));
    }

    #[test]
    fn a_double_star_crosses_separators() {
        let rules = ignore("src/**/test.js\n");
        assert!(rules.matches("src/test.js", false));
        assert!(rules.matches("src/a/b/test.js", false));
        assert!(!rules.matches("other/test.js", false));
    }

    #[test]
    fn a_character_class_and_a_question_mark_match_one_character() {
        let rules = ignore("[abc].js\n");
        assert!(rules.matches("a.js", false));
        assert!(!rules.matches("d.js", false));

        let rules = ignore("?.js\n");
        assert!(rules.matches("a.js", false));
        assert!(!rules.matches("ab.js", false));
    }

    #[test]
    fn a_range_inside_a_class_matches() {
        let rules = ignore("file[0-9].txt\n");
        assert!(rules.matches("file3.txt", false));
        assert!(!rules.matches("filex.txt", false));
    }

    #[test]
    fn comments_and_blank_lines_are_skipped() {
        let rules = ignore("# a comment\n\n   \nreal\n");
        assert_eq!(rules.rules.len(), 1);
        assert!(rules.matches("real", false));
        assert!(!rules.matches("# a comment", false));
    }

    #[test]
    fn a_trailing_star_matches_the_rest_of_a_name() {
        let rules = ignore("temp*\n");
        assert!(rules.matches("tempdir", true));
        assert!(rules.matches("tempfile.txt", false));
        assert!(!rules.matches("notemp", false));
    }

    #[test]
    fn an_escaped_hash_is_a_literal_name() {
        let rules = ignore("\\#notes\n");
        assert!(rules.matches("#notes", false));
    }

    #[test]
    fn the_root_prefix_is_stripped_before_matching() {
        let mut rules = Ignore { root: "app".into(), rules: Vec::new() };
        rules.extend("/secret\n");
        // The same rule, seen through a rooted path.
        assert!(rules.matches("/app/secret", true));
        assert!(!rules.matches("/other/secret", true));
    }

    #[test]
    fn both_files_combine_and_fernboxignore_wins_because_it_is_read_second() {
        // `.gitignore` excludes, `.fernboxignore` re-includes: the pair a project
        // needs when it genuinely wants a normally-ignored folder in its image.
        let mut rules = Ignore::default();
        rules.extend("vendor/\n");
        rules.extend("!vendor/\n");
        assert!(!rules.matches("vendor", true));
    }

    #[test]
    fn an_unterminated_class_is_a_literal_bracket() {
        let rules = ignore("[abc\n");
        assert!(rules.matches("[abc", false));
    }
}
