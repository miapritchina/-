// Sanity checks for the guqin string-map model (strings.html).
// Run from the repo root:  node tools/check-strings.mjs
// Not loaded by the site; it imports the same pure module the page uses.
import assert from "node:assert/strict";
import { buildNotes, tuningById, huiFen, huiLabel, HUI_D } from "../js/modules/strings-model.js";

const zheng = buildNotes(tuningById("zheng"));
const find = (notes, pred) => {
  const hits = notes.filter(pred);
  assert.equal(hits.length, 1, "expected exactly one match, got " + hits.length);
  return hits[0];
};
const an = (notes, s, hui) => find(notes, n => n.type === "an" && n.string === s && n.onHui && n.huiNo === hui);
const fan = (notes, s, hui) => find(notes, n => n.type === "fan" && n.string === s && n.huiNo === hui);
const san = (notes, s) => find(notes, n => n.type === "san" && n.string === s);
let passed = 0;
const ok = (label, actual, expected) => { assert.equal(actual, expected, label); passed++; console.log("  ok  " + label + " = " + actual); };

console.log("Assertions");
ok("正調 open strings", [1,2,3,4,5,6,7].map(s => san(zheng, s).west.sci).join(" "), "C2 D2 F2 G2 A2 C3 D3");
ok("正調 open strings in jianpu (octave)", [1,2,3,4,5,6,7].map(s => { const n = san(zheng, s); return n.jp + (n.oct < 0 ? "." : n.oct > 0 ? "'" : ""); }).join(" "), "5. 6. 1 2 3 5 6");
ok("正調 str1 按 hui9 (fifth above C)", an(zheng, 1, 9).west.sci, "G2");
ok("正調 str1 按 hui9 ratio", an(zheng, 1, 9).ratio.text, "3/2");
ok("正調 str7 按 hui10 (fourth above d)", an(zheng, 7, 10).west.sci, "G3");
ok("  … Helmholtz", an(zheng, 7, 10).west.helm, "g");
ok("正調 str3 泛 hui5 (3rd partial of F2)", fan(zheng, 3, 5).west.sci, "C4");
ok("  … Helmholtz", fan(zheng, 3, 5).west.helm, "c′");
ok("正調 str3 泛 hui9 = same as hui5", fan(zheng, 3, 9).midi, fan(zheng, 3, 5).midi);
ok("正調 str1 泛 hui7 (octave)", fan(zheng, 1, 7).west.sci, "C3");
ok("正調 str1 泛 hui4 (2 octaves)", fan(zheng, 1, 4).west.sci, "C4");
ok("正調 str1 泛 hui6 (5th partial → E, -14¢)", fan(zheng, 1, 6).west.sci + " " + Math.round(fan(zheng, 1, 6).centsOff), "E4 -14");
ok("正調 str1 泛 hui1 (8th partial)", fan(zheng, 1, 1).west.sci, "C5");
ok("正調 str1 按 hui7 (octave)", an(zheng, 1, 7).west.sci, "C3");
ok("正調 str1 按 hui11 (major 3rd 5/4)", an(zheng, 1, 11).west.sci + " " + an(zheng, 1, 11).ratio.text, "E2 5/4");
ok("正調 str1 按 hui12 (minor 3rd 6/5)", an(zheng, 1, 12).west.sci + " " + an(zheng, 1, 12).ratio.text, "E♭2 6/5");
ok("正調 str1 按 hui8 (major 6th 5/3)", an(zheng, 1, 8).west.sci + " " + an(zheng, 1, 8).ratio.text, "A2 5/3");
ok("正調 str1 按 hui13 (8/7 → major 2nd)", an(zheng, 1, 13).west.sci + " " + an(zheng, 1, 13).ratio.text, "D2 8/7");
ok("正調 str4 G open = 徵? (G in 1=F is 2 商)", san(zheng, 4).degree.name, "商");
ok("正調 str3 F open = 宮", san(zheng, 3).degree.name, "宮");
ok("正調 E (pc 11) = 變宮", an(zheng, 1, 11).degree.name, "變宮");
ok("正調 E♭ (pc 10) = 閏", an(zheng, 1, 12).degree.name, "閏");
const manjiao = buildNotes(tuningById("manjiao"));
ok("慢角調 str3 open = E", san(manjiao, 3).west.sci, "E2");
ok("慢角調 str3 open = 角 (3)", san(manjiao, 3).degree.name + " " + san(manjiao, 3).jp, "角 3");
const jinwu = buildNotes(tuningById("jinwu"));
ok("緊五調 str5 open = B♭ = 宮", san(jinwu, 5).west.sci + " " + san(jinwu, 5).degree.name, "B♭2 宮");
const mangong = buildNotes(tuningById("mangong"));
ok("慢宮調 str1 open = B (3̣)", san(mangong, 1).west.sci + " " + san(mangong, 1).jp + " oct" + san(mangong, 1).oct, "B1 3 oct-1");
ok("徽分 midway hui7→hui8", huiLabel(huiFen((HUI_D[7] + HUI_D[8]) / 2)).num, "7.5");
ok("徽分 longyin = 14.0", huiLabel(huiFen(1)).num, "14.0");
ok("徽分 hui13 + half way to longyin", huiLabel(huiFen(0.9375)).cn + " " + huiLabel(huiFen(0.9375)).num, "十三徽外 13.5");
// well-known between-hui positions (ET): minor 7th at 七六, minor 6th at 八四, 9th at 六五, minor 10th at 六二
const at = semis => { const n = zheng.find(n => n.type === "an" && n.string === 1 && n.semis === semis); return n.hui.cn + " " + n.hui.num; };
ok("正調 str1 minor 7th (ET) at", at(10), "七六 7.6");
ok("正調 str1 minor 6th (ET) at", at(8), "八四 8.4");
ok("正調 str1 9th (octave + major 2nd, ET) at", at(14), "六五 6.5");
ok("正調 str1 minor 10th (octave + minor 3rd, ET) at", at(15), "六二 6.2");
ok("正調 str1 major 2nd snaps to hui 13 (8/7)", at(2), "十三徽 13.0");
console.log(passed + " assertions passed\n");

console.log("正調 — stopped notes that land on a hui (按音 on-hui)");
console.log("str  hui  徽分　　　 pitch  helm   jianpu  degree　 ratio   ¢ vs ET");
for (const n of zheng.filter(n => n.type === "an" && n.onHui).sort((a, b) => a.string - b.string || b.hf - a.hf)) {
  const dots = n.oct < 0 ? "̣".repeat(-n.oct) : n.oct > 0 ? "̇".repeat(n.oct) : "";
  console.log(
    String(n.string).padEnd(5) + String(n.huiNo).padEnd(5) + n.hui.cn.padEnd(4, "　") + " " +
    n.west.sci.padEnd(7) + n.west.helm.padEnd(7) + (n.jp + dots).padEnd(8) +
    (n.degree.name || "—").padEnd(3, "　") + " " + n.ratio.text.padEnd(8) +
    (n.centsOff >= 0 ? "+" : "") + n.centsOff.toFixed(1)
  );
}
const counts = {};
for (const n of zheng) counts[n.type] = (counts[n.type] || 0) + 1;
console.log("\n正調 totals:", JSON.stringify(counts));

// ---- tuning guide ----
import { tuningSteps, TUNINGS } from "../js/modules/strings-model.js";
{
  const has = (list, a, pa, b, pb) => list.some(x => (x.a === a && x.pa === pa && x.b === b && x.pb === pb) || (x.a === b && x.pa === pb && x.b === a && x.pb === pa));
  for (const t of TUNINGS) {
    const g = tuningSteps(t);
    ok(t.name + " tuning guide reaches all 7 strings", g.steps.length, 6);
    console.log(t.name, g.steps.map(x => `${x.b}←${x.a} (${x.pb}:${x.pa})`).join("  "), "| checks", g.checks.length);
  }
  const z = tuningSteps(TUNINGS[0]), all = z.steps.concat(z.checks);
  ok("正調: 一弦九徽 = 四弦七徽", has(all, 1, 3, 4, 2), true);
  ok("正調: 二弦十徽 = 四弦九徽", has(all, 2, 4, 4, 3), true);
  ok("正調: 三弦九徽 = 六弦七徽", has(all, 3, 3, 6, 2), true);
}
