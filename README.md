# chess-notation-lint

A linter for PGN movetext. It checks the notation itself, not the position:
it has no board model, so it can't tell you whether a move is legal, only
whether it's written the way SAN is supposed to be written.

That turns out to matter more than it sounds like it should. PGN files that
came out of a hand-rolled export script, got copy-pasted out of a PDF, or
were typed by hand tend to accumulate a specific set of mistakes:

- castling written with the digit `0` (`0-0`) or a lowercase `o` (`o-o`)
  instead of the capital letter `O` (`O-O`) -- the digit and the lowercase
  letter both look identical to `O` in most fonts, but strict PGN parsers
  treat them as different tokens and some will reject the file outright
- piece letters in lowercase (`nf3` instead of `Nf3`)
- promotions written without the `=` (`e8Q`) or with a `/` instead (`e8/Q`)
- long algebraic notation (`e2-e4`) mixed into what's otherwise SAN
- move numbers with the wrong number of dots (`5..` instead of `5.` or `5...`)

None of these break a human reading the game, but they do break tools that
parse PGN strictly, and they're easy to miss by eye.

## Usage

```
npm run build
node dist/src/cli.js game.pgn
```

Given a file like:

```
[Event "Casual Game"]
[Site "?"]

1. e4 e5 2. Nf3 Nc6 3. 0-0 Nf6
```

it reports:

```
game.pgn:4:24 error [castling-digit-zero] castling move "0-0" uses the digit 0; standard notation uses the capital letter O ("O-O")
```

Each line is `file:line:column severity [rule] message`. Exit code is 1 if
any error-severity finding was reported, 0 otherwise.

Pass `--json` to get machine-readable output instead, for editor
integrations:

```
node dist/src/cli.js --json game.pgn
```

```json
[{"file":"game.pgn","line":4,"column":24,"severity":"error","rule":"castling-digit-zero","message":"castling move \"0-0\" uses the digit 0; standard notation uses the capital letter O (\"O-O\")"}]
```

Unlike the text output, `--json` always prints a JSON array -- `[]` for a
clean file -- so a consumer parsing it never has to treat empty output as a
third possible result alongside success and failure.

## Library usage

```ts
import { lintPgn } from './src/linter';

const findings = lintPgn('1. e4 e5 2. Nf3 Nc6 3. 0-0 Nf6');
// [{ line: 1, column: 24, severity: 'error', rule: 'castling-digit-zero', ... }]
```

## Rules

| rule                        | severity | catches |
| ---------------------------- | -------- | ------- |
| `castling-digit-zero`        | error    | `0-0` / `0-0-0` instead of `O-O` / `O-O-O` |
| `castling-letter-lowercase`  | error    | `o-o` / `o-o-o` instead of `O-O` / `O-O-O` |
| `piece-letter-lowercase`     | error    | `nf3` instead of `Nf3` |
| `promotion-missing-equals`   | error    | `e8Q` instead of `e8=Q` |
| `promotion-format`           | error    | `e8/Q` instead of `e8=Q` |
| `long-algebraic-notation`    | warning  | `e2-e4` instead of `e4` |
| `move-number-format`         | warning  | `5..` instead of `5.` or `5...` |
| `invalid-san`                | error    | anything else that isn't a recognizable SAN token |

Comments (`{...}`), NAGs (`$1`), tag pairs (`[Event "..."]`), and game result
markers (`1-0`, `0-1`, `1/2-1/2`, `*`) are recognized and skipped rather than
linted as moves. Variations (`(...)`) are linted recursively, including
nested ones, with their own move numbering.

## What this doesn't do

There's no board, so there's no way to check whether a move is actually
legal, whether a disambiguation is necessary, or whether a `+`/`#` matches
the real state of the game after the move. This is a notation linter, not a
chess engine.

## Development

```
npm run build   # compile with tsc
npm test        # compile, then run the test suite with node's test runner
```

Zero runtime dependencies. The two `.ts` files that touch Node's built-ins
(`src/cli.ts`, `test/linter.test.ts`) declare tiny local ambient types for
the handful of APIs they use instead of pulling in `@types/node`.
