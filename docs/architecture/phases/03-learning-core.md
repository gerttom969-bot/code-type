# Phase 03: Learning core

Status: Not started | Plan phase: 3 and 4 (the learning parts) | Blocked by: 01, 02

**Goal.** "Learned" means something. It is decided from evidence, failures count, and XP, level and streak are derived instead of stored.

## Starting point (verified in the repo and the prototype)

- `src/learning/` holds pure, tested modules: `black-boxes.js`, `async-decision.js`, `python-style.js`, `revision.js`, `typing-lenses.js`.
- `revision.js` has 10 concept cards. `gradeReview` sets the next due time from a fixed delay per rating (again 5 minutes, hard 1 day, good 3 days, easy 7 days). It stores `repetitions` but never uses it, so reviewing a card well ten times spaces it exactly like once.
- XP is a mutable counter: `addXp` in `domain/progress.js` adds to `progress.xp`. `streak` is set to 1 in `createInitialProgress` and nothing updates it.
- There is no mastery and no attempt record in this repo.
- In the prototype, `recordMastery` is called inside `if (r.passed)` for problems, so failed problem attempts are never recorded and problem mastery is 100% by construction. Only snippet predictions record failures.

## Steps

### Step 03.1 The attempt record on paper (Size: S)
- Acceptance criteria: one list of fields for an attempt: `concept_id`, `item_id`, `kind` (predict, explain, transfer, implement), `passed`, `hinted`, `tries_before_pass`, `at`, and an optional `efficiency`. For each: who sets it, and why it exists.
- Verification: the list is in this file under Notes and matches Step 06.1.
- Blocked by: none

### Step 03.2 Mastery as a pure function (Size: M)
- Acceptance criteria: `src/learning/mastery.js` takes a list of attempts and a clock and returns a state per concept. A concept is **learned** only when all hold: the probability that the true success rate exceeds the threshold is at least the confidence level, passes happened on at least two different days, at least one transfer item was passed, and the counted passes were hint-free. A pass with no earlier history is not learned.
- Verification: `node --test tests/mastery.test.js`, including these cases: no attempts, failures lower the state, one clean pass is not learned, and a learner who copies an optimal answer in one try is not ahead of one who struggled and then solved a transfer item.
- Blocked by: 03.1, D-06

With each attempt a pass or a fail, the success rate p has a Beta posterior. For whole-number counts there is a finite formula, so no special function is needed: with `s` passes and `f` failures,

```
Pr(p > x)  =  P( Binomial(s + f + 1, x)  <=  s )
```

Calibrate the thresholds before shipping. This table is the number of passes in a row, with no failure and a uniform starting prior, that reaches the confidence level:

| Threshold | Confidence | Passes in a row |
| --- | --- | --- |
| 0.8 | 0.95 | 13 |
| 0.8 | 0.80 | 7 |
| 0.7 | 0.95 | 8 |
| 0.7 | 0.80 | 4 |
| 0.6 | 0.80 | 3 |

With threshold 0.7 and confidence 0.8, one earlier failure raises the 4 to 7. Pick the pair that matches how many clean passes you think proves understanding, and record it in D-06. Multiple-choice passes should weigh less than open answers because guessing succeeds one time in four.

### Step 03.3 Count failures everywhere (Size: S)
- Acceptance criteria: every place that records progress for a problem, snippet or drill also records a failure. No caller passes a hard-coded `true`.
- Verification: a test submits a failing attempt and the concept's state moves down.
- Blocked by: 03.2

### Step 03.4 Spacing that grows (Size: M)
- Acceptance criteria: review intervals grow with `repetitions` and reset on a lapse. Prediction drills and per-item review from the prototype are ported as pure functions.
- Verification: a test shows two `good` reviews give a longer delay than one (this fails against today's `gradeReview`).
- Blocked by: 03.2

### Step 03.5 Derived XP, level and streak (Size: M)
- Acceptance criteria: `xp`, `level` and `streak` are pure functions over an array of events and a clock. The streak counts distinct active days and breaks after a gap. The daily goal from the prototype is a function too.
- Verification: tests with a fixed clock cover a gap, two events on one day, and a day boundary.
- Blocked by: 03.1

### Step 03.6 Efficiency as feedback, never as score (Size: L, optional)
- Acceptance criteria: a solution's efficiency is shown to the learner next to the reference ("your solution is quadratic, the reference is n log n"). It counts only when the tests pass. It is measured by operation counts on growing inputs with a step limit, never by wall-clock time.
- Verification: a test shows the same solution measures the same on every run.
- Blocked by: 02.3

Wall-clock time in a browser varies between devices, so it cannot be a fair measure. Efficiency never feeds the mastery state, because a copied optimal answer would then look like understanding.

## Exit criteria

Mastery, spacing, XP, level and streak are pure and tested, failures are counted, and `npm test` has grown by the new test files.

## Risks and notes

- `domain/progress.js` is a one-way door in the gate: changes need your review.
- Do not store mastery. It is derived from events (Phase 04). A stored copy goes stale.
- The first draft of a score, the sum of (t/2 + k) over the sum of t/12, reduces to 6 + 12 times the sum of k over the sum of t. It gives 18 to a learner who copied an optimal answer in one try and about 7.9 to one who found a good answer in five. Do not bring it back.

## Not in this phase

Techniques for the learner to study with (Feynman-style explanation, OODA). Explanation items are checked against curated misconceptions, which is Phase 05 content.

## Evidence

- (fill in)
