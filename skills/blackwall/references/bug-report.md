# Writing a blackwall bug report

Ask the user where to save the report before writing it; inside the sandbox, only the current folder, `--add-dir` folders, and `$TMPDIR` are writable. Save it there as a Markdown file and tell the user its path. Don't file, post, or send it: the user reads it and decides what happens next.

The report is a handoff: another agent fixes the problem in a later session. Collect what it needs to reproduce the problem, then stop. Finding the cause and trying a fix are that agent's work, so spend no time on either.

## Is it a bug?

A denial that matches a row in SKILL.md's "Reading a denial" is the policy working: hand the user the grant instead. Write a report for:

- a denial no row or grant explains
- a read, write, or host the docs say is denied that goes through. This is a security bug: make `**Security-sensitive: don't file publicly.**` the report's first line, and tell the user
- an error message or doc line that misleads
- blackwall crashing, or rejecting a valid config

One bug per report.

Feedback the user asks you to write up, like friction, a missing feature, or a confusing doc line, takes the same sections: under Steps to reproduce, what they did; under Expected, what they want instead.

## Sections

```markdown
# <what blackwall did>, <under what condition>

## Environment
- macOS version
- blackwall version: `$BLACKWALL_VERSION` inside, `blackwall --version` outside; when neither is available, ask the user or write "not captured"
- Node version, the wrapped command and its version
- Ran inside the sandbox, outside, or both

## Config
Only the keys that bear on the bug, and any default preset turned off.

## Steps to reproduce
The shortest command sequence from a fresh folder, each command with its exact output and exit code.
Then the same commands in a plain terminal; inside the sandbox, ask the user to run them. The difference between the two runs is what shows blackwall caused it.

## Expected
What should happen, citing the SKILL.md row or README line that says so.

## Actual

## Tried
Each grant or workaround already tried, and what it changed.

## Notes
Optional: a cause or fix you already suspect, labeled as a guess.
```

Mark every claim you didn't run as untested.

## Leave out

- Secrets: `.env` contents, tokens, `env` dumps
- Private repo names, usernames, and paths outside the reproduction: write `~` or `<repo>`
- Full transcripts and long logs: quote the decisive line
- Workarounds that widen the sandbox (`sudo`, copying files out, `"*"`) presented as fixes
