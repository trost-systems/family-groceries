# Recipes: gate failures seen before

One file per failure of a `scripts/verify.sh` gate that came back across jobs and whose cause is
known. When a gate fails and its output has a recipe's signal, the verdict line of `verify.sh`
names it: `seen before? <recipe>`. That is a question: the recipe's Condition says how to tell,
and the gate stays failed either way. A recipe never makes a gate pass.

| Recipe | Gate | In short |
| --- | --- | --- |
| [e2e-fake-oidc-unreachable](e2e-fake-oidc-unreachable.md) | e2e | The ten sign-in tests against the fake provider time out where containers cannot reach the host |

## Format

```markdown
---
gate: <gate>            one of scripts/gates/<gate>.sh
signal: <ERE>           grep -E, matched against each line of the failed run's output
---
# <what it is, in a line>
## Condition            when this is the cause, and a command that tells it from a real failure
## Mechanism            why it fails
## Do                   what gets the verdict the gate could not give here
## Do not               the shortcuts that hide it
## Evidence             how often, where, measured how
## Example              fenced blocks of real output the signal must match, and where each is from
## Not this             a fenced block of real nearby output the signal must not match
```

`scripts/verify-test.sh` (lint gate) runs `verify.sh` on each recipe's Example and Not this. Where
the Example is Playwright's summary (lines `    [project] › tests/…`), it also runs each test line
alone, which must get the recipe named, and the same tests as passed lines of the list, which
must not (`✓`, in three forms that the test writes: a number of one, two and three digits, the
last without its time). So a signal that loses one of its example's tests, or takes a line of its
Not this or one of those passed lines, fails the lint gate.

## When to add one

- The failure came back: at least three failed runs or two jobs, counted from transcripts, the
  ledger (`scripts/verify.sh --history`) or CI runs. Write the count and how it was measured.
- The cause is known and is not the change under test. A cause that can be removed is removed
  instead (the stale-migrations and stale-stack failures became checks in the gates, job 219).
- The signal is the failed form of the output. Playwright also prints a passing test's title, so
  match the indented summary line, not the title. A test under `N flaky` or `N interrupted` has
  the same line: the pattern cannot tell those from `N failed`, the Condition has to.
- One condition, one mechanism. No advice that would apply to every failure.
