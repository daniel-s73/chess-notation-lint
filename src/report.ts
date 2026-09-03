// Turns findings into the CLI's output shapes. Kept separate from the
// linter itself so the core library stays free of any notion of how its
// results get printed -- something embedding lintPgn() directly has no use
// for.
import type { Finding } from './linter';

export function formatText(filePath: string, findings: Finding[]): string {
  return findings
    .map(
      (finding) =>
        `${filePath}:${finding.line}:${finding.column} ${finding.severity} [${finding.rule}] ${finding.message}`,
    )
    .join('\n');
}

// One JSON array per file, each entry carrying its own "file" field. That
// shape is redundant when linting a single file from the CLI, but it means
// an editor integration that merges output from several runs (or switches
// to linting a whole directory later) doesn't have to special-case it.
export function formatJson(filePath: string, findings: Finding[]): string {
  return JSON.stringify(
    findings.map((finding) => ({
      file: filePath,
      line: finding.line,
      column: finding.column,
      severity: finding.severity,
      rule: finding.rule,
      message: finding.message,
    })),
  );
}
