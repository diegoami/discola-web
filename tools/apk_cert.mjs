/**
 * Read the signer's SHA-256 fingerprint out of `apksigner verify --print-certs`
 * output.
 *
 * apksigner's exact separator is not worth trusting: the same toolchain has
 * printed plain lowercase hex and colon-separated hex (AA:BB:…), and keytool
 * printed in this repo's own docs uses colons. So take the whole rest of the
 * "SHA-256 digest:" line, strip every non-hex character and lowercase it, then
 * require exactly 64 hex characters. A truncated capture (the old
 * `([0-9a-f]+)` stopped at the first colon) yields the wrong length and is
 * rejected rather than silently compared.
 *
 * Returns the 64-character lowercase digest, or null when the line is missing
 * or malformed.
 */
export function parseCertSha256(out){
  const m = /SHA-256 digest:\s*([^\r\n]+)/i.exec(String(out));
  if (!m) return null;
  const hex = m[1].replace(/[^0-9a-f]/gi, '').toLowerCase();
  return hex.length === 64 ? hex : null;
}

/** Normalize a recorded fingerprint to 64 lowercase hex characters, or null. */
export function normalizeSha256(value){
  const hex = String(value).replace(/[^0-9a-f]/gi, '').toLowerCase();
  return hex.length === 64 ? hex : null;
}
