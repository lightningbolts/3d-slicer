const MAX_HEX_DISPLAY_BYTES = 2 * 1024 * 1024;

/** Detect ASCII STL (starts with "solid" and contains facet syntax). */
export function isAsciiStl(buffer: ArrayBuffer): boolean {
  const sample = Math.min(4096, buffer.byteLength);
  const head = new TextDecoder('utf-8', { fatal: false }).decode(
    buffer.slice(0, sample),
  );
  return head.trimStart().startsWith('solid') && /facet\s+normal/i.test(head);
}

/** Full file text for ASCII STL, or a hex dump for binary STL. */
export function bufferToRawStlView(buffer: ArrayBuffer): string {
  if (isAsciiStl(buffer)) {
    return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  }

  const bytes = new Uint8Array(buffer);
  const truncated = bytes.length > MAX_HEX_DISPLAY_BYTES;
  const displayBytes = truncated ? bytes.subarray(0, MAX_HEX_DISPLAY_BYTES) : bytes;

  const lines: string[] = [
    `; Binary STL (${bytes.length.toLocaleString()} bytes)`,
    `; Hex dump of uploaded file`,
  ];
  if (truncated) {
    lines.push(
      `; Showing first ${MAX_HEX_DISPLAY_BYTES.toLocaleString()} bytes — download the STL for the full file`,
    );
  }
  lines.push('');

  const perLine = 16;
  for (let i = 0; i < displayBytes.length; i += perLine) {
    const chunk = displayBytes.subarray(i, i + perLine);
    const hex = Array.from(chunk, (b) => b.toString(16).padStart(2, '0')).join(' ');
    const offset = i.toString(16).padStart(8, '0');
    lines.push(`${offset}  ${hex}`);
  }

  return lines.join('\n');
}
