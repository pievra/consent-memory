// Scans every tracked file for credential shaped strings. Written in-repo so that no outside
// tool has to be downloaded and run. It is a pattern check, not a full secret scanner:
// it catches common key formats and private key blocks, not arbitrary passwords.
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const PATTERNS = [
  ['private key block', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY/],
  ['AWS access key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Stripe key', /\b(?:sk|rk)_(?:live|test)_[0-9A-Za-z]{20,}\b/],
  ['Slack token', /\bxox[abprs]-[0-9A-Za-z-]{10,}\b/],
  ['Anthropic or OpenAI key', /\bsk-(?:ant-)?[A-Za-z0-9_-]{32,}\b/],
  ['JSON Web Token', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ['credential in a URL', /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@'"`]+:[^\s/:@'"`]{6,}@[^\s'"`]+/i],
  ['assigned secret', /\b(?:api[_-]?key|secret|passwd|password|access[_-]?token|auth[_-]?token)\b["']?\s*[:=]\s*["'][A-Za-z0-9+/_=-]{20,}["']/i],
];
const SKIP = /^(pnpm-lock\.yaml|.*\.(png|jpg|ico|zip|woff2?))$/;

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const findings = [];
let scanned = 0;
for (const file of files) {
  if (SKIP.test(file) || statSync(file).size > 2_000_000) continue;
  scanned += 1;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const [name, pattern] of PATTERNS) if (pattern.test(line)) findings.push(`${file}:${i + 1}: ${name}`);
  });
}
if (findings.length) {
  console.error('FAIL: credential shaped strings found\n' + findings.map((f) => ' - ' + f).join('\n'));
  process.exit(1);
}
console.log(`OK: ${scanned} tracked files scanned, ${PATTERNS.length} patterns, 0 findings`);
