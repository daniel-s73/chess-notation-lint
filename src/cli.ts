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

function main(): void {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('usage: chess-lint <file.pgn>');
    process.exitCode = 2;
    return;
  }

  const text = fs.readFileSync(filePath, 'utf8');
  const findings = lintPgn(text);

  for (const finding of findings) {
    console.log(
      `${filePath}:${finding.line}:${finding.column} ${finding.severity} [${finding.rule}] ${finding.message}`,
    );
  }

  if (findings.some((finding) => finding.severity === 'error')) {
    process.exitCode = 1;
  }
}

main();
