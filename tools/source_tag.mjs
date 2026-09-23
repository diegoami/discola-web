/**
 * Ties a staged release to the source it was built from.
 *
 * The packager records the commit and tree it built (`dist-release/vX.Y.Z.source`,
 * beside the staged directory so the SHA256SUMS.txt set stays exactly the
 * assets). The publisher refuses to publish unless `vX.Y.Z` exists on origin and
 * points at a commit with that same tree.
 *
 * Trees, not commits: a release is packaged on its `release/X.Y.Z` branch before
 * the merge and tagged on the merge commit after it. A merge of an up-to-date
 * branch has the head's tree, so the tag is checkable although the packager
 * never saw the commit it lands on.
 *
 * Record format, LF endings:
 *
 *     commit <hex>
 *     tree <hex>
 */

const OID = /^[0-9a-f]{40}([0-9a-f]{24})?$/;

/** Serialize `{ commit, tree }` as a source record. */
export function formatSource({ commit, tree }){
  for (const [key, oid] of [['commit', commit], ['tree', tree]])
    if (!OID.test(oid ?? '')) throw new Error(`${key} is not a full object id: ${oid}`);
  return `commit ${commit}\ntree ${tree}\n`;
}

/** Parse a source record. Throws unless it is exactly `formatSource`'s output. */
export function parseSource(text){
  const m = /^commit (\S+)\ntree (\S+)\n$/.exec(text);
  if (!m || !OID.test(m[1]) || !OID.test(m[2]))
    throw new Error('the source record is not "commit <oid>\\ntree <oid>\\n"');
  return { commit: m[1], tree: m[2] };
}

/**
 * The commit `tag` names in `git ls-remote --tags` output, or null when the tag
 * is absent. An annotated tag lists the tag object and then the peeled commit
 * (`^{}`); a lightweight tag lists the commit alone. Refs must match exactly, so
 * v1.0.1 is not satisfied by v1.0.10 or by some/prefix/v1.0.1.
 */
export function tagCommit(lsRemote, tag){
  let direct = null, peeled = null;
  for (const line of lsRemote.split(/\r?\n/)) {
    const m = /^([0-9a-f]+)\t(\S+)$/.exec(line);
    if (!m) continue;
    if (m[2] === `refs/tags/${tag}^{}`) peeled = m[1];
    else if (m[2] === `refs/tags/${tag}`) direct = m[1];
  }
  return peeled ?? direct;
}
