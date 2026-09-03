// No @types/node: these are the only bits of the Node globals this file
// touches, so a small shim keeps the project at zero dependencies.
declare global {
  const process: { argv: string[]; exitCode: number };
  const console: { log(...args: unknown[]): void; error(...args: unknown[]): void };
}

declare module 'fs' {
  export function readFileSync(path: string, encoding: string): string;
}

import * as fs from 'fs';
import { lintPgn } from './linter';
import { formatJson, formatText } from './report';

function main(): void {
  const args = process.argv.slice(2);
  const jsonFlag = args.includes('--json');
  const filePath = args.find((arg) => arg !== '--json');

  if (!filePath) {
    console.error('usage: chess-lint [--json] <file.pgn>');
    process.exitCode = 2;
    return;
  }

  const text = fs.readFileSync(filePath, 'utf8');
  const findings = lintPgn(text);
  const output = jsonFlag ? formatJson(filePath, findings) : formatText(filePath, findings);

  // Text mode prints nothing at all for a clean file, matching the old
  // behavior. JSON mode always prints a valid array -- "[]" for clean --
  // since a consumer parsing the output shouldn't have to treat silence as
  // a third possible result alongside success and failure.
  if (jsonFlag || output.length > 0) {
    console.log(output);
  }

  if (findings.some((finding) => finding.severity === 'error')) {
    process.exitCode = 1;
  }
}

main();
