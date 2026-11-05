// Tests automatiques de Carnet. À lancer depuis la racine du projet, sans rien installer :
//   node --test tests/carnet.test.js
// js/app.js est chargé tel quel dans un faux navigateur, à la date fixe du 15 novembre 2026.
"use strict";
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const EXPORTS = "S,SEC,SY,compute,activeFixes,occurrences,countWeekday,amountAt,histForChange,accounts,acctBalance,carryIn,acctMap,txByMonth,monthCore,parseAmt,bankAmount,bankDate,cleanData,applyData,cleanSync,validRepo,validToken,normRepo,csvParse,csvDelimiter,csvDetect,csvCompare,csvCell,syncMerge,syncCanon,syncSnapshot,syncStamp,seal,unseal,deriveKey,isBox,opsSelect,opsFiltered,goalTotal,goalHint,money,esc,openSheet,closeSheet,saveLocal,undoLast,render,guessCat,labelStats,viewMois,viewOps,viewBudgets,viewBilan,viewReglages,viewUpcoming";

function fakeEl() {
  const h = {};
  const el = {
    hidden: false, value: "", checked: false, textContent: "", innerHTML: "", dataset: {}, style: {}, inert: false, isConnected: true,
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(t, f) { (h[t] = h[t] || []).push(f); },
    fire(t, e) { (h[t] || []).forEach(f => f(Object.assign({ preventDefault() {}, target: el }, e))); },
    querySelectorAll() { return []; }, appendChild() {}, remove() {}, click() {}, focus() {}, select() {}, setAttribute() {}, removeAttribute() {},
    matches() { return false; }, closest() { return null; }
  };
  return el;
}

function boot(stored) {
  const els = new Map();
  const get = s => { if (!els.has(s)) els.set(s, fakeEl()); return els.get(s); };
  const store = new Map();
  if (stored !== undefined) store.set("carnet-argent-v1", typeof stored === "string" ? stored : JSON.stringify(stored));
  const sandbox = {
    console, crypto: globalThis.crypto, TextEncoder, TextDecoder, btoa, atob, Intl, URL, Blob,
    setInterval() { return 0; }, clearTimeout() {},
    setTimeout() { return 0; }, // aucun minuteur : les tests déclenchent tout eux-mêmes
    confirm: () => true, scrollTo() {}, fetch: () => Promise.reject(new TypeError("réseau coupé")),
    navigator: {}, location: { protocol: "file:" },
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    document: {
      body: fakeEl(), documentElement: fakeEl(), activeElement: null,
      querySelector: get, querySelectorAll: () => [], createElement: fakeEl, addEventListener() {}, hidden: false
    },
    addEventListener() {}
  };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.top = sandbox;
  vm.createContext(sandbox);
  // Date figée : le 15 novembre 2026 à midi.
  vm.runInContext(`(function(){const R=Date;const T=new R(2026,10,15,12).getTime();
    class D extends R{constructor(...a){if(a.length===0)super(T);else super(...a);}static now(){return T;}}
    globalThis.Date=D;})();`, sandbox);
  const source = SRC.replace(/\}\)\(\);\s*$/, `globalThis.__c={${EXPORTS}};})();`);
  vm.runInContext(source, sandbox);
  const c = sandbox.__c;
  // Les objets viennent d'un autre contexte : on les repasse en JSON avant de les comparer.
  return { c, $: get, store, sandbox };
}
const plain = v => JSON.parse(JSON.stringify(v));
const tick = () => new Promise(r => setImmediate(r));
async function settle(n = 20) { for (let i = 0; i < n; i++) await tick(); }
const tx = (id, type, amount, date, extra) => Object.assign({ id, type, cat: type === "in" ? "extra" : "courses", amount, label: id, date, ts: 1 }, extra);

describe("montants saisis", () => {
  const { c } = boot();
  test("les formats français sont lus correctement", () => {
    assert.equal(c.parseAmt("12,5"), 12.5);
    assert.equal(c.parseAmt("1.234,56"), 1234.56);
    assert.equal(c.parseAmt("1 234,56"), 1234.56);
    assert.equal(c.parseAmt("1.234"), 1234);
  });
  test("le reste est refusé", () => {
    for (const v of ["1e5", "12abc", "-4", "", "99999999999"]) assert.ok(Number.isNaN(c.parseAmt(v)), v);
  });
  test("montants de relevé signés", () => {
    assert.equal(c.bankAmount("-1 234,56 €"), -1234.56);
    assert.equal(c.bankAmount("1,234.56"), 1234.56);
    assert.equal(c.bankAmount("(12,50)"), -12.5);
    assert.equal(c.bankAmount("12,50-"), -12.5);
    assert.equal(c.bankAmount("abc"), null);
    assert.equal(c.bankAmount("0"), 0);
  });
  test("affichage sans erreur d'arrondi", () => {
    assert.match(c.money(12.999999), /^13<span/);
    assert.match(c.money(-0.001), /^0</);
  });
});

describe("validation des données", () => {
  const { c } = boot();
  test("les anciennes données restent lisibles", () => {
    const d = c.cleanData({ tx: [tx("a", "out", 5, "2026-11-01")], profile: { recurring: [{ id: "f", type: "out", cat: "abos", amount: 9, label: "x", since: "2026-01" }], budgets: { courses: 100 } } });
    assert.equal(d.tx.length, 1); assert.equal(d.profile.recurring.length, 1); assert.equal(d.dropped, 0);
    assert.deepEqual(plain(d.profile.accounts), []); assert.deepEqual(plain(d.profile.goals), []);
  });
  test("un fichier piégé ne casse rien", () => {
    const d = c.cleanData({ tx: [null, 42, tx("x", "out", "abc", "2026-11-01"), tx("y", "out", 5, "pas une date"), { id: "__proto__", type: "out", cat: "constructor", amount: 3, label: "<img>", date: "2026-11-01" }],
      profile: { recurring: "nope", budgets: { constructor: 5 }, cats: { __proto__: 1, "c_ok": { n: "x", c: "red;x", t: "out" } }, carry: { from: "bof" }, accounts: [{ id: "z", name: "", from: "2026-01" }, 3] } });
    assert.equal(d.tx.length, 1); assert.equal(d.tx[0].cat, "autre");
    assert.deepEqual(plain(d.profile.cats), {}); assert.equal(d.profile.carry, undefined); assert.equal(d.profile.accounts.length, 0);
    assert.equal(({}).n, undefined);
  });
  test("les nouveaux champs sont gardés ou refusés", () => {
    const d = c.cleanData({ tx: [{ id: "t", type: "tr", amount: 10, label: "", from: "main", to: "liv", date: "2026-11-01", ts: 1 }, { id: "t2", type: "tr", amount: 10, from: "main", to: "main", date: "2026-11-01" }, { id: "t3", type: "tr", amount: 10, from: "main", to: "inconnu", date: "2026-11-01" }, tx("o", "out", 1, "2026-11-01", { acc: "liv" }), tx("o2", "out", 1, "2026-11-01", { acc: "inconnu" })],
      profile: { accounts: [{ id: "liv", name: "Livret", budget: false, opening: -5.5, from: "2026-01" }], carry: { on: true, from: "2026-01" }, recurring: [
        { id: "w", type: "out", cat: "abos", amount: 5, label: "w", since: "2026-01", freq: "week", wd: 9 },
        { id: "y", type: "out", cat: "abos", amount: 5, label: "y", freq: "year" },
        { id: "b", type: "out", cat: "abos", amount: 5, label: "b", since: "2026-01", freq: "hack" }] } });
    assert.deepEqual(plain(d.tx.map(t => t.id)), ["t", "o", "o2"]);
    assert.equal(d.tx[1].acc, "liv"); assert.equal(d.tx[2].acc, undefined);
    assert.equal(d.profile.accounts[0].opening, -5.5);
    assert.equal(d.profile.recurring[0].wd, 1);
    assert.equal(d.profile.recurring[1].freq, undefined, "pas de fréquence sans mois de départ");
    assert.equal(d.profile.recurring[2].freq, undefined);
    assert.equal(d.profile.carry.on, true);
  });
});

describe("fixes", () => {
  test("un fixe mensuel compte à partir de son mois, pas avant", () => {
    const { c } = boot({ tx: [], profile: { recurring: [{ id: "f", type: "in", cat: "salaire", amount: 1499, label: "S", since: "2026-11" }] } });
    assert.equal(c.compute("2026-10").reste, 0);
    assert.equal(c.compute("2026-11").reste, 1499);
    assert.equal(c.compute("2026-12").reste, 1499);
  });
  test("une rentrée ponctuelle ne compte que dans son mois (le bug signalé)", () => {
    const { c } = boot({ tx: [tx("r", "in", 1499, "2026-11-03")], profile: {} });
    assert.equal(c.compute("2026-11").reste, 1499);
    assert.equal(c.compute("2026-12").reste, 0);
  });
  test("fréquences", () => {
    const { c } = boot();
    const q = { amount: 30, since: "2026-01", freq: "quarter" }, y = { amount: 30, since: "2026-03", freq: "year" };
    assert.equal(c.occurrences(q, "2026-04"), 1); assert.equal(c.occurrences(q, "2026-05"), 0); assert.equal(c.occurrences(q, "2025-10"), 0);
    assert.equal(c.occurrences(y, "2027-03"), 1); assert.equal(c.occurrences(y, "2027-04"), 0);
    assert.equal(c.countWeekday("2026-11", 0), 5, "novembre 2026 a 5 dimanches");
    assert.equal(c.countWeekday("2026-11", 1), 5, "et 5 lundis");
    assert.equal(c.countWeekday("2026-11", 2), 4);
    assert.equal(c.countWeekday("2026-11", 1, 15), 2, "2 lundis jusqu'au 15");
  });
  test("une dépense hebdomadaire est multipliée par le nombre de semaines", () => {
    const { c } = boot({ tx: [], profile: { recurring: [{ id: "w", type: "out", cat: "abos", amount: 10, label: "w", since: "2026-11", freq: "week", wd: 2 }] } });
    assert.equal(c.compute("2026-11").outFix, 40);
    assert.equal(c.activeFixes("2026-11")[0].unit, 10);
  });
  test("un nouveau montant ne change pas les mois passés", () => {
    const { c } = boot();
    const prev = { amount: 640, since: "2026-01" };
    assert.deepEqual(plain(c.histForChange(prev, "2026-11")), [{ until: "2026-10", amount: 640 }]);
    assert.equal(c.histForChange(prev, "2026-01"), undefined, "dès le premier mois : rien à garder");
    const after = { amount: 710, since: "2026-01", hist: [{ until: "2026-10", amount: 640 }] };
    assert.equal(c.amountAt(after, "2026-10"), 640); assert.equal(c.amountAt(after, "2026-11"), 710);
    assert.deepEqual(plain(c.histForChange(after, "2027-01")), [{ until: "2026-10", amount: 640 }, { until: "2026-12", amount: 710 }]);
    assert.deepEqual(plain(c.histForChange(after, "2026-06")), [{ until: "2026-05", amount: 640 }], "un changement plus ancien remplace la suite");
  });
  test("un fixe arrêté reste compté avant son arrêt", () => {
    const { c } = boot({ tx: [], profile: { recurring: [{ id: "f", type: "out", cat: "abos", amount: 20, label: "F", since: "2026-01", until: "2026-10" }] } });
    assert.equal(c.compute("2026-10").outFix, 20); assert.equal(c.compute("2026-11").outFix, 0);
  });
});

describe("saisie", () => {
  const fill = (e, o) => { for (const k in o) e.$(k).value = o[k]; };
  test("« Une seule fois » crée une opération, pas un fixe", () => {
    const e = boot(); const { c } = e;
    c.openSheet({ mode: "tx", type: "in" });
    fill(e, { "#fAmount": "1499", "#fLabel": "Prime", "#fDate": "2026-11-03" });
    e.$("#sheet").fire("submit");
    assert.equal(c.S.tx.length, 1); assert.equal(c.S.profile.recurring.length, 0);
    assert.equal(c.compute("2026-12").income, 0);
  });
  test("« Chaque mois » crée un fixe à partir du mois choisi", () => {
    const e = boot(); const { c } = e;
    c.openSheet({ mode: "tx", type: "in" });
    e.$("#fFreq").fire("change", { target: { value: "month" } });
    assert.equal(c.S.tx.length, 0);
    fill(e, { "#fAmount": "1499", "#fLabel": "Salaire", "#fSince": "2026-10" });
    e.$("#sheet").fire("submit");
    assert.equal(c.S.tx.length, 0); assert.equal(c.S.profile.recurring.length, 1);
    assert.equal(c.compute("2026-10").income, 1499); assert.equal(c.compute("2026-09").income, 0);
  });
  test("changer un montant à partir d'un mois choisi", () => {
    const e = boot({ tx: [], profile: { recurring: [{ id: "f", type: "out", cat: "logement", amount: 640, label: "Loyer", since: "2026-01" }] } }); const { c } = e;
    c.openSheet({ mode: "fixed", id: "f", type: "out", cat: "logement", amount: 640, label: "Loyer", freq: "month" });
    fill(e, { "#fAmount": "700", "#fFrom": "2027-01" });
    e.$("#sheet").fire("submit");
    assert.equal(c.compute("2026-12").outFix, 640); assert.equal(c.compute("2027-01").outFix, 700);
  });
  test("un montant de fixe illisible est refusé sans rien changer", () => {
    const e = boot(); const { c } = e;
    c.openSheet({ mode: "fixed", type: "out", freq: "month" });
    fill(e, { "#fAmount": "abc", "#fSince": "2026-11" });
    e.$("#sheet").fire("submit");
    assert.equal(c.S.profile.recurring.length, 0); assert.equal(e.$("#shErr").hidden, false);
  });
  test("reprendre un fixe arrêté crée un nouveau fixe, l'ancien garde le passé", () => {
    const e = boot({ tx: [], profile: { recurring: [{ id: "f", type: "out", cat: "abos", amount: 20, label: "F", since: "2026-01", until: "2026-09" }] } }); const { c } = e;
    c.openSheet({ mode: "fixed", id: "f", type: "out", cat: "abos", amount: 20, label: "F", freq: "month" });
    e.$("#sheet").fire("submit"); // « Reprendre »
    assert.equal(c.S.profile.recurring.length, 1, "rien n'est créé tant que tu n'as pas validé");
    fill(e, { "#fAmount": "25", "#fSince": "2026-11" });
    e.$("#sheet").fire("submit");
    assert.equal(c.S.profile.recurring.length, 2);
    assert.equal(c.compute("2026-09").outFix, 20); assert.equal(c.compute("2026-10").outFix, 0); assert.equal(c.compute("2026-11").outFix, 25);
  });
  test("supprimer puis annuler restaure tout", async () => {
    const e = boot({ tx: [tx("a", "out", 5, "2026-11-01")], profile: {} }); const { c } = e;
    c.openSheet({ mode: "tx", id: "a", type: "out", cat: "courses", amount: 5, label: "a", date: "2026-11-01", freq: "once" });
    e.$("#shDel").fire("click"); e.$("#shDel").fire("click");
    assert.equal(c.S.tx.length, 0);
    c.undoLast();
    assert.equal(c.S.tx.length, 1); assert.equal(c.S.tx[0].id, "a");
    await settle();
    assert.equal(JSON.parse(e.store.get("carnet-argent-v1")).tx.length, 1, "aussi dans le stockage");
  });
  test("annuler est refusé si le carnet a changé entre-temps", () => {
    const e = boot({ tx: [tx("a", "out", 5, "2026-11-01"), tx("b", "out", 6, "2026-11-01")], profile: {} }); const { c } = e;
    c.openSheet({ mode: "tx", id: "a", type: "out", cat: "courses", amount: 5, label: "a", date: "2026-11-01", freq: "once" });
    e.$("#shDel").fire("click"); e.$("#shDel").fire("click");
    c.S.tx = c.S.tx.filter(t => t.id !== "b"); // simule un changement venu de la synchro
    c.undoLast();
    assert.equal(c.S.tx.length, 0);
  });
  test("catégorie devinée sur les mots entiers", () => {
    const { c } = boot();
    assert.equal(c.guessCat("CB MONOPRIX", "out", []), "courses");
    assert.equal(c.guessCat("UBER EATS Paris", "out", []), "sorties");
    assert.equal(c.guessCat("Barbecue", "out", []), null, "« bar » ne doit pas matcher « barbecue »");
  });
});

describe("report et comptes", () => {
  test("sans report, rien ne change", () => {
    const { c } = boot({ tx: [tx("a", "in", 100, "2026-10-01")], profile: {} });
    assert.equal(c.compute("2026-11").reste, 0); assert.equal(c.compute("2026-11").carry, 0);
  });
  test("le report ajoute le positif et le négatif, depuis le mois choisi seulement", () => {
    const { c } = boot({ tx: [tx("old", "in", 999, "2026-08-01"), tx("a", "in", 100, "2026-09-01"), tx("b", "out", 150, "2026-10-01")],
      profile: { carry: { on: true, from: "2026-09" }, accounts: [{ id: "main", name: "C", budget: true, opening: 10, from: "2026-09" }] } });
    assert.equal(c.compute("2026-08").reste, 999, "avant le départ : pas de report");
    assert.equal(c.compute("2026-09").reste, 110);
    assert.equal(c.compute("2026-10").reste, -40);
    assert.equal(c.compute("2026-11").reste, -40); assert.equal(c.compute("2026-11").carry, -40);
    assert.equal(c.compute("2026-11").net, 0, "le résultat du mois reste séparé");
  });
  test("report désactivé : retour à zéro sans perdre le réglage", () => {
    const { c } = boot({ tx: [tx("a", "in", 100, "2026-10-01")], profile: { carry: { on: false, from: "2026-10" } } });
    assert.equal(c.compute("2026-11").reste, 0);
  });
  test("virement : neutre dans le budget, visible vers un livret", () => {
    const profile = { accounts: [{ id: "cash", name: "Espèces", budget: true, opening: 0, from: "2026-01" }, { id: "liv", name: "Livret", budget: false, opening: 0, from: "2026-01" }] };
    const { c } = boot({ tx: [tx("i", "in", 1000, "2026-11-01"),
      { id: "t1", type: "tr", amount: 100, label: "", from: "main", to: "cash", date: "2026-11-02", ts: 2 },
      { id: "t2", type: "tr", amount: 300, label: "", from: "main", to: "liv", date: "2026-11-03", ts: 3 },
      tx("s", "out", 50, "2026-11-04", { acc: "liv" })], profile });
    const m = c.compute("2026-11");
    assert.equal(m.outTx, 0, "un virement n'est pas une dépense, ni une dépense hors budget");
    assert.equal(m.reste, 700);
    const bal = id => c.acctBalance(c.accounts().find(a => a.id === id));
    assert.equal(bal("cash"), 100); assert.equal(bal("liv"), 250);
  });
  test("solde : un fixe daté n'est compté qu'une fois passé", () => {
    const { c } = boot({ tx: [], profile: { accounts: [{ id: "main", name: "C", budget: true, opening: 100, from: "2026-11" }], recurring: [
      { id: "a", type: "out", cat: "abos", amount: 10, label: "a", since: "2026-01", day: 5 },
      { id: "b", type: "out", cat: "abos", amount: 20, label: "b", since: "2026-01", day: 25 },
      { id: "d", type: "out", cat: "abos", amount: 40, label: "d", since: "2026-01" }] } });
    assert.equal(c.acctBalance(c.accounts()[0]), 50, "100 - 10 - 40, le fixe du 25 n'est pas encore passé");
  });
  test("une opération future n'entre pas dans le solde", () => {
    const { c } = boot({ tx: [tx("f", "out", 10, "2026-11-20")], profile: { accounts: [{ id: "main", name: "C", budget: true, opening: 100, from: "2026-11" }] } });
    assert.equal(c.acctBalance(c.accounts()[0]), 100);
  });
  test("corriger avec le solde réel", () => {
    const e = boot({ tx: [tx("a", "out", 30, "2026-11-01")], profile: { accounts: [{ id: "main", name: "C", budget: true, opening: 100, from: "2026-11" }] } }); const { c } = e;
    c.openSheet({ mode: "acct", id: "main" });
    e.$("#acReal").value = "60";
    e.$("#sheet").fire("submit");
    assert.equal(c.acctBalance(c.accounts()[0]), 60);
    assert.equal(c.accounts()[0].opening, 90);
  });
  test("supprimer un compte renvoie ses opérations sur le compte courant", () => {
    const e = boot({ tx: [tx("a", "out", 5, "2026-11-01", { acc: "liv" }), { id: "t", type: "tr", amount: 5, label: "", from: "main", to: "liv", date: "2026-11-01", ts: 1 }],
      profile: { accounts: [{ id: "liv", name: "Livret", budget: false, opening: 0, from: "2026-01" }] } }); const { c } = e;
    c.openSheet({ mode: "acct", id: "liv" });
    e.$("#shDel").fire("click"); e.$("#shDel").fire("click");
    assert.equal(c.accounts().length, 1);
    assert.deepEqual(plain(c.S.tx.map(t => t.id)), ["a"], "un virement vers soi-même disparaît");
    assert.equal(c.S.tx[0].acc, undefined);
  });
});

describe("objectifs", () => {
  test("versements et retraits", () => {
    const { c } = boot({ tx: [tx("v", "out", 200, "2026-11-01", { cat: "epargne", goal: "g" }), tx("r", "in", 50, "2026-11-02", { cat: "retrait", goal: "g" })], profile: { goals: [{ id: "g", label: "V", target: 1000, saved: 100, date: "2027-02" }] } });
    const g = c.S.profile.goals[0];
    assert.equal(c.goalTotal(g), 250);
    assert.match(c.goalHint(g, 250), /187,50/);
    assert.equal(c.compute("2026-11").reste, -150);
  });
});

describe("filtres d'opérations", () => {
  const data = { tx: [tx("Courses Lidl", "out", 40, "2026-11-01"), tx("Resto", "out", 80, "2026-11-02", { cat: "sorties" }), tx("Vieux", "out", 10, "2026-09-05"), tx("Prime", "in", 300, "2026-11-03"), tx("Ancien", "out", 15, "2025-11-05")], profile: {} };
  const ids = c => plain(c.opsSelect().map(t => t.label)).sort();
  test("par défaut : le mois affiché", () => {
    const { c } = boot(data);
    assert.deepEqual(ids(c), ["Courses Lidl", "Prime", "Resto"]); assert.equal(c.opsFiltered(), false);
  });
  test("une recherche regarde tous les mois, sans tenir compte des accents", () => {
    const { c } = boot(data); c.S.query = "ancien";
    assert.deepEqual(ids(c), ["Ancien"]);
  });
  test("catégorie, montant, période et type se combinent", () => {
    const { c } = boot(data);
    c.S.opsF.cat = "sorties"; assert.deepEqual(ids(c), ["Resto"]); c.S.opsF.cat = "";
    c.S.opsF.min = "50"; assert.deepEqual(ids(c), ["Prime", "Resto"]);
    c.S.opsF.max = "100"; assert.deepEqual(ids(c), ["Resto"]); c.S.opsF.min = ""; c.S.opsF.max = "";
    c.S.opsF.period = "3m"; assert.deepEqual(ids(c), ["Courses Lidl", "Prime", "Resto", "Vieux"]);
    c.S.opsF.period = "year"; assert.ok(!ids(c).includes("Ancien"));
    c.S.opsF.period = "all"; assert.equal(ids(c).length, 5);
    c.S.filter = "in"; assert.deepEqual(ids(c), ["Prime"]);
  });
  test("un filtre illisible est ignoré", () => {
    const { c } = boot(data); c.S.opsF.min = "abc";
    assert.equal(ids(c).length, 3);
  });
});

describe("relevés bancaires", () => {
  const sample = "Compte n° 123\nSolde;1 234,56\n\nDate;Libellé;Débit;Crédit\n02/10/2026;CB LIDL;45,20;\n05/10/2026;PRLV LOYER;640,00;\n28/10/2026;VIR;;150,00\n31/13/2026;MAUVAISE DATE;1,00;\n";
  const detect = (c, t) => c.csvDetect(c.csvParse(t, c.csvDelimiter(t)));
  test("en-têtes et colonnes détectés malgré le préambule", () => {
    const { c } = boot(); const d = detect(c, sample);
    assert.deepEqual(plain(d.names), ["Date", "Libellé", "Débit", "Crédit"]);
    assert.equal(d.map.debit, 2); assert.equal(d.map.credit, 3); assert.equal(d.map.amount, -1);
  });
  test("guillemets, virgules et absence d'en-tête", () => {
    const { c } = boot();
    const d = detect(c, '2026-09-01,"AMAZON, MARKETPLACE","-1,234.56"\n2026-09-02,DECATHLON,-20.00\n');
    assert.equal(d.rows[0][1], "AMAZON, MARKETPLACE"); assert.equal(d.map.amount, 2); assert.equal(d.map.label, 1);
  });
  test("un fichier quelconque n'est pas reconnu", () => {
    const { c } = boot(); assert.equal(detect(c, "bonjour\nle monde\n"), null);
  });
  test("tri : à importer, illisibles", () => {
    const { c } = boot(); const r = c.csvCompare(detect(c, sample), true, true);
    assert.equal(r.add.length, 3); assert.equal(r.bad, 1);
  });
  test("réimporter le même fichier n'ajoute rien", () => {
    const { c } = boot(); const d = detect(c, sample);
    c.csvCompare(d, true, true).add.forEach((x, i) => c.S.tx.push({ id: "i" + i, ts: i, cat: "autre", ...x }));
    const r = c.csvCompare(d, true, true);
    assert.equal(r.add.length, 0); assert.equal(r.dup, 3);
  });
  test("une saisie à la main au même montant n'est pas importée en double", () => {
    const { c } = boot({ tx: [tx("Courses", "out", 45.2, "2026-10-02")], profile: {} });
    const d = detect(c, sample);
    const on = c.csvCompare(d, true, true), off = c.csvCompare(d, true, false);
    assert.deepEqual(plain(on.near), ["CB LIDL"]); assert.equal(on.add.length, 2); assert.equal(off.add.length, 3);
  });
  test("une seule saisie ne cache qu'une seule ligne", () => {
    const { c } = boot({ tx: [tx("Café", "out", 2, "2026-10-02")], profile: {} });
    const r = c.csvCompare(detect(c, "Date;Libellé;Montant\n02/10/2026;CAFE A;-2,00\n02/10/2026;CAFE B;-2,00\n"), true, true);
    assert.equal(r.near.length, 1); assert.equal(r.add.length, 1);
  });
  test("un fixe ne cache qu'une ligne par passage, au montant de l'époque", () => {
    const { c } = boot({ tx: [], profile: { recurring: [{ id: "f", type: "out", cat: "abos", amount: 700, label: "L", since: "2026-01", hist: [{ until: "2026-10", amount: 640 }] }] } });
    const r = c.csvCompare(detect(c, "Date;Libellé;Montant\n05/10/2026;LOYER;-640,00\n06/10/2026;AUTRE;-640,00\n05/11/2026;LOYER;-700,00\n"), true, true);
    assert.equal(r.fixed.length, 2); assert.equal(r.add.length, 1); assert.equal(r.add[0].label, "AUTRE");
  });
  test("export : les formules sont neutralisées", () => {
    const { c } = boot();
    assert.equal(c.csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
    assert.equal(c.csvCell("-5"), "'-5"); assert.equal(c.csvCell("Lidl"), "Lidl");
  });
});

describe("synchro : fusion", () => {
  const T = new Date(2026, 10, 1).getTime();
  const P = (o = {}) => Object.assign({ recurring: [], goals: [], accounts: [], budgets: {}, cats: {}, deleted: {} }, o);
  test("deux appareils convergent vers le même état, dans les deux sens", () => {
    const { c } = boot();
    const a = { tx: [tx("x", "out", 1, "2026-11-01", { upd: T + 100 }), tx("y", "out", 2, "2026-11-01", { upd: T + 100 })], profile: P({ budgets: { courses: 10 }, budgetsUpd: 50 }) };
    const b = { tx: [tx("x", "out", 9, "2026-11-01", { upd: T + 200 }), tx("z", "out", 3, "2026-11-01", { upd: T + 150 })], profile: P({ budgets: { courses: 20 }, budgetsUpd: 60, deleted: { y: T + 300 } }) };
    const ab = c.syncMerge(a, b), ba = c.syncMerge(b, a);
    assert.equal(c.syncCanon(ab), c.syncCanon(ba));
    const ids = plain(ab.tx.map(t => t.id)).sort();
    assert.deepEqual(ids, ["x", "z"]);
    assert.equal(ab.tx.find(t => t.id === "x").amount, 9);
    assert.equal(ab.profile.budgets.courses, 20);
  });
  test("une modification plus récente qu'une suppression gagne", () => {
    const { c } = boot();
    const a = { tx: [tx("x", "out", 1, "2026-11-01", { upd: T + 500 })], profile: P() }, b = { tx: [], profile: P({ deleted: { x: T + 300 } }) };
    assert.equal(c.syncMerge(a, b).tx.length, 1);
  });
  test("comptes, virements et report sont fusionnés", () => {
    const { c } = boot();
    const acc = { id: "liv", name: "L", budget: false, opening: 0, from: "2026-01", upd: 10 };
    const a = { tx: [], profile: P({ accounts: [acc], carry: { on: true, from: "2026-01" }, carryUpd: 20 }) };
    const b = { tx: [{ id: "t", type: "tr", amount: 5, label: "", from: "main", to: "liv", date: "2026-11-01", ts: 1, upd: 30 }], profile: P({ carry: { on: false, from: "2026-01" }, carryUpd: 10 }) };
    const m = c.cleanData(c.syncMerge(a, b));
    assert.equal(m.tx.length, 1, "le virement survit car le compte est là");
    assert.equal(m.profile.accounts.length, 1); assert.equal(m.profile.carry.on, true);
  });
  test("les changements et suppressions sont datés tout seuls", () => {
    const { c } = boot({ tx: [tx("a", "out", 1, "2026-11-01"), tx("b", "out", 2, "2026-11-01")], profile: {} });
    c.S.sync = { dirty: false }; c.syncSnapshot();
    c.S.tx[0] = Object.assign({}, c.S.tx[0], { amount: 5 });
    c.S.tx = [c.S.tx[0]];
    c.S.profile.carry = { on: true, from: "2026-11" };
    c.syncStamp();
    assert.ok(c.S.tx[0].upd > 0); assert.ok(c.S.profile.deleted.b > 0); assert.ok(c.S.profile.carryUpd > 0); assert.equal(c.S.sync.dirty, true);
  });
  test("rien ne change : pas de nouvelle date", () => {
    const { c } = boot({ tx: [tx("a", "out", 1, "2026-11-01", { upd: 7 })], profile: {} });
    c.S.sync = { dirty: false }; c.syncSnapshot(); c.syncStamp();
    assert.equal(c.S.tx[0].upd, 7); assert.equal(c.S.sync.dirty, false);
  });
});

describe("sécurité", () => {
  test("chiffrer puis déchiffrer, et refuser la mauvaise clé", async () => {
    const { c, sandbox } = boot();
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const k1 = await c.deriveKey("mot-de-passe-1", salt, 100000), k2 = await c.deriveKey("mot-de-passe-2", salt, 100000);
    const box = await c.seal('{"a":1}', k1, salt, 100000);
    assert.ok(c.isBox(box)); assert.ok(!JSON.stringify(box).includes('"a":1'));
    assert.equal((await c.unseal(box, k1)).a, 1);
    await assert.rejects(c.unseal(box, k2));
    assert.ok(sandbox);
  });
  test("un fichier chiffré au coût absurde est refusé", () => {
    const { c } = boot();
    assert.equal(c.isBox({ enc: "carnet", v: 1, iter: 1e12, salt: "A", iv: "A", ct: "A" }), false);
    assert.equal(c.isBox({ enc: "carnet", v: 1, iter: 10, salt: "A", iv: "A", ct: "A" }), false);
  });
  test("le texte inséré dans la page est échappé", () => {
    const { c } = boot({ tx: [tx('<img src=x onerror="a()">', "out", 1, "2026-11-01"), { id: "t", type: "tr", amount: 1, label: "<b>v</b>", from: "main", to: "x", date: "2026-11-01", ts: 1 }],
      profile: { accounts: [{ id: "x", name: "<i>N</i>", budget: false, opening: 0, from: "2026-01" }], goals: [{ id: "g", label: "<u>G</u>", target: 5, saved: 0 }], recurring: [{ id: "r", type: "out", cat: "abos", amount: 3, label: "<s>R</s>", since: "2026-01", day: 20 }], cats: { c_a: { n: "<em>C</em>", c: "#112233", t: "out" } } } });
    c.S.statCat = "c_a";
    for (const v of [c.viewMois(), c.viewOps(), c.viewBudgets(), c.viewBilan(), c.viewReglages()]) {
      assert.ok(!/<(img|b>v|i>N|u>G|s>R|em>C)/.test(v), v.match(/<(img|b>v|i>N|u>G|s>R|em>C).{0,40}/)?.[0]);
    }
  });
  test("le jeton et la config de synchro sont refusés s'ils sont invalides", () => {
    const { c } = boot();
    assert.equal(c.cleanSync({ repo: "a/b", token: "court", key: "k", salt: "s", iter: 1 }), null);
    assert.equal(c.validRepo("../../x"), false); assert.equal(c.validRepo("a/b"), true);
    assert.equal(c.normRepo("https://github.com/a/b.git/"), "a/b");
  });
  test("le jeton n'apparaît pas dans un enregistrement sans chiffrement", async () => {
    const e = boot({ tx: [], profile: {} }); const { c } = e;
    c.S.sync = { repo: "a/b", token: "FAUX_JETON_DE_TEST_0123456789", key: "k", salt: "s", iter: 1 };
    c.S.sync.dirty = false; c.saveLocal(); await settle();
    assert.ok(!e.store.get("carnet-argent-v1").includes("FAUX_JETON"));
    c.S.sync = null;
  });
});

describe("toutes les vues s'affichent", () => {
  test("carnet vide", () => {
    const { c } = boot();
    for (const v of [c.viewMois(), c.viewOps(), c.viewBudgets(), c.viewBilan(), c.viewReglages()]) assert.ok(v.length > 0);
    assert.ok(!/NaN|undefined/.test(c.viewBilan()));
  });
  test("carnet complet, tous mois confondus", () => {
    const { c } = boot({ tx: [tx("a", "out", 5, "2026-11-01"), tx("b", "in", 50, "2026-10-01"), { id: "t", type: "tr", amount: 1, label: "", from: "main", to: "x", date: "2026-11-02", ts: 3 }],
      profile: { carry: { on: true, from: "2026-10" }, accounts: [{ id: "x", name: "L", budget: false, opening: 3, from: "2026-01" }], goals: [{ id: "g", label: "G", target: 5, saved: 0, date: "2027-01" }],
        recurring: [{ id: "r", type: "out", cat: "abos", amount: 3, label: "R", since: "2026-01", day: 20 }, { id: "w", type: "out", cat: "abos", amount: 3, label: "W", since: "2026-01", freq: "week", wd: 3 }, { id: "y", type: "in", cat: "extra", amount: 3, label: "Y", since: "2026-11", freq: "year" }, { id: "s", type: "out", cat: "abos", amount: 3, label: "S", since: "2026-01", until: "2026-03" }] } });
    for (const m of ["2026-11", "2026-10", "2027-03", "2020-01"]) {
      c.S.month = m;
      for (const [n, v] of Object.entries({ mois: c.viewMois(), ops: c.viewOps(), budgets: c.viewBudgets(), reglages: c.viewReglages() })) assert.ok(!/NaN|undefined/.test(v), m + " " + n);
      for (const r of [6, 12]) { c.S.statRange = r; assert.ok(!/NaN|undefined/.test(c.viewBilan()), m + " bilan " + r); }
    }
    assert.match(c.viewUpcoming(c.compute("2026-11")), /le 20/);
  });
});
