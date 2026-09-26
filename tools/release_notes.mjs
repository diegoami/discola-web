/**
 * Compose the GitHub release notes for a Discola release.
 *
 * Italian, to match the game (`ANDROID.md:371-373`). The per-platform
 * paragraphs are the parts that must not drift from what is actually staged:
 * the Windows paragraph carries the SmartScreen instructions that unsigned-first
 * leaves to the release page (`DESKTOP.md:24`), and the Android paragraph the
 * unknown-source warning. Everything release-specific — what changed — is the
 * caller's `subtitle`.
 *
 * Pure: takes the version and the platforms present, returns the note text.
 * Unknown or empty platform lists are errors; a release nobody can install is
 * not a release.
 */

const SECTIONS = {
  windows: (v) =>
    `**Windows:** scarica \`Discola-${v}-windows-x64.exe\` e avvialo. ` +
    `L'eseguibile non è firmato digitalmente, quindi Windows mostrerà l'avviso ` +
    `«Windows ha protetto il PC»: clicca «Ulteriori informazioni», poi «Esegui ` +
    `comunque». È portabile, senza installer: mettilo dove preferisci.`,
  android: (v) =>
    `**Android:** \`Discola-${v}-android.apk\` — apri il file sul telefono e ` +
    `consenti l'installazione da questa fonte.`,
};

// Windows first: 1.0.4 is its debut, and it is the unfamiliar download.
const ORDER = ['windows', 'android'];

export function buildNotes(version, platforms, { subtitle, commit, changes = [] } = {}){
  if (commit !== undefined && !/^[0-9a-f]{40}([0-9a-f]{24})?$/.test(commit))
    throw new Error(`the source commit is not a full object id: ${commit}`);
  if (changes.some((c) => typeof c !== 'string' || !c.trim()))
    throw new Error('every entry in changes must be a non-empty line');
  if (!platforms.length) throw new Error('a release needs at least one platform');
  const unique = [...new Set(platforms)];
  for (const p of unique)
    if (!SECTIONS[p]) throw new Error(`unknown platform: ${p}`);
  const present = ORDER.filter((p) => unique.includes(p));

  const title = subtitle ? `Discola ${version} — ${subtitle}.` : `Discola ${version}.`;
  const sections = present.map((p) => SECTIONS[p](version)).join('\n\n');
  const history = present.length > 1
    ? 'In entrambe le versioni lo storico delle partite resta sul dispositivo: ' +
      'niente lascia il telefono o il computer.'
    : 'Lo storico delle partite resta sul dispositivo: niente lascia il dispositivo.';

  // What changed, as the list releases 1.0.1-1.0.3 carried: set per release on
  // the milestone's candidate, so the reviewer reads the notes that ship.
  const news = changes.length
    ? `**Novità in questa versione**\n${changes.map((c) => `- ${c}`).join('\n')}\n\n`
    : '';

  return `${title}\n\n${news}${sections}\n\n${history}\n\n` +
    `**Gioca nel browser:** https://discola.netlify.app/\n\n` +
    `Checksum SHA-256 in \`SHA256SUMS.txt\`.\n` +
    // The milestone tag's commit, so a binary names its source; the source
    // repo is private, so the commit, not a link.
    (commit ? `\nCompilato dal commit \`${commit}\` (tag \`v${version}\`).\n` : '');
}
