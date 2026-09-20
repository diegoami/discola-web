/**
 * Discola's rules engine — a direct transcription of UMazzo.pas and
 * TGiocatore.CompGioca in UGiocatore.pas, with the twelve tuned weights per
 * profile from Global.pas, kept as the original had them.
 *
 * Loaded by public/index.html as a classic script, not an ES module: module
 * imports are blocked over file://, and opening the page from disk is a
 * supported way to play. Nothing here touches the DOM, timers or storage;
 * randomness is injected, and the UI drives the turn state machine.
 *
 * `createGame` owns the cards, hands, scores and turn state. Each method
 * performs one logical step and returns an event describing what happened;
 * the caller decides what to render and when to schedule the next step.
 *
 * In Node the tests read this file and evaluate it as the classic script it is
 * (see tools/load_engine.mjs), so the code under test is the code the browser
 * runs.
 */
(function (root) {
  "use strict";

  /* --- cards (UMazzo.pas) -------------------------------------------------- */

  // TSeme order: Denari, Coppe, Spade, Bastoni. The sprite sheet uses the same
  // order for its rows, and column n-1 for card number n.
  const SUITS = ["denari", "coppe", "spade", "bastoni"];

  const BASSO = 0; // the human player, at the bottom of the table
  const ALTO = 1;  // the computer, at the top

  // TCarta.Valore
  function valore(n) {
    if (n === 1) return 11;
    if (n === 3) return 10;
    if (n >= 8) return n - 6;
    return 0;
  }

  // TCarta.piuAlta's local veroValore: the asso and the tre outrank the re
  function veroValore(n) {
    if (n === 3) return 11;
    if (n === 1) return 12;
    return n;
  }

  // TCarta.piuAlta — does `self` beat `other`? `led` is true when self led.
  function piuAlta(self, other, led, briscola) {
    if (self.s === briscola) {
      if (other.s !== briscola) return true;
      return veroValore(self.n) > veroValore(other.n);
    }
    if (other.s === briscola) return false;
    if (self.s !== other.s) return led;
    return veroValore(self.n) > veroValore(other.n);
  }

  // TMazzo.Init — 40 cards, suit-major
  function buildDeck() {
    const cards = [];
    for (let s = 0; s < 4; s++)
      for (let n = 1; n <= 10; n++)
        cards.push({ s, n });
    return cards;
  }

  // TMazzo.Mescola — 200 + Random(100) random swaps
  function mescola(cards, rng) {
    const random = rng || Math.random;
    const swaps = 200 + Math.floor(random() * 100);
    for (let i = 0; i < swaps; i++) {
      const a = Math.floor(random() * 40);
      const b = Math.floor(random() * 40);
      const t = cards[a]; cards[a] = cards[b]; cards[b] = t;
    }
  }

  /* --- opponent profiles (Global.pas SetProfiles) -------------------------- */

  const WEIGHT_KEYS = [
    "FIXED_BRISCOLA_PENALTY", "VARIANT_BRISCOLA_PENALTY", "VARIANT_CARICO_PENALTY",
    "VARIANT_STROZZO_PENALTY", "FIXED_TRE_PENALTY", "VARIANT_WINNING_CARD_PENALTY",
    "FIXED_WINNER_BRISCOLA_PENALTY", "VARIANT_WINNER_BRISCOLA_PENALTY",
    "FIXED_LOSER_BRISCOLA_PENALTY", "VARIANT_LOSER_BRISCOLA_PENALTY",
    "VARIANT_PASSIVE_STROZZO_PENALTY", "ASSO_PENALTY"
  ];

  function weights(v) {
    const o = {};
    WEIGHT_KEYS.forEach((k, i) => { o[k] = v[i]; });
    return o;
  }

  // SetProfiles runs once at startup, so Piero's randomised temperament is fixed
  // for the session — you never play the same Piero twice, but you do play the
  // same Piero all evening. That is the original behaviour.
  function makeProfiles(rng) {
    const random = rng || Math.random;
    // Pascal Random(n) is an integer in 0..n-1; bare Random is a real in [0,1).
    const randInt = (n) => Math.floor(random() * n);
    const rnd = () => random();
    return {
      Valerio:  weights([3,   0.7, 0.045, 0.45, 2.5, 0.6, 4, 1.2, 5.5, 1.6, 0.18, 1.5]),
      Graziano: weights([2,   0.8, 0.065, 0.30, 1.5, 0.5, 3, 1.1, 4.5, 1.4, 0.10, 1.0]),
      Piero:    weights([
        2 + randInt(3),      0.5 + rnd() / 3,  0.045 + rnd() / 20,
        0.3 + rnd() / 5,     1 + randInt(2),   0.5 + rnd() / 4,
        3 + randInt(2),      0.9 + rnd(),      5 + randInt(2),
        0.8 + rnd() / 2,     0.15 + rnd() / 10, 1 + rnd()
      ]),
      Franco:   weights([4.5, 0.5, 0.085, 0.50, 3.0, 0.7, 5, 1.0, 6.0, 1.2, 0.23, 2.0])
    };
  }

  /* --- the opponent (TGiocatore.CompGioca) --------------------------------- */

  // SemiAndati and CountCarte walked CarteViste from index 1 in the 1997 source,
  // not 0, so the opponent never counted the first card it was dealt — a TList is
  // zero-based. Fixed here. It changes almost nothing: over 40,000 simulated hands
  // per profile the win rate moved by at most 0.56 percentage points and the mean
  // score by at most 0.2 points of 120, both inside the noise floor. One forgotten
  // card out of the twenty-odd tracked rarely flips a comparison that briscola and
  // card values already dominate.
  function semiAndati(state, suit) {
    let total = 0;
    for (let i = 0; i < state.seen.length; i++)
      if (state.seen[i].s === suit) total += valore(state.seen[i].n);
    return total;
  }

  function countCarte(state, suit) {
    let count = 0;
    for (let i = 0; i < state.seen.length; i++)
      if (state.seen[i].s === suit) count++;
    return count;
  }

  // The card the opponent chooses. `against` is the human's played card, or null
  // when the opponent leads. Pure: read state, pick a slot, change nothing.
  function compGioca(state, profiles) {
    const against = state.played[BASSO];
    const P = profiles[state.opponent];
    const hand = state.hands[ALTO];
    const brisc = state.briscola;

    let bestSlot = 0;
    let bestScore = -150;

    if (against === null) {
      // leading: shed the cheapest card that is not a briscola and not worth points
      for (let i = 0; i < 3; i++) {
        const c = hand[i];
        if (!c) continue;
        const v = valore(c.n);
        let score;
        if (c.s === brisc) {
          score = 100 - P.FIXED_BRISCOLA_PENALTY - v * P.VARIANT_BRISCOLA_PENALTY;
        } else {
          score = 100 - v * (1 - P.VARIANT_CARICO_PENALTY * countCarte(state, brisc));
          if (v < 10) score += semiAndati(state, c.s) * P.VARIANT_STROZZO_PENALTY;
        }
        if (v === 10) score -= P.FIXED_TRE_PENALTY;
        if (score > bestScore) { bestScore = score; bestSlot = i; }
      }
      return bestSlot;
    }

    // following: weigh what the trick is worth against what taking it costs
    const cartaval = valore(against.n);
    for (let i = 0; i < 3; i++) {
      const c = hand[i];
      if (!c) continue;
      const led = state.perPrimo === ALTO;
      const prende = piuAlta(c, against, led, brisc);
      const miaval = valore(c.n);

      let score = prende
        ? cartaval + miaval * P.VARIANT_WINNING_CARD_PENALTY
        : -cartaval * P.VARIANT_WINNING_CARD_PENALTY - miaval;

      if (c.s === brisc) {
        score -= prende
          ? miaval * P.VARIANT_WINNER_BRISCOLA_PENALTY + P.FIXED_WINNER_BRISCOLA_PENALTY
          : miaval * P.VARIANT_LOSER_BRISCOLA_PENALTY + P.FIXED_LOSER_BRISCOLA_PENALTY;
      } else if (miaval < 10) {
        score -= semiAndati(state, c.s) * P.VARIANT_PASSIVE_STROZZO_PENALTY;
      }

      // taking this trick would hand the opponent the face-up briscola
      if (state.next === 38 && prende) {
        score -= valore(state.cards[39].n) * P.VARIANT_WINNER_BRISCOLA_PENALTY
               + P.FIXED_WINNER_BRISCOLA_PENALTY;
      }
      if (miaval === 11) score -= P.ASSO_PENALTY;

      if (score > bestScore) { bestScore = score; bestSlot = i; }
    }
    return bestSlot;
  }

  /* --- state and turn transitions ------------------------------------------ */

  function initialState() {
    return {
      cards: [],
      next: 0,            // TMazzo.Tallone - 1
      briscola: 0,        // SemeBriscola
      hands: [[null, null, null], [null, null, null]],
      played: [null, null],
      scores: [0, 0],
      seen: [],           // Giocatori[Alto].CarteViste
      perPrimo: BASSO,
      deveGiocare: BASSO,
      partitaPrimo: BASSO,
      over: false,
      dealt: false,
      opponent: "Valerio"
    };
  }

  function pop(state) {
    // Pesca only draws while cards remain; past that a player's hand just thins out.
    if (state.next >= 40) return null;
    return state.cards[state.next++];
  }

  function pesca(state, who) {
    const card = pop(state);
    if (card === null) return;
    if (who === ALTO) state.seen.push(card);
    const hand = state.hands[who];
    let i = 0;
    while (hand[i] !== null && i < 2) i++;
    hand[i] = card;
  }

  function aggiornaPunti(state) {
    const worth = valore(state.played[BASSO].n) + valore(state.played[ALTO].n);
    state.scores[state.perPrimo] += worth;
  }

  // One game, no DOM. `rng` is injected so a test can replay a fixed shuffle;
  // `profiles` defaults to a fresh set, but the page passes its session set so
  // the settings screen and the opponent agree.
  function createGame({ profiles, rng = Math.random } = {}) {
    const P = profiles || makeProfiles(rng);
    const state = initialState();

    // TForm1.Redo: deal a fresh hand. Whoever did not lead last leads this one.
    function startHand() {
      state.cards = buildDeck();
      mescola(state.cards, rng);
      state.next = 0;
      state.briscola = state.cards[39].s;   // the bottom card names the trump suit
      state.seen = [];
      state.played = [null, null];
      state.scores = [0, 0];
      state.over = false;
      state.dealt = true;

      for (const who of [BASSO, ALTO]) {
        state.hands[who] = [null, null, null];
        pesca(state, who); pesca(state, who); pesca(state, who);
      }

      state.perPrimo = state.partitaPrimo;
      state.deveGiocare = state.perPrimo;

      if (state.perPrimo === ALTO) {
        state.partitaPrimo = BASSO;
        return { computerToMove: true };
      }
      state.partitaPrimo = ALTO;
      return { computerToMove: false };
    }

    // TForm1.Gioca1Click
    function humanPlay(slot) {
      if (state.over) return { ok: false };
      if (state.deveGiocare !== BASSO || state.played[BASSO]) return { ok: false };
      const card = state.hands[BASSO][slot];
      if (!card) return { ok: false };

      state.hands[BASSO][slot] = null;
      state.played[BASSO] = card;
      state.seen.push(card);          // the opponent watches what you put down
      state.deveGiocare = ALTO;

      if (state.perPrimo === ALTO) {
        // you followed, so the trick is complete
        state.perPrimo = piuAlta(card, state.played[ALTO], false, state.briscola) ? BASSO : ALTO;
        state.deveGiocare = state.perPrimo;
        aggiornaPunti(state);
        return { ok: true, placed: true, sound: 520, trickComplete: true };
      }
      return { ok: true, placed: true, sound: 520, computerToMove: true };
    }

    // TForm1.Gioca2Click
    function computerPlay() {
      if (state.over || state.deveGiocare !== ALTO) return { ok: false };

      const slot = compGioca(state, P);
      const card = state.hands[ALTO][slot];
      if (!card) return { ok: false };

      state.hands[ALTO][slot] = null;
      state.played[ALTO] = card;
      state.deveGiocare = BASSO;

      if (state.perPrimo === BASSO) {
        // the opponent followed, so the trick is complete
        state.perPrimo = piuAlta(state.played[BASSO], card, true, state.briscola) ? BASSO : ALTO;
        state.deveGiocare = state.perPrimo;
        aggiornaPunti(state);
        return { ok: true, placed: true, sound: 420, trickComplete: true };
      }
      return { ok: true, placed: true, sound: 420 };
    }

    // EffettuaPescaggi + the end-of-hand check
    function resolve() {
      state.played = [null, null];

      const handsEmpty = state.hands[BASSO].every((c) => c === null);
      if (handsEmpty) return { handOver: true };

      // the winner of the trick draws first
      pesca(state, state.perPrimo);
      pesca(state, state.perPrimo === BASSO ? ALTO : BASSO);
      return { drew: true, computerToMove: state.deveGiocare === ALTO };
    }

    return { state, startHand, humanPlay, computerPlay, resolve };
  }

  root.DiscolaEngine = {
    SUITS, BASSO, ALTO, valore, veroValore, piuAlta, buildDeck, mescola,
    WEIGHT_KEYS, weights, makeProfiles, semiAndati, countCarte, compGioca,
    initialState, createGame
  };
})(globalThis);
