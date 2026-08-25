// No @types/node: shim just enough of node:test / node:assert to type-check.
declare module 'node:test' {
  export function test(name: string, fn: () => void): void;
}

declare module 'node:assert/strict' {
  const assert: {
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
  };
  export default assert;
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintPgn } from '../src/linter';

interface Case {
  name: string;
  input: string;
  expectedRules: string[];
}

// Table-driven on purpose: chess notation has a long tail of "looks fine,
// isn't" cases (digit zero vs. letter O, ambiguous disambiguation, promotion
// spelled three different ways) and a flat list of them is easier to extend
// than a pile of one-off assertions.
const cases: Case[] = [
  { name: 'plain pawn and knight moves are clean', input: '1. e4 e5 2. Nf3 Nc6', expectedRules: [] },
  { name: 'castling with letter O is clean', input: '1. e4 e5 2. Nf3 Nc6 3. O-O O-O', expectedRules: [] },
  {
    name: 'castling with digit zero is flagged on both sides',
    input: '7. 0-0 0-0',
    expectedRules: ['castling-digit-zero', 'castling-digit-zero'],
  },
  {
    name: 'queenside castling with digit zero is flagged',
    input: '10. 0-0-0',
    expectedRules: ['castling-digit-zero'],
  },
  { name: 'lowercase piece letter is flagged', input: '3. nf3', expectedRules: ['piece-letter-lowercase'] },
  {
    name: 'ambiguous lowercase-b pawn move is not flagged as a piece move',
    input: '1. b4',
    expectedRules: [],
  },
  {
    name: 'promotion without equals sign is flagged',
    input: '40. e8Q',
    expectedRules: ['promotion-missing-equals'],
  },
  { name: 'promotion with slash is flagged', input: '40. e8/Q', expectedRules: ['promotion-format'] },
  { name: 'promotion with equals sign is clean', input: '40. e8=Q', expectedRules: [] },
  { name: 'long algebraic notation is flagged', input: '1. e2-e4', expectedRules: ['long-algebraic-notation'] },
  { name: 'file-disambiguated knight move is clean', input: '8. Nbd7', expectedRules: [] },
  { name: 'rank-disambiguated rook move is clean', input: '15. R1e2', expectedRules: [] },
  { name: 'fully disambiguated capture is clean', input: '20. Qh4xe1', expectedRules: [] },
  { name: 'check and mate symbols are clean', input: '1. Qxe7+ 2. Qxe7#', expectedRules: [] },
  { name: 'move number with two dots is flagged', input: '5.. Nf3', expectedRules: ['move-number-format'] },
  { name: 'move number glued to its move is clean', input: '1.e4 e5', expectedRules: [] },
  { name: 'game result marker is not flagged as a move', input: '1. e4 e5 1-0', expectedRules: [] },
  { name: 'draw result marker is not flagged as a move', input: '1. e4 e5 1/2-1/2', expectedRules: [] },
  {
    name: 'move-shaped text inside a comment is ignored',
    input: '1. e4 {a solid opening, 0-0 soon} e5',
    expectedRules: [],
  },
  { name: 'a clean variation is not flagged', input: '1. e4 (1. d4 d5) e5', expectedRules: [] },
  {
    name: 'a malformed move inside a variation is flagged',
    input: '1. e4 (1. d4 0-0) e5',
    expectedRules: ['castling-digit-zero'],
  },
  {
    name: 'a variation opening on a black move numbers independently',
    input: '1. e4 e5 2. Nf3 (2... Nc6 3. Bb5) Nc6',
    expectedRules: [],
  },
  {
    name: 'a nested variation is also linted',
    input: '1. e4 (1. d4 (1. c4 c5) d5) e5',
    expectedRules: [],
  },
  {
    name: 'move-shaped text inside a tag pair is ignored',
    input: '[Event "Test"]\n[Site "0-0"]\n\n1. e4 e5',
    expectedRules: [],
  },
  { name: 'an out-of-range square is flagged generically', input: '1. e9', expectedRules: ['invalid-san'] },
  { name: 'empty input produces no findings', input: '', expectedRules: [] },
];

for (const testCase of cases) {
  test(testCase.name, () => {
    const findings = lintPgn(testCase.input);
    assert.deepEqual(
      findings.map((finding) => finding.rule),
      testCase.expectedRules,
    );
  });
}
