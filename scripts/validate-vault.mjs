import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vault = path.join(repo, 'vault');
const errors = [];
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      errors.push(`Unexpected symlink in research vault: ${path.relative(vault, full)}`);
    } else if (entry.isDirectory()) {
      if (entry.name !== '.trash' && entry.name !== 'cache') walk(full);
    } else files.push(full);
  }
}
walk(vault);
const rel = p => path.relative(vault, p).split(path.sep).join('/');
const norm = s => s.normalize('NFC').toLowerCase();
const fileNames = new Set(files.map(p => norm(rel(p))));
const noteNames = new Map();
for (const file of files.filter(p => p.endsWith('.md'))) {
  const name = norm(path.basename(file, '.md'));
  if (noteNames.has(name)) errors.push(`Ambiguous note name: ${rel(file)} and ${noteNames.get(name)}`);
  else noteNames.set(name, rel(file));
}
let links = 0;
let jsonCount = 0;
let evidenceCount = 0;
const secretPatterns = [
  /\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/,
  /\bBearer\s+[A-Za-z0-9._-]{20,}/,
  /(?:^|\n)[\s-]*(?:cookie|set-cookie|authorization):\s*\S+/i,
  /[?&](?:access_token|refresh_token|id_token|code)=[A-Za-z0-9._-]{12,}/i,
  /\/devtools\/browser\/[a-f0-9-]{20,}/i,
];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of secretPatterns) {
    if (pattern.test(text)) errors.push(`Potential secret/runtime browser identifier in ${rel(file)} (${pattern.source}); inspect without printing its value`);
  }
  if (file.endsWith('.json')) {
    jsonCount++;
    try {
      const value = JSON.parse(text);
      if (rel(file).startsWith('90 Attachments/REA/')) {
        evidenceCount++;
        if (value.evidence_id !== path.basename(file, '.json')) errors.push(`REA file/record identity mismatch: ${rel(file)}`);
        if (!Array.isArray(value.limitations)) errors.push(`REA record lacks limitations array: ${rel(file)}`);
      }
    } catch (error) { errors.push(`Invalid JSON ${rel(file)}: ${error.message}`); }
  }
  if (!file.endsWith('.md')) continue;
  for (const match of text.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
    links++;
    const target = match[1].split('|')[0].split('#')[0].trim();
    if (!target) continue;
    let decoded;
    try { decoded = decodeURIComponent(target).replaceAll('\\', '/'); }
    catch { errors.push(`Invalid encoded link in ${rel(file)}: ${target}`); continue; }
    const local = path.posix.normalize(path.posix.join(path.posix.dirname(rel(file)), decoded));
    const candidates = [decoded, local];
    const exact = candidates.some(s => fileNames.has(norm(s)) || fileNames.has(norm(`${s}.md`)));
    const short = !decoded.includes('/') && noteNames.has(norm(decoded.replace(/\.md$/i, '')));
    if (!exact && !short) errors.push(`Unresolved wikilink in ${rel(file)}: ${target}`);
  }
}
const exported = path.join(vault, '90 Attachments', 'sandbox-export.md');
const expectedHash = 'd934251c71868732184e873fa423dc3264c3a11409aa6bf9498eedb31ffe4dd4';
if (!fs.existsSync(exported)) errors.push('Missing synthetic sandbox export');
else {
  const actual = crypto.createHash('sha256').update(fs.readFileSync(exported)).digest('hex');
  if (actual !== expectedHash) errors.push(`Sandbox export differs from verified download hash (expected ${expectedHash}, actual ${actual})`);
}
console.log(`Vault: ${files.length} files, ${noteNames.size} Markdown notes, ${links} wikilinks, ${jsonCount} JSON files, ${evidenceCount} REA records.`);
console.log('Checks do not authenticate REA digests, heading targets, vendor claims, account entitlements or model quality.');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log('PASS: links, JSON, record filenames, secret-marker scan and export integrity.');
