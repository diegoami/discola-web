# Discola

**[Italiano](#italiano) · [English](#english)**

**Source code / Codice sorgente:** [discola-web](https://github.com/diegoami/discola-web)

Briscola for two players, written in Delphi 3 in 1997 by Diego Amicabile and
ported to the web. Here you'll find the Android app and the rules — to play in
the browser right now, go to **<https://discola.netlify.app>**.

---

## Italiano

Briscola a due, scritta in Delphi 3 nel 1997 da Diego Amicabile e portata sul
web. Qui trovi l'app per Android e le regole; per giocare subito nel browser
vai su **<https://discola.netlify.app>**.

### Scarica

- **Android:** prendi il file `.apk` dall'[ultima release](https://github.com/diegoami/discola-web/releases/latest),
  aprilo sul telefono e consenti l'installazione da questa fonte. È la stessa
  versione del sito, ma si gioca senza connessione: le carte, i caratteri e
  tutto il resto sono dentro l'app, e niente lascia il telefono.

Ogni release riporta il checksum SHA-256 dei file in `SHA256SUMS.txt`. Windows o
Android possono avvisarti che l'app viene da uno sviluppatore sconosciuto: è
normale per un'app distribuita fuori dagli store.

### Le regole

La briscola a due con un mazzo italiano da 40 carte: quattro semi — denari,
coppe, spade, bastoni — e in ogni seme le carte da 1 (asso) a 10 (re), passando
per fante (8), cavallo (9) e re (10).

**Come si vince.** Vince la partita chi arriva per primo a **61 punti su 120**.

**Valore delle carte.** I punti stanno quasi tutti in cinque carte per seme:

| Carta | Punti |
|---|---:|
| Asso | 11 |
| Tre | 10 |
| Re | 4 |
| Cavallo | 3 |
| Fante | 2 |
| 7, 6, 5, 4, 2 | 0 |

Cinque per seme fanno 30 punti, per quattro semi fanno i 120 in gioco.

**Chi batte chi.** Quando due carte non contano i punti ma decidono chi prende,
l'ordine dentro un seme è: **Asso, Tre, Re, Cavallo, Fante, 7, 6, 5, 4, 2** —
l'asso e il tre stanno sopra le figure, che è la sorpresa di chi arriva da altri
giochi.

**La briscola.** A inizio partita l'ultima carta del mazzo viene girata scoperta
e il suo seme è la *briscola*, che vale più di ogni altro seme per tutta la mano.

**La presa.** Chi gioca per primo cala una carta qualsiasi; l'avversario risponde
con quella che vuole — non c'è obbligo di rispondere al seme. La presa la vince:

- una briscola su una non-briscola;
- fra due briscole, o fra due carte dello stesso seme, quella più alta
  nell'ordine qui sopra;
- se i semi sono diversi e nessuna è briscola, **la carta di chi ha aperto**: la
  risposta di un altro seme non prende.

Chi vince la presa incassa le due carte, pesca per primo dal mazzo e apre la
presa successiva. Quando il mazzo finisce si gioca con le carte in mano fino
all'ultima.

### Gli avversari

Quattro, gli stessi del 1997, ognuno con il suo carattere:

| Avversario | Carattere |
|---|---|
| **Valerio** | Lo standard della casa. Equilibrato. |
| **Graziano** | Il più sciolto: brucia le briscole presto. |
| **Piero** | Cambia carattere a ogni sessione. |
| **Franco** | Il più tirchio: si tiene le briscole fino in fondo. |

E sei mazzi fra cui scegliere: cinque sono le immagini originali del programma
del 1997 — Trevisane, Piacentine, Napoletane, Romagnole e Francesi — a cui si
aggiunge un mazzo Bresciane.

### Un dettaglio

L'icona dell'app è il fante di spade delle Trevisane. In Veneto quella carta si
chiama *la vecia*, la vecchia — anche se di vecchia non ha niente e i baffi ce li
ha eccome. Non chiedete perché: è così e basta.

### Provenienza

- Sorgente Delphi del 1997: [`diegoami/discola-PAS`](https://github.com/diegoami/discola-PAS)
- Gioca nel browser: <https://discola.netlify.app>

Il codice sorgente e le release scaricabili si trovano insieme in
[discola-web](https://github.com/diegoami/discola-web).

---

## English

Two-player Briscola, written in Delphi 3 in 1997 by Diego Amicabile and ported
to the web. This repo has the Android app and the rules; to play in the browser
right now, go to **<https://discola.netlify.app>**.

### Download

- **Android:** grab the `.apk` from the [latest release](https://github.com/diegoami/discola-web/releases/latest),
  open it on your phone and allow installing from this source. It's the same
  version as the website, but it plays offline: the cards, the fonts and
  everything else are inside the app, and nothing leaves the device.

Every release lists the SHA-256 checksums of its files in `SHA256SUMS.txt`.
Windows or Android may warn that the app comes from an unknown developer — that's
normal for an app distributed outside the stores.

### The rules

Two-player Briscola with a 40-card Italian deck: four suits — coins (denari),
cups (coppe), swords (spade), batons (bastoni) — and in each suit the cards 1
(ace) to 10 (king), via jack (fante, 8), knight (cavallo, 9) and king (re, 10).

**Winning.** First to **61 points out of 120** wins the game.

**Card values.** Almost all the points sit in five cards per suit:

| Card | Points |
|---|---:|
| Ace | 11 |
| Three | 10 |
| King | 4 |
| Knight | 3 |
| Jack | 2 |
| 7, 6, 5, 4, 2 | 0 |

Five per suit make 30 points; across four suits, the 120 in play.

**What beats what.** When two cards don't score but decide who takes the trick,
the order within a suit is: **Ace, Three, King, Knight, Jack, 7, 6, 5, 4, 2** —
the ace and the three sit above the court cards, which surprises players coming
from other games.

**The trump (briscola).** At the start the last card of the deck is turned face
up, and its suit is the *briscola*, which outranks every other suit for the
whole hand.

**The trick.** The player to lead plays any card; the opponent answers with
whatever they like — there's no obligation to follow suit. The trick goes to:

- a briscola over a non-briscola;
- between two briscole, or two cards of the same suit, the higher in the order
  above;
- if the suits differ and neither is briscola, **the card that led** — an answer
  of another suit does not take it.

Whoever wins the trick takes both cards, draws first from the deck and leads the
next trick. When the deck runs out, you play on with the cards in hand to the
last.

### The opponents

Four, the same as in 1997, each with its own temperament:

| Opponent | Character |
|---|---|
| **Valerio** | The house standard. Balanced. |
| **Graziano** | The loosest: burns his briscole early. |
| **Piero** | Changes character every session. |
| **Franco** | The tightest: holds his briscole to the end. |

And six decks to choose from: five are the original images from the 1997 program
— Trevisane, Piacentine, Napoletane, Romagnole and Francesi — plus a Bresciane
deck.

### One detail

The app's icon is the jack of swords from the Trevisane deck. In the Veneto that
card is called *la vecia*, the old woman — even though there's nothing old-womanly
about it and it has quite the moustache. Don't ask why: that's just what it is.

### Provenance

- 1997 Delphi source: [`diegoami/discola-PAS`](https://github.com/diegoami/discola-PAS)
- Play in the browser: <https://discola.netlify.app>

Source code and downloadable releases live together in [discola-web](https://github.com/diegoami/discola-web).
