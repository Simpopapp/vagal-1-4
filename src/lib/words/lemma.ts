/**
 * Word identity: the lemma is the key of the vocabulary (PRD D7).
 *
 * "flying", "flew" and "flies" all study as `fly`, and the same word met in a
 * new song joins the entry that already exists instead of duplicating it.
 *
 * This is deliberately conservative: it only folds the regular English
 * inflections that a lyrics corpus actually produces, and leaves anything it
 * is not sure about alone — a wrong lemma merges two different words, which is
 * far worse than a missed one. A rule therefore has to be right for *every*
 * word it can touch, not just for the common ones.
 */

const IRREGULAR: Record<string, string> = {
  went: "go",
  gone: "go",
  had: "have",
  has: "have",
  did: "do",
  does: "do",
  done: "do",
  was: "be",
  were: "be",
  been: "be",
  am: "be",
  are: "be",
  is: "be",
  said: "say",
  made: "make",
  took: "take",
  taken: "take",
  came: "come",
  saw: "see",
  seen: "see",
  knew: "know",
  known: "know",
  thought: "think",
  told: "tell",
  found: "find",
  gave: "give",
  given: "give",
  got: "get",
  gotten: "get",
  held: "hold",
  left: "leave",
  felt: "feel",
  meant: "mean",
  kept: "keep",
  began: "begin",
  begun: "begin",
  wrote: "write",
  written: "write",
  spoke: "speak",
  spoken: "speak",
  stood: "stand",
  heard: "hear",
  lay: "lie",
  laid: "lay",
  rose: "rise",
  risen: "rise",
  broke: "break",
  broken: "break",
  chose: "choose",
  chosen: "choose",
  drew: "draw",
  drawn: "draw",
  drove: "drive",
  driven: "drive",
  fell: "fall",
  fallen: "fall",
  flew: "fly",
  flown: "fly",
  grew: "grow",
  grown: "grow",
  threw: "throw",
  thrown: "throw",
  wore: "wear",
  worn: "wear",
  awoke: "awake",
  awoken: "awake",
  became: "become",
  bent: "bend",
  burnt: "burn",
  dreamt: "dream",
  leant: "lean",
  learnt: "learn",
  spelt: "spell",
  // verb pairs the regular rules cannot derive
  ran: "run",
  sang: "sing",
  sung: "sing",
  rang: "ring",
  rung: "ring",
  drank: "drink",
  drunk: "drink",
  blew: "blow",
  blown: "blow",
  rode: "ride",
  ridden: "ride",
  woke: "wake",
  hid: "hide",
  swam: "swim",
  swum: "swim",
  // -ing / -ed forms of verbs whose base ends in a silent -e
  dying: "die",
  lying: "lie",
  tying: "tie",
  died: "die",
  tied: "tie",
  lied: "lie",
  used: "use",
  using: "use",
};

const UNCHANGED = new Set([
  "put",
  "cut",
  "hit",
  "hurt",
  "let",
  "set",
  "shut",
  "read",
  "rid",
  "bet",
  "cost",
  "quit",
  "spread",
  "swept",
  "crept",
  "sent",
  "spent",
  "built",
  "brought",
  "caught",
  "taught",
  "bought",
  "fought",
  "sought",
  "met",
  "sat",
  "lost",
  "paid",
  "sold",
  "led",
  "fed",
  "bled",
  "shed",
  "slept",
  "dealt",
]);

function isVowelAt(word: string, i: number): boolean {
  const c = word[i];
  return c === "a" || c === "e" || c === "i" || c === "o" || c === "u";
}

/**
 * Doubled letters that English keeps in the base word. Folding these is what
 * turned `rolling` into `rol` and `called` into `cal`: the doubling is part of
 * the stem, not something the ending added.
 */
const DOUBLED_IN_BASE = new Set(["ll", "ss", "zz", "ff", "dd", "cc"]);

/**
 * Stem endings whose base carries a silent -e (make/making, dance/dancing,
 * live/living). Only endings that hold for every word in the lyrics corpus are
 * listed; ambiguous ones (`wait`, `visit`, `wear`, `dream`, `join`, `book`,
 * `river`) are deliberately left out so they stay unfolded instead of turning
 * into junk headwords.
 */
const SILENT_E = [
  "ak", "ik", "ap", "ip", "op", "ot", "id", "iv", "ov", "av", "rv",
  "nc", "uc", "ir", "or", "ur", "od", "at", "is", "ic", "os", "us", "rit",
];

/**
 * Narrower set for comparatives: enough for `braver`/`wiser`/`nicer` without
 * letting `river`, `lover`, `cover` or `power` be pulled into `rive`, `love`,
 * `cove` or `powe`.
 */
const SILENT_E_COMPARATIVE = [
  "ak", "ik", "ap", "ip", "op", "ot", "at", "is", "ic",
  "ur", "ir", "or", "od", "av", "rit",
];

/** Stem endings whose base really does stop there (`shoot`, `pour`, `quick`). */
const NO_SILENT_E = ["ck", "our", "oot", "ver"];

function endsWithAny(word: string, endings: string[]): boolean {
  return endings.some((e) => word.endsWith(e));
}

/**
 * Undoes a doubling the ending itself created: `runn` -> `run`, `stopp` ->
 * `stop`. Returns null when the doubled pair belongs to the base.
 */
function undouble(stem: string): string | null {
  if (stem.length < 3) return null;
  const a = stem[stem.length - 2];
  const b = stem[stem.length - 1];
  if (a === undefined || b === undefined || a !== b) return null;
  if (DOUBLED_IN_BASE.has(a + b)) return null;
  // doubling only happens after a single vowel: r-u-n -> runn, s-t-o-p -> stopp
  if (!isVowelAt(stem, stem.length - 3)) return null;
  return stem.slice(0, -1);
}

/** Restores the silent -e of a base like `make` or `dance`, when sure. */
function restoreSilentE(stem: string, endings = SILENT_E): string | null {
  if (stem.length < 3) return null;
  if (endsWithAny(stem, NO_SILENT_E)) return null;
  if (endsWithAny(stem, endings)) return `${stem}e`;
  return null;
}

/**
 * Normalizes surface form to the vocabulary headword.
 * Returns the input lowercased when no safe rule applies.
 */
export function lemma(raw: string, language = "en"): string {
  const word = raw.trim().toLowerCase();
  if (word.length === 0) return word;
  if (language !== "en") return word;

  if (UNCHANGED.has(word)) return word;
  const mapped = IRREGULAR[word];
  if (mapped) return mapped;

  // Plural -ies -> y (bodies -> body), but not "dies"/"lies" which are verbs,
  // and not "movies" whose base ends in -ie.
  if (word.endsWith("ies") && word.length > 4 && word[word.length - 4] !== "v") {
    return `${word.slice(0, -3)}y`;
  }

  // -es after sibilants: passes -> pass, watches -> watch, boxes -> box
  if (word.endsWith("es") && word.length > 4) {
    const stem = word.slice(0, -2);
    if (/(s|x|z|ch|sh)$/.test(stem)) return stem;
  }

  // Simple -s plural, guarded so we do not eat verb stems like "is", "his",
  // "this", "was", "has", "yes", "us", "gas", "bus", "plus", "less".
  if (word.endsWith("s") && word.length > 3 && !/(ss|us|is|as|os|xs|ys)$/.test(word)) {
    const stem = word.slice(0, -1);
    if (!UNCHANGED.has(stem) && !IRREGULAR[stem]) return stem;
  }

  // Progressive -ing: flying -> fly, running -> run, dancing -> dance.
  if (word.endsWith("ing") && word.length >= 5) {
    const stem = word.slice(0, -3);
    const folded = undouble(stem);
    if (folded) return folded;
    if (DOUBLED_IN_BASE.has(stem.slice(-2))) return stem; // rolling -> roll
    // "ying" -> "y": trying -> try (dying/lying/tying are in IRREGULAR)
    if (word.endsWith("ying")) return `${stem.slice(0, -1)}y`;
    if (stem.endsWith("e")) return stem; // seeing -> see
    const restored = restoreSilentE(stem);
    if (restored) return restored; // dancing -> dance
    return stem; // singing -> sing
  }

  // Past -ed: walked -> walk, tried -> try, stopped -> stop.
  if (word.endsWith("ed") && word.length >= 4) {
    const stem = word.slice(0, -2);
    const folded = undouble(stem);
    if (folded) return folded;
    if (DOUBLED_IN_BASE.has(stem.slice(-2))) return stem; // called -> call
    if (word.endsWith("ied")) return `${word.slice(0, -3)}y`; // tried -> try
    const restored = restoreSilentE(stem);
    if (restored) return restored; // loved -> love
    return stem; // walked -> walk
  }

  // Comparative -er: happier -> happy, braver -> brave. The doubling is not
  // undone here on purpose: `summer`, `dinner`, `hammer` and `bitter` are
  // nouns, and folding them to `sum`, `din`, `ham` or `bit` would merge two
  // different words. `bigger` therefore stays whole rather than risk those.
  if (word.endsWith("er") && word.length >= 5 && !/(ever|never|other|under|over|after|water|master|letter|matter|father|brother|sister|together|forever|whisper|bother|gather|weather|leather|feather|shoulder|daughter|another|number|member|remember|october|november|december|september)$/i.test(word)) {
    const stem = word.slice(0, -2);
    if (word.endsWith("ier")) return `${word.slice(0, -3)}y`; // happier -> happy
    const restored = restoreSilentE(stem, SILENT_E_COMPARATIVE);
    if (restored) return restored; // braver -> brave
    return word; // river, wonder, power, taller: not a confident comparative
  }

  // -est superlative: coldest -> cold, happiest -> happy.
  if (word.endsWith("est") && word.length >= 6) {
    const stem = word.slice(0, -3);
    const folded = undouble(stem);
    if (folded) return folded; // biggest -> big
    if (word.endsWith("iest")) return `${word.slice(0, -4)}y`; // happiest -> happy
    const restored = restoreSilentE(stem, SILENT_E_COMPARATIVE);
    if (restored) return restored; // bravest -> brave
    return word; // coldest, tallest: left whole rather than guessed
  }

  return word;
}

/** True when two surface forms belong to the same vocabulary entry. */
export function sameWord(a: string, b: string, language = "en"): boolean {
  return lemma(a, language) === lemma(b, language);
}
