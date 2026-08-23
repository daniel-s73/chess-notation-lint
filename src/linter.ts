// Syntax-level linter for PGN movetext. It has no board model, so it can't
// tell you whether a move is legal in a given position -- only whether the
// notation itself is well formed. That covers a surprising number of the
// mistakes that show up in hand-edited or badly exported PGN files.

export interface Finding {
  line: number;
  column: number;
  severity: 'error' | 'warning';
  rule: string;
  message: string;
}

interface RawToken {
  text: string;
  line: number;
  column: number;
}

const RESULT_REGEX = /^(1-0|0-1|1\/2-1\/2|\*)$/;
const MOVE_NUMBER_PREFIX_REGEX = /^(\d+\.+)(.*)$/;
const WHITE_MOVE_NUMBER_REGEX = /^\d+\.$/;
const BLACK_MOVE_NUMBER_REGEX = /^\d+\.\.\.$/;

const CASTLING_ZERO_REGEX = /^0-0(-0)?[+#]?$/;
const CASTLING_REGEX = /^O-O(-O)?[+#]?$/;

// Pawn and piece moves are kept as separate patterns rather than one merged
// regex. A merged pattern that makes every group optional will happily
// accept nonsense like "bd7" (no piece letter, but a disambiguation-shaped
// prefix) as if it were some valid pawn move, which defeats the point of a
// linter that exists to catch exactly that kind of typo.
const PAWN_MOVE_REGEX = /^([a-h]x)?[a-h][1-8](=[QRBN])?[+#]?$/;
const PIECE_MOVE_REGEX = /^[KQRBN]([a-h]|[1-8]|[a-h][1-8])?x?[a-h][1-8][+#]?$/;

const LONG_ALGEBRAIC_REGEX = /^[KQRBN]?[a-h][1-8]-[a-h][1-8][+#]?$/;
const PROMOTION_MISSING_EQUALS_REGEX = /^[a-h]?x?[a-h][18][QRBN][+#]?$/;
const PROMOTION_SLASH_REGEX = /^[a-h]?x?[a-h][18]\/[QRBN][+#]?$/;

function isValidSan(word: string): boolean {
  return PAWN_MOVE_REGEX.test(word) || PIECE_MOVE_REGEX.test(word);
}

function insertPromotionEquals(word: string): string {
  const match = /^(.*?[a-h][18])([QRBN])([+#]?)$/.exec(word);
  if (!match) return word;
  return `${match[1]}=${match[2]}${match[3]}`;
}

function scan(text: string): RawToken[] {
  const tokens: RawToken[] = [];
  const n = text.length;
  let i = 0;
  let line = 1;
  let col = 1;

  function advance(): string {
    const ch = text[i];
    i++;
    if (ch === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
    return ch;
  }

  function atLineStart(): boolean {
    let j = i - 1;
    while (j >= 0 && text[j] !== '\n') {
      if (!/\s/.test(text[j])) return false;
      j--;
    }
    return true;
  }

  while (i < n) {
    const ch = text[i];

    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      advance();
      continue;
    }

    // Tag pairs, e.g. [Event "..."], are metadata, not movetext.
    if (ch === '[' && atLineStart()) {
      while (i < n && text[i] !== '\n') advance();
      continue;
    }

    if (ch === '{') {
      advance();
      while (i < n && text[i] !== '}') advance();
      if (i < n) advance();
      continue;
    }

    if (ch === '$') {
      advance();
      while (i < n && /[0-9]/.test(text[i])) advance();
      continue;
    }

    // Variations. We skip their contents entirely for now rather than
    // recursively linting them with their own move numbering.
    if (ch === '(') {
      let depth = 1;
      advance();
      while (i < n && depth > 0) {
        if (text[i] === '(') depth++;
        else if (text[i] === ')') depth--;
        advance();
      }
      continue;
    }

    const startLine = line;
    const startCol = col;
    let word = '';
    while (i < n && !/[\s{}()]/.test(text[i])) {
      word += advance();
    }
    tokens.push({ text: word, line: startLine, column: startCol });
  }

  return tokens;
}

function checkMoveNumber(part: string, line: number, column: number): Finding[] {
  if (WHITE_MOVE_NUMBER_REGEX.test(part) || BLACK_MOVE_NUMBER_REGEX.test(part)) {
    return [];
  }
  return [
    {
      line,
      column,
      severity: 'warning',
      rule: 'move-number-format',
      message: `move number "${part}" should be formatted as "N." or "N..."`,
    },
  ];
}

function checkMove(word: string, line: number, column: number): Finding[] {
  if (CASTLING_ZERO_REGEX.test(word)) {
    return [
      {
        line,
        column,
        severity: 'error',
        rule: 'castling-digit-zero',
        message: `castling move "${word}" uses the digit 0; standard notation uses the capital letter O ("${word.replace(/0/g, 'O')}")`,
      },
    ];
  }

  if (CASTLING_REGEX.test(word) || isValidSan(word)) {
    return [];
  }

  if (/^[kqrbn]/.test(word) && isValidSan(word[0].toUpperCase() + word.slice(1))) {
    return [
      {
        line,
        column,
        severity: 'error',
        rule: 'piece-letter-lowercase',
        message: `piece letter should be uppercase: "${word}" should start with "${word[0].toUpperCase()}"`,
      },
    ];
  }

  if (LONG_ALGEBRAIC_REGEX.test(word)) {
    return [
      {
        line,
        column,
        severity: 'warning',
        rule: 'long-algebraic-notation',
        message: `"${word}" looks like long algebraic notation (from-to squares); PGN movetext expects standard algebraic notation (SAN)`,
      },
    ];
  }

  if (PROMOTION_MISSING_EQUALS_REGEX.test(word)) {
    return [
      {
        line,
        column,
        severity: 'error',
        rule: 'promotion-missing-equals',
        message: `promotion move "${word}" is missing "="; should be "${insertPromotionEquals(word)}"`,
      },
    ];
  }

  if (PROMOTION_SLASH_REGEX.test(word)) {
    return [
      {
        line,
        column,
        severity: 'error',
        rule: 'promotion-format',
        message: `promotion move "${word}" uses "/"; standard notation uses "=" ("${word.replace('/', '=')}")`,
      },
    ];
  }

  return [
    {
      line,
      column,
      severity: 'error',
      rule: 'invalid-san',
      message: `"${word}" does not look like a valid SAN move`,
    },
  ];
}

export function lintPgn(text: string): Finding[] {
  const findings: Finding[] = [];

  for (const token of scan(text)) {
    if (RESULT_REGEX.test(token.text)) continue;

    const moveNumberMatch = MOVE_NUMBER_PREFIX_REGEX.exec(token.text);
    if (moveNumberMatch) {
      const [, numberPart, rest] = moveNumberMatch;
      findings.push(...checkMoveNumber(numberPart, token.line, token.column));
      if (rest.length > 0) {
        findings.push(...checkMove(rest, token.line, token.column + numberPart.length));
      }
      continue;
    }

    findings.push(...checkMove(token.text, token.line, token.column));
  }

  return findings;
}
