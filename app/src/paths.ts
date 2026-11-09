import { lstatSync, realpathSync } from "node:fs";
import path from "node:path";

export class PathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathError";
  }
}

const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
const MAX_PATH_LEN = 240;
const MAX_SEGMENT_LEN = 120;

/**
 * Validate a user-supplied note or folder path and return it normalized to
 * forward slashes. Rejects absolute paths, traversal, hidden segments,
 * Windows reserved names and anything that is not plain text.
 */
export function safeRelPath(input: unknown, opts: { markdown?: boolean } = {}): string {
  if (typeof input !== "string" || input.length === 0) throw new PathError("Path must be a non-empty string.");
  if (input.length > MAX_PATH_LEN) throw new PathError("Path is too long.");
  if (input.includes("\0")) throw new PathError("Path contains a NUL byte.");
  if (/[<>:"|?*\u0000-\u001f]/.test(input)) throw new PathError("Path contains characters that are not allowed.");
  const unified = input.replaceAll("\\", "/");
  if (unified.startsWith("/") || /^[a-zA-Z]:/.test(unified)) throw new PathError("Path must be relative.");
  const segments = unified.split("/");
  for (const seg of segments) {
    if (seg === "" || seg === "." || seg === "..") throw new PathError("Path has an empty, '.' or '..' segment.");
    if (seg.startsWith(".")) throw new PathError("Hidden names are not allowed.");
    if (seg.length > MAX_SEGMENT_LEN) throw new PathError("A path segment is too long.");
    if (/[. ]$/.test(seg)) throw new PathError("Names cannot end with a dot or space.");
    if (RESERVED.test(seg)) throw new PathError("Reserved name.");
  }
  if (opts.markdown && !/\.md$/i.test(unified)) throw new PathError("Notes must end in .md.");
  return segments.join("/");
}

/**
 * Resolve a validated relative path inside root. Every existing component
 * must be a real directory or file, never a symlink or junction, and the
 * result must stay inside the canonical root.
 */
export function resolveInside(root: string, rel: string): string {
  const canonicalRoot = realpathSync(root);
  const target = path.join(canonicalRoot, ...rel.split("/"));
  const back = path.relative(canonicalRoot, target);
  if (back === "" || back.startsWith("..") || path.isAbsolute(back)) throw new PathError("Path escapes the data folder.");
  let current = canonicalRoot;
  for (const seg of rel.split("/")) {
    current = path.join(current, seg);
    let st;
    try {
      st = lstatSync(current);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") break;
      throw e;
    }
    if (st.isSymbolicLink()) throw new PathError("Symbolic links are not followed.");
  }
  return target;
}
