// node:test / node:assert are already declared as ambient modules in
// linter.test.ts, which tsc compiles into the same program as this file, so
// they don't need to be redeclared here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintPgn } from '../src/linter';
import { formatJson, formatText } from '../src/report';

test('formatText renders one line per finding with no trailing newline', () => {
  const findings = lintPgn('7. 0-0 0-0');
  const output = formatText('game.pgn', findings);
  assert.deepEqual(
    output.split('\n'),
    [
      'game.pgn:1:4 error [castling-digit-zero] castling move "0-0" uses the digit 0; standard notation uses the capital letter O ("O-O")',
      'game.pgn:1:8 error [castling-digit-zero] castling move "0-0" uses the digit 0; standard notation uses the capital letter O ("O-O")',
    ],
  );
});

test('formatText produces an empty string for a clean file', () => {
  assert.deepEqual(formatText('game.pgn', lintPgn('1. e4 e5')), '');
});

test('formatJson round-trips findings with a file field attached', () => {
  const findings = lintPgn('3. nf3');
  const parsed = JSON.parse(formatJson('game.pgn', findings));
  assert.deepEqual(parsed, [
    {
      file: 'game.pgn',
      line: 1,
      column: 4,
      severity: 'error',
      rule: 'piece-letter-lowercase',
      message: 'piece letter should be uppercase: "nf3" should start with "N"',
    },
  ]);
});

test('formatJson produces an empty array, not empty output, for a clean file', () => {
  assert.deepEqual(formatJson('game.pgn', lintPgn('1. e4 e5')), '[]');
});
