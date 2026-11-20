/* Guqin string map — pure music model (no DOM). Imported by js/strings.js
 * and by tools/check-strings.mjs (node), so keep it side-effect free.
 *
 * Geometry: a position is the fraction d of the sounding length measured
 * FROM THE YUESHAN (head, 岳山). Stopping at d leaves a vibrating length d,
 * so the stopped pitch is open × 1/d. A harmonic touched at a hui sounds the
 * partial equal to the denominator of that hui's fraction. */

// Hui positions as fractions [num, den] of the string from the yueshan.
export const HUI = [
  null,
  [1, 8], [1, 6], [1, 5], [1, 4], [1, 3], [2, 5], [1, 2],
  [3, 5], [2, 3], [3, 4], [4, 5], [5, 6], [7, 8]
];
export const HUI_D = HUI.map(function (f) { return f ? f[0] / f[1] : null; });

export const CN_NUM = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二", "十三"];

// Stopped notes are drawn from hui 1 (d = 1/8) to just inside the longyin.
export const D_MIN = 1 / 8;
export const D_MAX = 0.93;
// A stopped note whose ET target lies within this many cents of a hui's
// just interval is played AT the hui (that is what qin tablature writes:
// 十一徽 for the major third, not "10.9"). Covers 8/7 at hui 13 (+31¢).
export const HUI_SNAP_CENTS = 35;
// "On a hui" for an unsnapped (ET) position: within ±0.05 of an integer 徽分.
export const ON_HUI_TOL = 0.05;

// A4 = 440 Hz; MIDI 36 = C2 ≈ 65.41 Hz.
export function midiToHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

/* Tunings: open-string MIDI pitches, string 1 (lowest, nearest the player)
 * first. doMidi = the jianpu "1" of the middle (no-dot) octave; it always
 * lies in C2..B2, which reproduces the usual written forms
 * (正調 5̣ 6̣ 1 2 3 5 6, 緊五 2̣ 3̣ 5̣ 6̣ 1 2 3, 慢宮 3̣ 5̣ 6̣ 1 2 3 5, 慢角 1 2 3 5 6 1̇ 2̇). */
export const TUNINGS = [
  { id: "zheng", name: "正調", pinyin: "zhèng diào", en: "standard",
    key: "F", keyPc: 5, doMidi: 41, open: [36, 38, 41, 43, 45, 48, 50] },
  { id: "manjiao", name: "慢角調", pinyin: "màn jué diào", en: "slackened 3rd string",
    key: "C", keyPc: 0, doMidi: 36, open: [36, 38, 40, 43, 45, 48, 50] },
  { id: "jinwu", name: "緊五調", alt: "蕤賓調", pinyin: "jǐn wǔ diào", en: "tightened 5th string",
    key: "B♭", keyPc: 10, doMidi: 46, open: [36, 38, 41, 43, 46, 48, 50] },
  { id: "mangong", name: "慢宮調", pinyin: "màn gōng diào", en: "slackened 1st, 3rd, 6th",
    key: "G", keyPc: 7, doMidi: 43, open: [35, 38, 40, 43, 45, 47, 50] }
];
export function tuningById(id) {
  for (var i = 0; i < TUNINGS.length; i++) if (TUNINGS[i].id === id) return TUNINGS[i];
  return TUNINGS[0];
}

/* Scale degrees by semitones above do. step = diatonic step (0 = 1),
 * acc = accidental relative to the major-scale degree. */
export const DEGREES = [
  { pc: 0,  jp: "1",  acc: 0,  step: 0, name: "宮",   py: "gōng" },
  { pc: 1,  jp: "1",  acc: 1,  step: 0, name: "",     py: "" },
  { pc: 2,  jp: "2",  acc: 0,  step: 1, name: "商",   py: "shāng" },
  { pc: 3,  jp: "3",  acc: -1, step: 2, name: "",     py: "" },
  { pc: 4,  jp: "3",  acc: 0,  step: 2, name: "角",   py: "jué" },
  { pc: 5,  jp: "4",  acc: 0,  step: 3, name: "清角", py: "qīng jué" },
  { pc: 6,  jp: "4",  acc: 1,  step: 3, name: "變徵", py: "biàn zhǐ" },
  { pc: 7,  jp: "5",  acc: 0,  step: 4, name: "徵",   py: "zhǐ" },
  { pc: 8,  jp: "6",  acc: -1, step: 5, name: "",     py: "" },
  { pc: 9,  jp: "6",  acc: 0,  step: 5, name: "羽",   py: "yǔ" },
  { pc: 10, jp: "7",  acc: -1, step: 6, name: "閏",   py: "rùn" },
  { pc: 11, jp: "7",  acc: 0,  step: 6, name: "變宮", py: "biàn gōng" }
];
export function accSym(a) { return a > 0 ? "♯" : a < 0 ? "♭" : ""; }
export function degreeLabel(pc) {
  var d = DEGREES[pc];
  return accSym(d.acc) + d.jp;
}

export const SCALES = {
  chromatic: null,
  penta: [0, 2, 4, 7, 9],
  hepta_bz: [0, 2, 4, 6, 7, 9, 11],   // + 變徵, 變宮 (正聲 / 雅樂)
  hepta_qj: [0, 2, 4, 5, 7, 9, 11]    // + 清角, 變宮 (下徵 / 新音階)
};

// ---- Western pitch names, spelled diatonically from the tuning's do ----
var LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
var LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
var KEY_LETTER = { "F": 3, "C": 0, "B♭": 6, "G": 4 };

export function westernName(midi, tuning) {
  var pcFromDo = mod(midi - tuning.doMidi, 12);
  var deg = DEGREES[pcFromDo];
  var li = (KEY_LETTER[tuning.key] + deg.step) % 7;
  var naturalPc = LETTER_PC[li];
  var acc = mod(midi - naturalPc + 6, 12) - 6;   // -6..5 semitones off the natural
  var octave = Math.round((midi - acc - naturalPc) / 12) - 1;
  var letter = LETTERS[li];
  var accStr = acc === 0 ? "" : acc > 0 ? "♯".repeat(acc) : "♭".repeat(-acc);
  return { letter: letter, acc: accStr, octave: octave,
           sci: letter + accStr + octave, helm: helmholtz(letter, accStr, octave) };
}
function helmholtz(letter, acc, octave) {
  if (octave <= 2) return letter + acc + ",".repeat(Math.max(0, 2 - octave));
  return letter.toLowerCase() + acc + "′".repeat(octave - 3);
}

// ---- 徽分 (hui-fen) for any position d ----
export function huiFen(d) {
  if (d <= HUI_D[1]) return 1 - (HUI_D[1] - d) / (HUI_D[1]);   // not drawn; kept monotone
  for (var k = 1; k <= 12; k++) {
    if (d <= HUI_D[k + 1]) return k + (d - HUI_D[k]) / (HUI_D[k + 1] - HUI_D[k]);
  }
  return 13 + (d - HUI_D[13]) / (1 - HUI_D[13]);   // 十三徽外 → longyin at "14.0"
}
export function huiLabel(hf) {
  var r = Math.round(hf * 10) / 10;
  var whole = Math.floor(r + 1e-9), tenth = Math.round((r - whole) * 10);
  var num = r.toFixed(1);
  if (whole >= 13 && tenth > 0) return { cn: "十三徽外", num: num, value: r };
  if (tenth === 0) return { cn: CN_NUM[whole] + "徽", num: num, value: r };
  return { cn: CN_NUM[whole] + CN_NUM[tenth], num: num, value: r };
}

function mod(a, n) { return ((a % n) + n) % n; }
function gcd(a, b) { return b ? gcd(b, a % b) : a; }
export function cents(ratio) { return 1200 * Math.log2(ratio); }
export function ratioStr(num, den) { var g = gcd(num, den); return (num / g) + "/" + (den / g); }

/* Every playable position for a tuning. Each note:
 *  { id, type: "san"|"fan"|"an", string (1..7), d (null for 散), hf, hui {cn,num,value},
 *    onHui, huiNo, midi, centsOff (vs ET midi), ratio {text, value, just}, partial,
 *    oct (jianpu octave, 0 = no dots), pc (semitones above do) } */
export function buildNotes(tuning) {
  var notes = [];
  tuning.open.forEach(function (openMidi, i) {
    var s = i + 1;
    // 散音
    notes.push(mk(tuning, { id: "san-" + s, type: "san", string: s, d: null, hf: null,
      hui: null, onHui: false, huiNo: null, midi: openMidi, centsOff: 0,
      ratio: { text: "1/1", value: 1, just: true }, partial: 1, semis: 0 }));
    // 泛音 — only at the 13 hui
    for (var k = 1; k <= 13; k++) {
      var p = HUI[k][1];
      var c = cents(p);
      var semis = Math.round(c / 100);
      notes.push(mk(tuning, { id: "fan-" + s + "-" + k, type: "fan", string: s, d: HUI_D[k],
        hf: k, hui: huiLabel(k), onHui: true, huiNo: k, midi: openMidi + semis,
        centsOff: c - semis * 100, ratio: { text: p + "/1", value: p, just: true },
        partial: p, semis: semis }));
    }
    // 按音 — chromatic ET targets, snapped to a hui when it is the just version
    for (var n = 1; n <= 48; n++) {
      var dEt = Math.pow(2, -n / 12);
      var snap = null;
      for (var h = 1; h <= 13; h++) {
        var just = HUI[h][1] / HUI[h][0];   // stopped ratio = 1/d
        var dev = cents(just) - n * 100;
        if (Math.abs(dev) <= HUI_SNAP_CENTS) { snap = { h: h, dev: dev }; break; }
      }
      var d = snap ? HUI_D[snap.h] : dEt;
      if (d < D_MIN - 1e-9 || d > D_MAX) continue;
      var hf = snap ? snap.h : huiFen(d);
      var lab = huiLabel(hf);
      var onHui = snap ? true : Math.abs(hf - Math.round(hf)) <= ON_HUI_TOL;
      notes.push(mk(tuning, { id: "an-" + s + "-" + n, type: "an", string: s, d: d, hf: hf,
        hui: lab, onHui: onHui, huiNo: onHui ? Math.round(hf) : null, midi: openMidi + n,
        centsOff: snap ? snap.dev : 0,
        etHf: snap ? Math.round(huiFen(dEt) * 10) / 10 : null,
        ratio: snap
          ? { text: ratioStr(HUI[snap.h][1], HUI[snap.h][0]), value: HUI[snap.h][1] / HUI[snap.h][0], just: true }
          : { text: "2^(" + n + "/12)", value: Math.pow(2, n / 12), just: false },
        partial: null, semis: n }));
    }
  });
  return notes;
}

function mk(tuning, n) {
  n.pc = mod(n.midi - tuning.doMidi, 12);
  n.oct = Math.floor((n.midi - tuning.doMidi) / 12);
  n.hz = midiToHz(n.midi) * Math.pow(2, n.centsOff / 1200);
  n.degree = DEGREES[n.pc];
  n.jp = degreeLabel(n.pc);
  n.west = westernName(n.midi, tuning);
  return n;
}

// Interval names for "x above the open string" (semitones mod 12 + octaves).
var IV = ["unison", "minor 2nd", "major 2nd", "minor 3rd", "major 3rd", "4th", "tritone",
  "5th", "minor 6th", "major 6th", "minor 7th", "major 7th"];
export function intervalName(semis) {
  var o = Math.floor(semis / 12), r = semis % 12;
  if (semis === 0) return "open string";
  if (r === 0) return o === 1 ? "octave" : o + " octaves";
  return (o ? (o === 1 ? "octave + " : o + " octaves + ") : "") + IV[r];
}

export const TYPE_INFO = {
  san: { cn: "散音", short: "散", en: "open" },
  fan: { cn: "泛音", short: "泛", en: "harmonic" },
  an:  { cn: "按音", short: "按", en: "stopped" }
};
