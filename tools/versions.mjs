/**
 * Numeric ordering for dotted version strings.
 *
 * The default Array#sort is lexicographic, which puts "v1.10.0" *before*
 * "v1.9.0" — fine until a component gains a second digit, then release tooling
 * that trusts `.sort().pop()` publishes the wrong build. Both `vX.Y.Z` release
 * directories and Android build-tools versions sort with this instead.
 *
 * Only the numeric prefix of each dot-separated component is compared, so a
 * leading "v" and trailing qualifiers (`35.0.0`, `v1.10.0`) are both handled.
 */

/** Parse "v1.10.0" or "35.0.0" into [1, 10, 0]; non-numeric parts read as 0. */
export function parseVersion(str){
  return String(str).replace(/^v/i, "").split(".").map(p => Number.parseInt(p, 10) || 0);
}

/** Sort comparator: negative if a < b, positive if a > b, 0 if equal. */
export function compareVersions(a, b){
  const pa = parseVersion(a), pb = parseVersion(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++){
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}
