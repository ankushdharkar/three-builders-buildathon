/**
 * Snippet highlighting for the Source detail drawer (D12).
 *
 * Splits an article body around the first occurrence of the cited `snippet` so the UI
 * can wrap the matched span in a `<mark>` — the visible proof that the answer is
 * grounded in *this* passage. Matching is case-insensitive but the returned text keeps
 * the body's original casing, so the rendered article reads naturally.
 */

export interface Segment {
  text: string;
  mark: boolean;
}

/** Split `body` into segments, marking the first case-insensitive match of `snippet`. */
export function splitHighlight(body: string, snippet?: string): Segment[] {
  const needle = snippet?.trim();
  if (!needle) return [{ text: body, mark: false }];

  const at = body.toLowerCase().indexOf(needle.toLowerCase());
  if (at === -1) return [{ text: body, mark: false }];

  const before = body.slice(0, at);
  const match = body.slice(at, at + needle.length);
  const after = body.slice(at + needle.length);

  const segs: Segment[] = [];
  if (before) segs.push({ text: before, mark: false });
  segs.push({ text: match, mark: true });
  if (after) segs.push({ text: after, mark: false });
  return segs;
}
