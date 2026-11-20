/* Notes on the strings · 弦上音位 — interactive guqin string map.
 * Zero-build ES module. The music model lives in modules/strings-model.js
 * (pure; also used by tools/check-strings.mjs). */
import {
  TUNINGS, tuningById, buildNotes, HUI, HUI_D, CN_NUM, DEGREES, SCALES,
  TYPE_INFO, intervalName, degreeLabel, westernName, cents,
  tuningSteps, PARTIAL_HUI, midiToHz
} from "./modules/strings-model.js?v=29";
import { escapeHtml as esc } from "./modules/util.js?v=26";

var LS_KEY = "stringMap.v1";
var ZOOMS = [1, 1.5, 2, 3];
var OCTS = [
  { o: -1, label: "low" }, { o: 0, label: "middle" }, { o: 1, label: "high" },
  { o: 2, label: "higher" }, { o: 3, label: "highest" }
];
var DEFAULTS = {
  tuning: "zheng",
  types: { san: true, fan: true, an: true },
  pos: "all",
  scale: "penta",
  single: 0,
  strings: [true, true, true, true, true, true, true],
  octs: { "-1": true, "0": true, "1": true, "2": true, "3": true },
  zoom: 1,
  labels: "jp"
};

var st = load();
var tuning = tuningById(st.tuning);
var notes = buildNotes(tuning);
var byId = {};
var selectedId = null;
var geo = null;
var firstRender = true;

var $ = function (id) { return document.getElementById(id); };
var svg = $("smBoard"), scroller = $("smScroller");

// ---------------- state persistence ----------------
function load() {
  var s = JSON.parse(JSON.stringify(DEFAULTS));
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (raw) {
      var v = JSON.parse(raw);
      if (v && typeof v === "object") {
        if (typeof v.tuning === "string") s.tuning = v.tuning;
        if (v.types) for (var t in s.types) if (t in v.types) s.types[t] = !!v.types[t];
        if (["all", "on", "between"].indexOf(v.pos) >= 0) s.pos = v.pos;
        if (v.scale === "single" || v.scale in SCALES) s.scale = v.scale;
        if (typeof v.single === "number" && v.single >= 0 && v.single < 12) s.single = v.single;
        if (Array.isArray(v.strings) && v.strings.length === 7) s.strings = v.strings.map(Boolean);
        if (v.octs) for (var o in s.octs) if (o in v.octs) s.octs[o] = !!v.octs[o];
        if (ZOOMS.indexOf(v.zoom) >= 0) s.zoom = v.zoom;
        if (v.labels === "jp" || v.labels === "abc") s.labels = v.labels;
      }
    }
  } catch (e) {}
  return s;
}
function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch (e) {}
}

// ---------------- analytics ----------------
var filterTimer = null;
function trackFilters(count) {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(function () {
    try {
      window.posthog && window.posthog.capture("string_map_filter", {
        tuning: st.tuning,
        types: Object.keys(st.types).filter(function (t) { return st.types[t]; }).join(","),
        position: st.pos,
        scale: st.scale === "single" ? "single:" + DEGREES[st.single].name + degreeLabel(st.single) : st.scale,
        strings: st.strings.map(function (on, i) { return on ? i + 1 : ""; }).join(""),
        octaves: Object.keys(st.octs).filter(function (o) { return st.octs[o]; }).join(","),
        zoom: st.zoom,
        labels: st.labels,
        shown: count
      });
    } catch (e) {}
  }, 800);
}
function trackOpen(n, eqCount, via) {
  try {
    window.posthog && window.posthog.capture("string_map_note_opened", {
      tuning: st.tuning, type: n.type, string: n.string,
      hui: n.hui ? n.hui.num : "open", on_hui: !!n.onHui,
      pitch: n.west.sci, jianpu: n.jp, octave: n.oct, degree: n.degree.name || degreeLabel(n.pc),
      same_pitch_positions: eqCount, via: via || "board"
    });
  } catch (e) {}
}

// ---------------- filtering ----------------
function octOf(n) { return Math.max(-1, Math.min(3, n.oct)); }
function passes(n) {
  if (!st.types[n.type]) return false;
  if (!st.strings[n.string - 1]) return false;
  if (!st.octs[String(octOf(n))]) return false;
  if (n.type !== "san") {
    if (st.pos === "on" && !n.onHui) return false;
    if (st.pos === "between" && (n.type !== "an" || n.onHui)) return false;
  }
  if (st.scale === "single") return n.pc === st.single;
  var set = SCALES[st.scale];
  return !set || set.indexOf(n.pc) >= 0;
}

// ---------------- geometry ----------------
function computeGeo() {
  var cw = scroller.clientWidth || 800;
  var base = Math.max(cw, 760);
  var W = Math.round(base * st.zoom);
  var lane = 58, top = 46;
  // landscape: pull the strings together so the whole board fits the screen height
  if (window.innerWidth > window.innerHeight) {
    top = 40;
    lane = Math.max(32, Math.min(58, Math.floor((window.innerHeight - 12 - top - 22) / 7)));
  }
  var k = lane / 58, mk = Math.max(0.75, k);
  var padL = 44, padR = 86;
  var xY = W - padR;            // yueshan side of the drawn board
  var xL = padL;                // longyin side
  // The empty ends (yueshan to hui 1, beyond the last stopped note) are trimmed,
  // and the scale leans 35% toward pitch spacing so the crowded high hui get room.
  var D0 = 0.095, D1 = 0.955, WARP = 0.35, LG = Math.log(D1 / D0);
  var u = function (d) { return (1 - WARP) * (d - D0) / (D1 - D0) + WARP * Math.log(d / D0) / LG; };
  return {
    W: W, H: top + lane * 7 + (k < 1 ? 22 : 26), lane: lane, top: top, k: k, mk: mk,
    xY: xY, xL: xL, L: xY - xL, xOpen: xY + 40,
    x: function (d) { return xY - u(Math.max(d, D0)) * (xY - xL); },
    y: function (s) { return top + (7 - s) * lane + lane / 2; }
  };
}

// ---------------- SVG drawing ----------------
function jpDots(cx, cy, oct, up, down) {
  var out = "", k = Math.abs(oct), gap = 3.6;
  if (!k) return "";
  var yy = oct > 0 ? cy - up : cy + down;
  for (var i = 0; i < k; i++) {
    var xx = cx + (i - (k - 1) / 2) * gap;
    out += '<circle class="dot" cx="' + xx.toFixed(1) + '" cy="' + yy.toFixed(1) + '" r="1.35"/>';
  }
  return out;
}
function markerSvg(n, x, y, cls) {
  var label = esc(n.jp), r, body;
  var aria = TYPE_INFO[n.type].cn + " " + CN_NUM[n.string] + "弦" + (n.hui ? " " + n.hui.cn : "") +
    ", " + n.west.sci + ", " + (n.degree.name || n.jp);
  var g = '<g class="mk mk-' + n.type + cls + (n.pc === 0 ? " is-gong" : "") + '" data-id="' + n.id +
    '" tabindex="0" role="button" aria-label="' + esc(aria) + '">';
  if (n.type === "san") {
    r = 14;
    body = '<rect class="ring" x="' + (x - 18) + '" y="' + (y - 18) + '" width="36" height="36" rx="9"/>' +
      '<rect class="body" x="' + (x - 14) + '" y="' + (y - 14) + '" width="28" height="28" rx="6"/>';
  } else if (n.type === "fan") {
    r = 11;
    body = '<circle class="ring" cx="' + x + '" cy="' + y + '" r="' + (r + 4) + '"/>' +
      '<circle class="body" cx="' + x + '" cy="' + y + '" r="' + r + '"/>';
  } else {
    r = 13;
    body = '<circle class="ring" cx="' + x + '" cy="' + y + '" r="' + (r + 4) + '"/>' +
      '<circle class="body" cx="' + x + '" cy="' + y + '" r="' + r + '"/>';
  }
  var abc = st.labels === "abc";
  var ty = abc ? y : y + (n.oct > 0 ? 1.5 : n.oct < 0 ? -1.5 : 0);
  // letter mode: note letter with its accidental, octave number small at the lower right
  var text = abc
    ? '<text x="' + x + '" y="' + ty.toFixed(1) + '">' + esc(n.west.letter + n.west.acc) +
      '<tspan class="oct" dy="' + (r * 0.35).toFixed(1) + '">' + n.west.octave + '</tspan></text>'
    : '<text x="' + x + '" y="' + ty.toFixed(1) + '">' + label + '</text>' + jpDots(x, y, n.oct, r * 0.62, r * 0.66);
  if (geo.mk < 1) g = g.replace('>', ' transform="translate(' + x + ' ' + y + ') scale(' + geo.mk.toFixed(3) + ') translate(' + (-x) + ' ' + (-y) + ')">');
  return g + '<circle class="hit" cx="' + x + '" cy="' + y + '" r="' + (r + 3) + '"/>' + body +
    text + '</g>';
}

function render() {
  geo = computeGeo();
  var G = geo, parts = [];
  var bodyTop = G.top - 10, bodyBot = G.top + G.lane * 7 + 6;
  svg.setAttribute("width", G.W);
  svg.setAttribute("height", G.H);
  svg.setAttribute("viewBox", "0 0 " + G.W + " " + G.H);

  // lacquered body: narrower toward the tail (left)
  var tl = G.xL - 26, hr = G.W - 6, inset = 10;
  parts.push('<defs><linearGradient id="smWood" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#3a2a20"/><stop offset=".5" stop-color="#2a1e17"/><stop offset="1" stop-color="#211812"/></linearGradient></defs>');
  parts.push('<path d="M' + tl + ',' + (bodyTop + inset) + ' L' + (hr - 14) + ',' + bodyTop +
    ' Q' + hr + ',' + bodyTop + ' ' + hr + ',' + (bodyTop + 14) + ' L' + hr + ',' + (bodyBot - 14) +
    ' Q' + hr + ',' + bodyBot + ' ' + (hr - 14) + ',' + bodyBot + ' L' + tl + ',' + (bodyBot - inset) +
    ' Q' + (tl - 8) + ',' + ((bodyTop + bodyBot) / 2) + ' ' + tl + ',' + (bodyTop + inset) + 'Z" fill="url(#smWood)" stroke="#4a3a2c"/>');

  // hui: faint guide lines, mother-of-pearl dots on the top edge, labels above
  for (var k = 1; k <= 13; k++) {
    var hx = G.x(HUI_D[k]);
    parts.push('<line x1="' + hx + '" y1="' + (bodyTop + 4) + '" x2="' + hx + '" y2="' + (bodyBot - 4) +
      '" stroke="#e9e2cf" stroke-opacity="' + (k === 7 ? .16 : .08) + '" stroke-dasharray="2 4"/>');
    parts.push('<circle cx="' + hx + '" cy="' + (bodyTop + 1) + '" r="' + (k === 7 ? 5.5 : 4) +
      '" fill="#ece5d2" stroke="#9c927c" stroke-width=".6"/>');
    // two-character numerals collide where hui 11/12 sit close together: drop 十二's then
    if (!(k === 12 && G.x(HUI_D[11]) - G.x(HUI_D[12]) < 30))
      parts.push('<text class="sm-hui-cn" x="' + hx + '" y="' + (bodyTop - 20) + '">' + CN_NUM[k] + '</text>');
    parts.push('<text class="sm-hui-n" x="' + hx + '" y="' + (bodyTop - 8) + '">' + k + '</text>');
  }
  // yueshan (head) and longyin (tail)
  parts.push('<rect x="' + (G.xY - 2) + '" y="' + (bodyTop + 2) + '" width="7" height="' + (bodyBot - bodyTop - 4) + '" rx="2" fill="#7a6248"/>');
  parts.push('<rect x="' + (G.xL - 6) + '" y="' + (bodyTop + inset) + '" width="6" height="' + (bodyBot - bodyTop - 2 * inset) + '" rx="2" fill="#7a6248"/>');
  parts.push('<text class="sm-hui-cn" x="' + (G.xY + 2) + '" y="' + (bodyTop - 20) + '">岳山</text>');
  parts.push('<text class="sm-hui-cn" x="' + G.xOpen + '" y="' + (bodyTop - 20) + '">散</text>');
  parts.push('<text class="sm-hui-cn" x="' + (G.xL - 4) + '" y="' + (bodyTop - 20) + '">龍齦</text>');

  // strings (1 = thickest, bottom)
  for (var s = 1; s <= 7; s++) {
    var y = G.y(s);
    parts.push('<line x1="' + (G.xL - 3) + '" y1="' + y + '" x2="' + (G.W - 10) + '" y2="' + y +
      '" stroke="#d9c9a3" stroke-opacity=".75" stroke-width="' + (0.9 + (7 - s) * 0.32).toFixed(2) + '"/>');
  }

  // which markers to draw
  var shown = notes.filter(passes);
  var sel = selectedId && byId[selectedId];
  var same = sel ? notes.filter(function (n) { return n.midi === sel.midi; }) : [];
  var sameIds = {};
  same.forEach(function (n) { sameIds[n.id] = true; });
  var shownIds = {};
  shown.forEach(function (n) { shownIds[n.id] = true; });
  var draw = shown.concat(same.filter(function (n) { return !shownIds[n.id]; }));

  // stagger crowded stopped notes on each string
  var offs = {};
  for (s = 1; s <= 7; s++) {
    var row = draw.filter(function (n) { return n.type === "an" && n.string === s; })
      .sort(function (a, b) { return G.x(a.d) - G.x(b.d); });
    var cluster = [];
    var flush = function () {
      if (cluster.length > 1) cluster.forEach(function (n, i) { offs[n.id] = (i % 2 ? 8 : -8) * G.k; });
      cluster = [];
    };
    row.forEach(function (n, i) {
      if (i && G.x(n.d) - G.x(row[i - 1].d) < 27 * G.mk) cluster.push(n);
      else { flush(); cluster.push(n); }
    });
    flush();
  }

  var order = { an: 0, fan: 1, san: 2 };
  draw.sort(function (a, b) {
    var sa = sameIds[a.id] ? 1 : 0, sb = sameIds[b.id] ? 1 : 0;
    return sa - sb || order[a.type] - order[b.type];
  });
  draw.forEach(function (n) {
    var x, y;
    if (n.type === "san") { x = G.xOpen; y = G.y(n.string); }
    else if (n.type === "fan") { x = G.x(n.d); y = G.y(n.string) - 21 * G.k; }
    else { x = G.x(n.d); y = G.y(n.string) + 7 * G.k + (offs[n.id] || 0); }
    var cls = (sameIds[n.id] ? " same" : "") + (n.id === selectedId ? " sel" : "") + (!shownIds[n.id] ? " ghost" : "");
    parts.push(markerSvg(n, +x.toFixed(1), +y.toFixed(1), cls));
  });

  svg.innerHTML = parts.join("");
  svg.classList.toggle("has-sel", !!sel);

  // sticky string labels
  var lab = "";
  for (s = 7; s >= 1; s--) lab += '<span style="top:' + G.y(s) + 'px"><b>' + CN_NUM[s] + '</b>' + s + '</span>';
  $("smStrLabels").innerHTML = lab;

  $("smCount").innerHTML = "<b>" + shown.length + "</b> position" + (shown.length === 1 ? "" : "s") + " shown";
  $("smZoomVal").textContent = st.zoom + "×";
  document.querySelectorAll("#smLabels button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.labels === st.labels); });
  $("smZoomOut").disabled = st.zoom === ZOOMS[0];
  $("smZoomIn").disabled = st.zoom === ZOOMS[ZOOMS.length - 1];

  if (firstRender) { firstRender = false; scroller.scrollLeft = scroller.scrollWidth; }
  return shown.length;
}

// ---------------- detail panel ----------------
function jpHtml(n) {
  var dots = function (k) { return "•".repeat(k); };
  return '<span class="jp"><i>' + (n.oct > 0 ? dots(n.oct) : "") + '</i>' + esc(n.jp) +
    '<i>' + (n.oct < 0 ? dots(-n.oct) : "") + '</i></span>';
}
function shortPos(n) {
  return TYPE_INFO[n.type].short + " " + CN_NUM[n.string] + "弦" + (n.hui ? " " + n.hui.cn : "");
}
function signed(c) { return (c >= 0 ? "+" : "−") + Math.abs(c).toFixed(1) + "¢"; }

function renderDetail() {
  var box = $("smDetail");
  var n = selectedId && byId[selectedId];
  document.body.classList.toggle("sm-sheet-open", !!n);
  box.classList.toggle("is-open", !!n);
  if (!n) {
    box.innerHTML = '<h2><span class="cjk">音</span> Note</h2><p class="sm-empty">Tap any marker on the board to see its position, ' +
      'pitch, degree and ratio. Every other place on the qin that sounds the <b>same pitch</b> then lights up, ' +
      'so you can choose between equivalent positions.</p>';
    return;
  }
  var openN = byId["san-" + n.string];
  var deg = n.degree;
  var degName = deg.name ? esc(deg.name) + (deg.py ? "<small>" + esc(deg.py) + "</small>" : "") :
    "<small>no traditional name</small>";
  var hz = n.hz.toFixed(n.hz < 100 ? 2 : 1);

  var pos, ratio, tab;
  if (n.type === "san") {
    pos = "Open string: no left-hand finger";
    ratio = "1/1";
    tab = "散 " + CN_NUM[n.string] + "弦";
  } else {
    var hf = n.hui;
    tab = (n.type === "fan" ? "泛 " : "按 ") + CN_NUM[n.string] + "弦 " + hf.cn;
    var dTxt = "d = " + (n.onHui && n.huiNo ? HUI[n.huiNo][0] + "/" + HUI[n.huiNo][1] : n.d.toFixed(3)) +
      " of the string from the yueshan";
    if (n.onHui) pos = '<span class="cjk">' + hf.cn + "</span> " + hf.num + " <small>— on a hui · " + dTxt + "</small>";
    else if (hf.value > 13) pos = '<span class="cjk">十三徽外</span> ' + hf.num + " <small>— beyond hui 13 toward the longyin · " + dTxt + "</small>";
    else {
      var lo = Math.floor(hf.value);
      pos = '<span class="cjk">' + hf.cn + "</span> " + hf.num + " <small>— " + Math.round((hf.value - lo) * 10) +
        "/10 of the way from " + CN_NUM[lo] + "徽 to " + CN_NUM[lo + 1] + "徽 · " + dTxt + "</small>";
    }
    if (n.type === "fan") {
      ratio = n.partial + "/1 <small>— " + ordinal(n.partial) + " partial of the open string (just); " +
        signed(n.centsOff) + " vs equal temperament</small>";
    } else if (n.ratio.just) {
      ratio = n.ratio.text + " <small>— the hui's just interval (" + cents(n.ratio.value).toFixed(1) + "¢); " +
        signed(n.centsOff) + " vs ET" + (n.etHf != null && Math.abs(n.etHf - n.hf) >= 0.05
          ? "; the equal-tempered spot would be " + n.etHf.toFixed(1) : "") + "</small>";
    } else {
      ratio = "2<sup>" + n.semis + "/12</sup> ≈ " + n.ratio.value.toFixed(4) + " <small>— equal temperament, " +
        n.semis * 100 + "¢ above the open string</small>";
    }
  }

  var same = notes.filter(function (m) { return m.midi === n.midi; });
  var eqHtml = same.map(function (m) {
    var cls = "sm-eq" + (m.id === n.id ? " cur" : "") + (passes(m) ? "" : " ghost");
    return '<button type="button" class="' + cls + '" data-goto="' + m.id + '"><span class="sm-swatch ' + m.type +
      '"></span><span class="cjk">' + esc(shortPos(m)) + "</span></button>";
  }).join("");
  var hidden = same.filter(function (m) { return !passes(m); }).length;

  box.innerHTML =
    '<div class="sm-d-head">' +
      '<div class="sm-d-big t-' + n.type + '">' + jpHtml(n) + "</div>" +
      '<div class="sm-d-title"><div class="sm-d-deg">' + degName + "</div>" +
        '<div class="sm-d-west"><b>' + esc(n.west.sci) + "</b> · " + esc(n.west.helm) + " <small>(Helmholtz)</small> · " + hz + " Hz</div></div>" +
      '<button type="button" class="sm-close" id="smClose" aria-label="Close">×</button>' +
    "</div>" +
    '<dl class="sm-dl">' +
      "<dt>Sound</dt><dd><span class=\"cjk\">" + TYPE_INFO[n.type].cn + "</span> " + TYPE_INFO[n.type].en +
        ' · <span class="sm-tab">' + esc(tab) + "</span></dd>" +
      "<dt>String</dt><dd><span class=\"cjk\">" + CN_NUM[n.string] + "弦</span> string " + n.string +
        " <small>(open " + esc(openN.west.sci) + " = " + esc(openN.jp) + (openN.oct < 0 ? "̣" : "") + " " + esc(openN.degree.name || "") + ")</small></dd>" +
      "<dt>Position</dt><dd>" + pos + "</dd>" +
      "<dt>Pitch</dt><dd>jianpu " + jpHtml(n) + " <small>(1 = " + esc(tuning.key) + ")</small> · " +
        (deg.name ? '<span class="cjk">' + esc(deg.name) + "</span>" : esc(degreeLabel(n.pc))) + " · " + esc(n.west.sci) + "</dd>" +
      "<dt>Ratio</dt><dd>" + ratio + "</dd>" +
      "<dt>Interval</dt><dd>" + esc(intervalName(n.type === "fan" ? Math.round(cents(n.partial) / 100) : n.semis)) +
        " above the open string</dd>" +
    "</dl>" +
    '<div class="sm-same"><div class="sm-same-h">Same pitch <b>' + esc(n.west.sci) + "</b> sounds at <b>" + same.length +
      "</b> place" + (same.length === 1 ? "" : "s") + " on the qin" +
      (same.length > 1 ? " — glowing on the board" : "") +
      (hidden ? " (" + hidden + " dashed: outside your filters)" : "") + "</div>" +
      '<div class="sm-same-list">' + eqHtml + "</div></div>";
}
function ordinal(p) { return p + (p === 2 ? "nd" : p === 3 ? "rd" : "th"); }

function select(id, via) {
  selectedId = id;
  render();
  renderDetail();
  var n = id && byId[id];
  if (n) {
    trackOpen(n, notes.filter(function (m) { return m.midi === n.midi; }).length, via);
    if (via === "list") scrollMarkerIntoView(n);
    // phones: the detail is a bottom sheet, so bring the board up above it
    if (window.matchMedia("(max-width: 700px)").matches) {
      var top = scroller.getBoundingClientRect().top;
      if (top < 0 || top > 60) window.scrollTo({ top: window.scrollY + top - 8, behavior: "smooth" });
    }
  }
}
function scrollMarkerIntoView(n) {
  var x = n.type === "san" ? geo.xOpen : geo.x(n.d);
  var left = scroller.scrollLeft, w = scroller.clientWidth;
  if (x < left + 40 || x > left + w - 40) scroller.scrollTo({ left: x - w / 2, behavior: "smooth" });
}

// ---------------- controls ----------------
function buildControls() {
  var sel = $("smTuning");
  sel.innerHTML = TUNINGS.map(function (t) {
    return '<option value="' + t.id + '">' + t.name + (t.alt ? " / " + t.alt : "") + " — " + t.en + "</option>";
  }).join("");
  sel.value = tuning.id;
  sel.addEventListener("change", function () {
    st.tuning = sel.value;
    setTuning();
    changed();
  });

  var degHtml = DEGREES.map(function (d) {
    return '<button type="button" class="sm-chip deg" data-deg="' + d.pc + '">' +
      (d.name ? '<span class="cjk">' + d.name + "</span> " : "") + "<small>" + esc(degreeLabel(d.pc)) + "</small></button>";
  }).join("");
  $("smDegrees").insertAdjacentHTML("beforeend", degHtml);

  var strHtml = "";
  for (var s = 1; s <= 7; s++) {
    strHtml += '<button type="button" class="sm-chip str" data-str="' + s + '"><span class="cjk">' + CN_NUM[s] + "</span>" + s + "</button>";
  }
  strHtml += '<button type="button" class="sm-chip" data-str="all">All</button>';
  $("smStrings").insertAdjacentHTML("beforeend", strHtml);

  $("smOctaves").insertAdjacentHTML("beforeend", OCTS.map(function (o) {
    return '<button type="button" class="sm-chip" data-oct="' + o.o + '">' + jpHtml({ jp: "1", oct: o.o }) + " " + o.label + "</button>";
  }).join(""));

  document.querySelector(".sm-filters").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    var d = b.dataset;
    if (d.type) {
      st.types[d.type] = !st.types[d.type];
    } else if (d.pos) {
      st.pos = d.pos;
    } else if (d.scale) {
      st.scale = d.scale;
    } else if (d.deg != null) {
      var pc = +d.deg;
      if (st.scale === "single" && st.single === pc) st.scale = "penta";
      else { st.scale = "single"; st.single = pc; }
    } else if (d.str) {
      if (d.str === "all") st.strings = st.strings.map(function () { return true; });
      else st.strings[+d.str - 1] = !st.strings[+d.str - 1];
    } else if (d.oct != null) {
      st.octs[d.oct] = !st.octs[d.oct];
    } else if (b.id === "smReset") {
      var keep = { tuning: st.tuning, zoom: st.zoom };
      st = JSON.parse(JSON.stringify(DEFAULTS));
      st.tuning = keep.tuning; st.zoom = keep.zoom;
    } else return;
    changed();
  });

  $("smZoomIn").addEventListener("click", function () { zoomBy(1); });
  $("smTune").addEventListener("click", function (e) {
    var b = e.target.closest("[data-play]"); if (!b) return;
    playMidi(+b.dataset.play);
    try { window.posthog && window.posthog.capture("string_map_tuning_tone", { tuning: st.tuning, midi: +b.dataset.play }); } catch (err) {}
  });
  $("smLabels").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-labels]");
    if (!b || b.dataset.labels === st.labels) return;
    st.labels = b.dataset.labels; save(); render(); trackFilters(notes.filter(passes).length);
  });
  $("smZoomOut").addEventListener("click", function () { zoomBy(-1); });

  svg.addEventListener("click", function (e) {
    var g = e.target.closest(".mk");
    if (g) select(g.getAttribute("data-id") === selectedId ? null : g.getAttribute("data-id"), "board");
    else if (selectedId) select(null);
  });
  svg.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var g = e.target.closest(".mk");
    if (!g) return;
    e.preventDefault();
    var id = g.getAttribute("data-id");
    select(id, "keyboard");
    var again = svg.querySelector('.mk[data-id="' + id + '"]');
    if (again) again.focus();
  });
  $("smDetail").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.id === "smClose") select(null);
    else if (b.dataset.goto) select(b.dataset.goto, "list");
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && selectedId) select(null); });

  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      var frac = scroller.scrollLeft / Math.max(1, scroller.scrollWidth - scroller.clientWidth);
      render();
      scroller.scrollLeft = frac * (scroller.scrollWidth - scroller.clientWidth);
    }, 150);
  });
}

function zoomBy(dir) {
  var i = ZOOMS.indexOf(st.zoom) + dir;
  if (i < 0 || i >= ZOOMS.length) return;
  // keep the centre of the view fixed while zooming
  var centre = (scroller.scrollLeft + scroller.clientWidth / 2) / scroller.scrollWidth;
  st.zoom = ZOOMS[i];
  save();
  render();
  scroller.scrollLeft = centre * scroller.scrollWidth - scroller.clientWidth / 2;
  trackFilters(notes.filter(passes).length);
}

function syncControls() {
  var q = function (sel) { return document.querySelectorAll(sel); };
  q("[data-type]").forEach(function (b) { b.setAttribute("aria-pressed", st.types[b.dataset.type] ? "true" : "false"); });
  q("[data-pos]").forEach(function (b) { b.setAttribute("aria-pressed", st.pos === b.dataset.pos ? "true" : "false"); });
  q("[data-scale]").forEach(function (b) { b.setAttribute("aria-pressed", st.scale === b.dataset.scale ? "true" : "false"); });
  q("[data-deg]").forEach(function (b) {
    var pc = +b.dataset.deg;
    b.setAttribute("aria-pressed", st.scale === "single" && st.single === pc ? "true" : "false");
    // show this tuning's Western name for each degree
    b.title = westernName(tuning.doMidi + pc, tuning).letter + westernName(tuning.doMidi + pc, tuning).acc;
  });
  q("[data-str]").forEach(function (b) {
    var on = b.dataset.str === "all" ? st.strings.every(Boolean) : st.strings[+b.dataset.str - 1];
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  q("[data-oct]").forEach(function (b) { b.setAttribute("aria-pressed", st.octs[b.dataset.oct] ? "true" : "false"); });
  $("smTuning").value = tuning.id;
}

function setTuning() {
  tuning = tuningById(st.tuning);
  st.tuning = tuning.id;
  notes = buildNotes(tuning);
  byId = {};
  notes.forEach(function (n) { byId[n.id] = n; });
  if (selectedId && !byId[selectedId]) selectedId = null;
  var opens = notes.filter(function (n) { return n.type === "san"; });
  renderTune();
  $("smTuningInfo").innerHTML = '<span class="cjk">' + tuning.name + "</span> · 1 = " + esc(tuning.key) +
    " · strings " + opens.map(function (n) { return jpHtml(n); }).join(" ") +
    " <small>(" + opens.map(function (n) { return esc(n.west.helm); }).join(" ") + ")</small>";
}

// ---------------- how to tune (定弦) ----------------
var NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
function stringName(s) { return CN_NUM[s] + "弦"; }
function touch(s, p) {
  return p === 1 ? '<b class="cjk">' + stringName(s) + "</b> open (散)"
    : '<b class="cjk">' + stringName(s) + "</b> 泛 at <b class=\"cjk\">" + CN_NUM[PARTIAL_HUI[p]] + "徽</b>";
}
function renderTune() {
  var box = $("smTune"); if (!box) return;
  var g = tuningSteps(tuning, 1), o = tuning.open, base = TUNINGS[0];
  var openName = function (s) { return esc(westernName(o[s - 1], tuning).sci); };
  var html = '<h2><span class="cjk">定弦</span> How to tune · ' + esc(tuning.name) + "</h2>";
  if (tuning.id !== base.id) {
    var moves = [];
    for (var s = 1; s <= 7; s++) {
      var dlt = o[s - 1] - base.open[s - 1];
      if (dlt) moves.push((dlt < 0 ? "slacken" : "tighten") + ' <b class="cjk">' + stringName(s) + "</b> by " +
        (Math.abs(dlt) === 1 ? "a semitone" : Math.abs(dlt) + " semitones") + " (" + esc(westernName(base.open[s - 1], base).sci) + " → " + openName(s) + ")");
    }
    html += '<p class="sm-tune-from"><b>From 正調:</b> ' + moves.join("; ") + '. Then check it with the pairs below.</p>';
  }
  html += '<p class="sm-note">Pitch on the qin is relative: what matters is how the strings sound against each other. ' +
    'Lightly touch the string over the hui (don\'t press) and pluck for a 泛 harmonic. Two notes in tune sound as one; ' +
    'out of tune you hear a slow wobble (beats) that slows and stops as you get there. Turn the 琴軫 tuning peg; tighter is higher.</p>';
  html += '<ol class="sm-tune-steps"><li><span>Tune <b class="cjk">' + stringName(g.ref) + "</b> to " + openName(g.ref) +
    " (" + midiToHz(o[g.ref - 1]).toFixed(1) + " Hz), or wherever your strings sit comfortably.</span>" +
    '<button type="button" class="sm-play" data-play="' + o[g.ref - 1] + '" aria-label="Play ' + openName(g.ref) + '">▶</button></li>';
  g.steps.forEach(function (x) {
    html += "<li><span>Tune " + touch(x.b, x.pb).replace("</b>", "</b>") + " to match " + touch(x.a, x.pa) +
      ' <small>both ' + esc(westernName(x.midi, tuning).sci) + "</small></span>" +
      '<button type="button" class="sm-play" data-play="' + x.midi + '" aria-label="Play the unison">▶</button></li>';
  });
  html += "</ol>";
  if (g.checks.length) {
    html += '<details class="sm-tune-checks"><summary>Double-check with ' + g.checks.length + " more pairs</summary><ul>" +
      g.checks.map(function (x) {
        return "<li><span>" + touch(x.a, x.pa) + " = " + touch(x.b, x.pb) + ' <small>' + esc(westernName(x.midi, tuning).sci) + "</small></span>" +
          '<button type="button" class="sm-play" data-play="' + x.midi + '" aria-label="Play">▶</button></li>';
      }).join("") + "</ul></details>";
  }
  box.innerHTML = html;
}
// a soft plucked tone to tune against
var actx = null;
function playMidi(m) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
    var f = midiToHz(m), t = actx.currentTime, out = actx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    out.connect(actx.destination);
    [1, 2, 3].forEach(function (h, i) {
      var osc = actx.createOscillator(), g = actx.createGain();
      osc.frequency.value = f * h; g.gain.value = [1, 0.25, 0.08][i];
      osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + 3.3);
    });
  } catch (e) {}
}

function changed() {
  save();
  syncControls();
  var count = render();
  renderDetail();
  trackFilters(count);
}

setTuning();
buildControls();
syncControls();
render();
renderDetail();
