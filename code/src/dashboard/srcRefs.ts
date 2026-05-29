/**
 * Parse `[src: n]` / `[src: n, m]` citation markers out of a justification string so the
 * footer can render each number as a clickable chip that opens the corresponding source
 * in the drawer (D12 cross-link). Numbers are 1-based indices into the decision's
 * `sources`. A `[no src]` marker has no digits and stays as plain text.
 */

export type SrcSegment = { text: string } | { src: number };

const REF = /\[src:\s*([\d,\s]+)\]/gi;

export function parseSrcRefs(text: string): SrcSegment[] {
  const segments: SrcSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(REF)) {
    const before = text.slice(last, m.index);
    if (before) segments.push({ text: before });
    for (const part of m[1].split(",")) {
      const n = Number(part.trim());
      if (Number.isInteger(n) && n > 0) segments.push({ src: n });
    }
    last = m.index + m[0].length;
  }
  const tail = text.slice(last);
  if (tail) segments.push({ text: tail });
  return segments.length > 0 ? segments : [{ text }];
}
