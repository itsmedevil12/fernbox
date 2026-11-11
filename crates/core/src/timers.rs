//! The timer queue behind `fernbox.setTimeout` and friends.
//!
//! Timers outlive the script that schedules them, so the callbacks are held as
//! `v8::Global` handles — persistent across handle scopes — and fired in a drain
//! loop after the script itself returns. The queue is per-`Vm` and cleared at
//! the start of every `run`, so one script's timers never leak into the next.
//!
//! Cancellation uses a tombstone set rather than just removing the pending
//! entry, because an interval's callback can clear itself: the next tick is
//! re-inserted *before* the callback runs, so the tombstone it leaves has to win
//! against that copy.

use std::collections::HashSet;
use std::time::{Duration, Instant};

/// A pending timer. `interval` being `Some` makes it a `setInterval`.
pub struct Timer {
    pub id: u32,
    pub deadline: Instant,
    pub interval: Option<Duration>,
    pub callback: v8::Global<v8::Function>,
}

/// How many timers one run may have outstanding. Without a cap a script can
/// hold the isolate hostage with an array of millions of `setTimeout`s.
const MAX_TIMERS: usize = 4096;

/// The largest delay accepted, in milliseconds. Anything bigger is clamped
/// rather than rejected — the deadline will kill the run long before it fires.
const MAX_DELAY_MS: f64 = 24.0 * 60.0 * 60.0 * 1000.0;

pub struct TimerQueue {
    timers: Vec<Timer>,
    next_id: u32,
    cancelled: HashSet<u32>,
}

impl Default for TimerQueue {
    fn default() -> TimerQueue {
        TimerQueue { timers: Vec::new(), next_id: 1, cancelled: HashSet::new() }
    }
}

impl TimerQueue {
    /// Nothing outstanding, including tombstones.
    pub fn is_empty(&self) -> bool {
        self.timers.is_empty()
    }

    /// Drop everything, including callbacks a script left dangling.
    pub fn clear(&mut self) {
        self.timers.clear();
        self.cancelled.clear();
    }

    /// Register `callback` to run after `delay`, and every `interval` after that
    /// if it repeats. Returns `None` when the instance is at the timer cap.
    ///
    /// Ids start at 1 and never repeat, so `0` is never a valid handle.
    pub fn schedule(
        &mut self,
        isolate: &mut v8::Isolate,
        callback: v8::Local<v8::Function>,
        delay: Duration,
        interval: Option<Duration>,
    ) -> Option<u32> {
        if self.timers.len() >= MAX_TIMERS {
            return None;
        }
        let id = self.next_id;
        self.next_id += 1;
        self.timers.push(Timer {
            id,
            // `checked_add` rather than `+`: a huge delay would otherwise
            // saturate or panic at the end of the clock.
            deadline: Instant::now().checked_add(delay).unwrap_or_else(Instant::now),
            interval,
            callback: v8::Global::new(isolate, callback),
        });
        Some(id)
    }

    /// Cancel `id`. Safe against ids that were never scheduled or already fired.
    pub fn cancel(&mut self, id: u32) {
        // Pending entries go immediately, so a cancelled timer cannot keep the
        // drain loop asleep until a deadline it will never meet.
        self.timers.retain(|t| t.id != id);
        // The tombstone covers the copy re-inserted for the tick now firing.
        self.cancelled.insert(id);
    }

    /// The earliest deadline still outstanding.
    pub fn next_deadline(&self) -> Option<Instant> {
        self.timers.iter().map(|t| t.deadline).min()
    }

    /// Take every timer whose deadline has passed, re-inserting the next tick of
    /// each interval before it is handed back. Tombstoned ids are dropped here
    /// rather than in the caller, and the tombstones are spent once no timer
    /// carries them — ids are never reused, so they cannot apply to anything new.
    pub fn drain_due(&mut self, now: Instant) -> Vec<Timer> {
        let mut due = Vec::new();
        let pending = std::mem::take(&mut self.timers);
        for timer in pending {
            if timer.deadline <= now {
                if let Some(interval) = timer.interval {
                    let next = Timer {
                        id: timer.id,
                        deadline: now.checked_add(interval).unwrap_or(now),
                        interval: Some(interval),
                        callback: timer.callback.clone(),
                    };
                    self.timers.push(next);
                }
                due.push(timer);
            } else {
                self.timers.push(timer);
            }
        }

        due.retain(|t| !self.cancelled.contains(&t.id));
        self.timers.retain(|t| !self.cancelled.contains(&t.id));
        self.cancelled.clear();

        // Fire in deadline order, so a run with several timers due at once
        // behaves the way the delays said it would.
        due.sort_by_key(|t| t.deadline);
        due
    }
}

/// Turn the delay argument of a timer into a duration. Anything that is not a
/// finite non-negative number of milliseconds becomes "immediately", matching
/// what a browser does with `setTimeout(fn, -1)`.
pub fn delay_from(
    scope: &mut v8::HandleScope,
    args: &v8::FunctionCallbackArguments,
    index: usize,
) -> Duration {
    if index >= args.length() as usize {
        return Duration::ZERO;
    }
    let value = args.get(index as i32);
    let millis = value.number_value(scope).unwrap_or(0.0);
    if !millis.is_finite() || millis <= 0.0 {
        return Duration::ZERO;
    }
    Duration::from_secs_f64((millis.min(MAX_DELAY_MS) / 1000.0) as f64)
}
