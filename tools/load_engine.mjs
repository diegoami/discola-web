import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Load public/engine.js for the Node tests.
 *
 * The engine is a classic script, not a module, so there is nothing to import.
 * This evaluates it the way a browser would — as plain script text in the global
 * scope — so the code under test is exactly the file the page loads. It runs in
 * this realm rather than a fresh vm context, so the objects the engine builds
 * compare cleanly against the tests' own.
 */
export function loadEngine(){
  const file = fileURLToPath(new URL('../public/engine.js', import.meta.url));
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'DiscolaEngine');
  const previous = globalThis.DiscolaEngine;

  new Function(readFileSync(file, 'utf8'))();
  const engine = globalThis.DiscolaEngine;

  if (had) globalThis.DiscolaEngine = previous;
  else delete globalThis.DiscolaEngine;
  return engine;
}
