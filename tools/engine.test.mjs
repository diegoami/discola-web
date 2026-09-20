import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadEngine } from './load_engine.mjs';

const E = loadEngine();
const {
  BASSO, ALTO, valore, veroValore, piuAlta, buildDeck, mescola,
  makeProfiles, compGioca, createGame,
} = E;

// A reproducible source of the randomness the engine now takes as input. Any
// deterministic generator will do; this is a small LCG.
function lcg(seed){
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/* --- card values and ranking (UMazzo.pas) ---------------------------------- */

test('valore matches TCarta.Valore', () => {
  assert.equal(valore(1), 11);
  assert.equal(valore(3), 10);
  assert.deepEqual([2, 4, 5, 6, 7].map(valore), [0, 0, 0, 0, 0]);
  assert.deepEqual([8, 9, 10].map(valore), [2, 3, 4]);
});

test('veroValore puts the asso above the tre above the re', () => {
  assert.equal(veroValore(1), 12);
  assert.equal(veroValore(3), 11);
  assert.equal(veroValore(10), 10);
  assert.equal(veroValore(2), 2);
});

test('piuAlta: within a suit, ranked by veroValore', () => {
  const d = (n) => ({ s: 0, n });
  assert.equal(piuAlta(d(1), d(10), true, 3), true);   // asso beats re
  assert.equal(piuAlta(d(3), d(1), true, 3), false);   // tre loses to asso
  assert.equal(piuAlta(d(10), d(9), true, 3), true);
});

test('piuAlta: a briscola beats any plainer card', () => {
  assert.equal(piuAlta({ s: 2, n: 2 }, { s: 0, n: 1 }, false, 2), true);  // trump 2 over asso
  assert.equal(piuAlta({ s: 0, n: 1 }, { s: 2, n: 2 }, true, 2), false);  // asso loses to trump
  assert.equal(piuAlta({ s: 2, n: 10 }, { s: 2, n: 3 }, true, 2), false); // among trumps, tre beats re
});

test('piuAlta: off-suit, the leader wins', () => {
  assert.equal(piuAlta({ s: 1, n: 10 }, { s: 0, n: 1 }, false, 3), false); // follower, other suit
  assert.equal(piuAlta({ s: 0, n: 1 }, { s: 1, n: 10 }, true, 3), true);   // self led, other suit
});

/* --- deck and shuffle ------------------------------------------------------ */

test('the deck is 40 unique cards worth 120 points', () => {
  const deck = buildDeck();
  assert.equal(deck.length, 40);
  assert.equal(new Set(deck.map(c => `${c.s}:${c.n}`)).size, 40);
  assert.equal(deck.reduce((t, c) => t + valore(c.n), 0), 120);
  assert.deepEqual(deck[0], { s: 0, n: 1 });
  assert.deepEqual(deck[39], { s: 3, n: 10 });
});

test('mescola is a permutation and is reproducible from a seed', () => {
  const a = buildDeck(); mescola(a, lcg(42));
  const b = buildDeck(); mescola(b, lcg(42));
  assert.deepEqual(a, b);
  assert.equal(new Set(a.map(c => `${c.s}:${c.n}`)).size, 40);

  const c = buildDeck(); mescola(c, lcg(43));
  assert.notDeepEqual(a, c);
});

/* --- profiles (Global.pas SetProfiles) ------------------------------------- */

test('makeProfiles rolls Piero from the injected rng and fixes the rest', () => {
  const p1 = makeProfiles(lcg(7));
  const p2 = makeProfiles(lcg(7));
  assert.deepEqual(p1.Piero, p2.Piero);
  assert.deepEqual(p1.Valerio, p2.Valerio);

  const p3 = makeProfiles(lcg(8));
  assert.notDeepEqual(p1.Piero, p3.Piero);
});

/* --- the opponent's choices (TGiocatore.CompGioca) ------------------------- */

function leadState(oppHand, briscola = 3){
  return {
    opponent: 'Valerio', briscola, perPrimo: ALTO, next: 10, cards: [],
    seen: [], played: [null, null], hands: [[null, null, null], oppHand],
  };
}

test('compGioca leads with the cheapest plain card, not the asso', () => {
  const profiles = makeProfiles(lcg(1));
  const s = leadState([{ s: 0, n: 1 }, { s: 1, n: 2 }, { s: 2, n: 5 }]);
  assert.equal(compGioca(s, profiles), 1);
  // deterministic: no rng is consulted
  assert.equal(compGioca(s, profiles), 1);
});

test('compGioca will not open with a briscola when a plain card is as cheap', () => {
  const profiles = makeProfiles(lcg(1));
  const s = leadState([{ s: 3, n: 1 }, { s: 1, n: 2 }, null]);
  assert.equal(compGioca(s, profiles), 1);
});

/* --- the state machine ----------------------------------------------------- */

test('startHand alternates who leads between hands', () => {
  const game = createGame({ profiles: makeProfiles(lcg(3)), rng: lcg(4) });

  const first = game.startHand();
  assert.equal(game.state.perPrimo, BASSO);
  assert.equal(first.computerToMove, false);

  const second = game.startHand();
  assert.equal(game.state.perPrimo, ALTO);
  assert.equal(second.computerToMove, true);

  const third = game.startHand();
  assert.equal(game.state.perPrimo, BASSO);
  assert.equal(third.computerToMove, false);
});

test('a hand cannot be played out of turn or twice', () => {
  const game = createGame({ profiles: makeProfiles(lcg(5)), rng: lcg(6) });
  game.startHand();                       // human leads
  assert.equal(game.computerPlay().ok, false);   // not the opponent's turn
  assert.equal(game.humanPlay(0).ok, true);
  assert.equal(game.humanPlay(1).ok, false);     // already played this turn
});

test('a full hand conserves 120 points, draws winner-first, and ends empty', () => {
  const profiles = makeProfiles(lcg(2));
  const game = createGame({ profiles, rng: lcg(99) });
  const s = game.state;
  game.startHand();

  let tricks = 0;
  for (let guard = 0; guard < 500; guard++){
    const ev = s.deveGiocare === BASSO
      ? game.humanPlay(s.hands[BASSO].findIndex(Boolean))
      : game.computerPlay();
    assert.equal(ev.ok, true);

    if (!ev.trickComplete) continue;
    tricks++;

    const winner = s.perPrimo;
    const firstDrawn = s.next;            // cards[next] is the next off the deck
    const step = game.resolve();
    if (!step.handOver && firstDrawn < 40)
      assert.ok(s.hands[winner].includes(s.cards[firstDrawn]),
        `trick ${tricks}: the winner should draw first`);
    if (step.handOver) break;
  }

  assert.equal(tricks, 20);
  assert.equal(s.scores[BASSO] + s.scores[ALTO], 120);
  assert.equal(s.next, 40);
  assert.deepEqual(s.hands[BASSO], [null, null, null]);
});
