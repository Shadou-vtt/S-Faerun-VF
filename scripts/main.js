/**
 * S-Faerûn VF — module maison de Shadou (L'épopée de Faerûn)
 * 1. Références des états et des règles vers le SRD 2024 français (dnd5e.content24)
 *    au lieu des pages anglaises du Manuel des joueurs.
 * 2. Vitrines : copie automatique de contenus du monde dans des compendiums du monde,
 *    pour que les fenêtres « Ajouter… » ne proposent que la VF :
 *    - « Options de personnage (VF) » : classes, sous-classes, espèces, historiques, dons ;
 *    - « Sorts (VF) » : sorts du dossier « Sorts 2024 » ;
 *    - « Équipement (VF) » : armes, armures, équipement, consommables, outils, trésors, contenants ;
 *    - « Invocations (VF) » : créatures du monde utilisées par les activités d'invocation.
 *    Les objets et acteurs du monde restent la seule version de référence.
 * 3. Masquage, dans le navigateur de compendiums, de tous les autres compendiums d'objets.
 */

const MOD = "s-faerun-vf";
const PHB_PREFIX = "Compendium.dnd-players-handbook.content.";
const SRD_PREFIX = "Compendium.dnd5e.content24.";
const PACK_FOLDER = "Module S-Faerûn VF";
const log = (...args) => console.log("S-Faerûn VF |", ...args);

const OPTION_TYPES = new Set(["class", "subclass", "race", "background"]);
const GEAR_TYPES = new Set(["weapon", "equipment", "consumable", "tool", "loot", "container"]);
const SPELL_FOLDER = "Sorts 2024";
const SUMMON_PACK = "world.invocations-vf";

function inFolderNamed(doc, name) {
  for ( let f = doc.folder; f; f = f.folder ) if ( f.name === name ) return true;
  return false;
}

/** Identifiants des acteurs du monde utilisés par les invocations (profils pointant vers la vitrine). */
function summonActorIds() {
  const ids = new Set();
  const prefix = `Compendium.${SUMMON_PACK}.Actor.`;
  for ( const item of game.items ) {
    for ( const a of item.system.activities ?? [] ) {
      for ( const p of a.profiles ?? [] ) if ( p.uuid?.startsWith(prefix) ) ids.add(p.uuid.slice(prefix.length));
    }
  }
  return ids;
}

/** Définition des vitrines. */
const SHOWCASES = [
  { key: "syncOptions", name: "options-de-personnage", label: "Options de personnage (VF)", type: "Item",
    filter: i => OPTION_TYPES.has(i.type) || ((i.type === "feat") && (i.system?.type?.value === "feat")) },
  { key: "syncSpells", name: "sorts-vf", label: "Sorts (VF)", type: "Item",
    filter: i => (i.type === "spell") && inFolderNamed(i, SPELL_FOLDER) },
  { key: "syncGear", name: "equipement-vf", label: "Équipement (VF)", type: "Item",
    filter: i => GEAR_TYPES.has(i.type) },
  { key: "syncSummons", name: "invocations-vf", label: "Invocations (VF)", type: "Actor",
    filter: (a, ctx) => ctx.summonIds.has(a.id) }
];
const packId = sc => `world.${sc.name}`;
const worldCollection = sc => (sc.type === "Actor" ? game.actors : game.items);
const docClass = sc => (sc.type === "Actor" ? Actor : Item);

/* -------------------------------------------- */
/*  Réglages                                    */
/* -------------------------------------------- */

Hooks.once("init", () => {
  const reg = (key, name, hint) => game.settings.register(MOD, key, {
    name, hint, scope: "world", config: true, type: Boolean, default: true, requiresReload: true
  });
  reg("fixReferences", "États et règles en français",
    "Les liens automatiques vers les états (À terre, Étourdi…) et les règles pointent vers le SRD 2024 français au lieu du Manuel des joueurs anglais.");
  reg("syncOptions", "Vitrine : options de personnage",
    "Copie automatiquement les classes, sous-classes, espèces, historiques et dons du monde dans « Options de personnage (VF) ».");
  reg("syncSpells", "Vitrine : sorts",
    `Copie automatiquement les sorts du dossier « ${SPELL_FOLDER} » dans « Sorts (VF) ».`);
  reg("syncGear", "Vitrine : équipement",
    "Copie automatiquement les armes, armures, équipements, consommables, outils, trésors et contenants du monde dans « Équipement (VF) ».");
  reg("syncSummons", "Vitrine : invocations",
    "Copie automatiquement les créatures du monde utilisées par les activités d'invocation dans « Invocations (VF) ».");
  reg("hideSources", "Masquer les autres sources",
    "Dans le navigateur de compendiums, masque tous les compendiums d'objets autres que les vitrines VF.");
});

/* -------------------------------------------- */
/*  1. Références vers le SRD français          */
/* -------------------------------------------- */

function fixReferences() {
  const srd = game.packs.get("dnd5e.content24");
  if ( !srd ) return;
  const journals = new Set(srd.index.map(e => e._id));
  let count = 0;
  const swap = value => {
    if ( (typeof value !== "string") || !value.startsWith(PHB_PREFIX) ) return value;
    const rest = value.slice(PHB_PREFIX.length);
    const journalId = rest.split(".")[1];
    if ( !journals.has(journalId) ) return value;
    count++;
    return SRD_PREFIX + rest;
  };
  const seen = new Set();
  const walk = (obj, depth) => {
    if ( !obj || (typeof obj !== "object") || (depth > 5) || seen.has(obj) ) return;
    seen.add(obj);
    for ( const [k, v] of Object.entries(obj) ) {
      if ( typeof v === "string" ) {
        const n = swap(v);
        if ( n !== v ) {
          try { obj[k] = n; } catch(err) { /* propriété en lecture seule */ }
        }
      }
      else if ( typeof v === "object" ) walk(v, depth + 1);
    }
  };
  walk(CONFIG.DND5E, 0);
  walk(CONFIG.statusEffects, 0);
  log(`${count} références redirigées vers le SRD français.`);
}

/* -------------------------------------------- */
/*  2. Vitrines                                 */
/* -------------------------------------------- */

function isSyncUser() {
  const gm = game.users.activeGM;
  return !!gm && gm.isSelf;
}

async function packFolderRoot() {
  let f = game.folders.find(x => (x.type === "Compendium") && (x.name === PACK_FOLDER) && !x.folder);
  if ( !f ) [f] = await Folder.createDocuments([{ name: PACK_FOLDER, type: "Compendium", sorting: "a", sort: 50000 }]);
  return f;
}

async function getPack(sc) {
  let pack = game.packs.get(packId(sc));
  if ( !pack ) {
    const CC = foundry.documents?.collections?.CompendiumCollection ?? CompendiumCollection;
    pack = await CC.createCompendium({ label: sc.label, name: sc.name, type: sc.type });
  }
  if ( pack.locked ) await pack.configure({ locked: false });
  if ( !pack.folder ) {
    const root = await packFolderRoot();
    await pack.configure({ folder: root.id });
  }
  return pack;
}

/** Recrée dans le compendium la même arborescence de dossiers que dans le monde. */
async function packFolderFor(pack, sc, worldFolder) {
  if ( !worldFolder ) return null;
  const chain = [];
  for ( let f = worldFolder; f; f = f.folder ) chain.unshift(f);
  let parent = null;
  for ( const wf of chain ) {
    let pf = pack.folders.find(f => (f.name === wf.name) && ((f.folder?.id ?? null) === parent));
    if ( !pf ) {
      [pf] = await Folder.createDocuments([{
        name: wf.name, type: sc.type, folder: parent, color: wf.color ?? null, sorting: wf.sorting
      }], { pack: pack.collection });
    }
    parent = pf.id;
  }
  return parent;
}

function stamp(doc) {
  return `${doc._stats?.modifiedTime ?? 0}|${doc.folder?.id ?? ""}`;
}

/** Effets d'un type fourni par un module inactif : ramenés au type de base dans la copie (sinon refusée). */
function sanitizeEffects(data) {
  const valid = new Set(game.documentTypes?.ActiveEffect ?? ["base"]);
  const fix = list => { for ( const e of list ?? [] ) if ( e.type && !valid.has(e.type) ) e.type = "base"; };
  fix(data.effects);
  for ( const i of data.items ?? [] ) fix(i.effects);
}

async function payload(pack, sc, doc) {
  const data = doc.toObject();
  sanitizeEffects(data);
  data.folder = await packFolderFor(pack, sc, doc.folder);
  delete data.ownership;
  data.flags ??= {};
  data.flags[MOD] = { source: doc.uuid, stamp: stamp(doc) };
  return data;
}

/** Remplace la copie (suppression puis recréation avec le même identifiant). */
async function upsert(pack, sc, docs) {
  if ( !docs.length ) return;
  const cls = docClass(sc);
  const ids = docs.map(d => d.id).filter(id => pack.index.has(id));
  for ( let k = 0; k < ids.length; k += 100 ) await cls.deleteDocuments(ids.slice(k, k + 100), { pack: pack.collection });
  for ( let k = 0; k < docs.length; k += 50 ) {
    const datas = [];
    for ( const d of docs.slice(k, k + 50) ) datas.push(await payload(pack, sc, d));
    const created = await cls.createDocuments(datas, { pack: pack.collection, keepId: true });
    if ( created.length < datas.length ) {
      const ok = new Set(created.map(c => c.id));
      const failed = datas.filter(d => !ok.has(d._id)).map(d => d.name);
      console.warn(`S-Faerûn VF | ${sc.label} : copie impossible pour ${failed.join(", ")}`);
    }
  }
}

async function removeEmptyFolders(pack) {
  let removed = true;
  while ( removed ) {
    removed = false;
    const used = new Set(pack.index.map(e => e.folder).filter(Boolean));
    for ( const f of pack.folders ) if ( f.folder ) used.add(f.folder.id);
    const empty = pack.folders.filter(f => !used.has(f.id)).map(f => f.id);
    if ( empty.length ) {
      await Folder.deleteDocuments(empty, { pack: pack.collection });
      removed = true;
    }
  }
}

const context = () => ({ summonIds: summonActorIds() });
const enabled = () => SHOWCASES.filter(sc => game.settings.get(MOD, sc.key));

async function syncOne(sc, ctx = context()) {
  const pack = await getPack(sc);
  await pack.getIndex({ fields: [`flags.${MOD}.stamp`] });
  const wanted = worldCollection(sc).filter(d => sc.filter(d, ctx));
  const wantedIds = new Set(wanted.map(d => d.id));
  const changed = wanted.filter(d => pack.index.get(d.id)?.flags?.[MOD]?.stamp !== stamp(d));
  const extra = pack.index.filter(e => !wantedIds.has(e._id)).map(e => e._id);
  for ( let k = 0; k < extra.length; k += 100 ) {
    await docClass(sc).deleteDocuments(extra.slice(k, k + 100), { pack: pack.collection });
  }
  await upsert(pack, sc, changed);
  await removeEmptyFolders(pack);
  log(`${sc.label} : ${wanted.length} éléments, ${changed.length} copiés, ${extra.length} retirés.`);
  return { total: wanted.length, updated: changed.length, removed: extra.length };
}

async function syncAll() {
  const ctx = context();
  const results = {};
  for ( const sc of enabled() ) results[sc.label] = await syncOne(sc, ctx);
  return results;
}

/* Mise à jour immédiate quand un document du monde change (regroupée par 1 s). */
const pending = { Item: new Map(), Actor: new Map() };
let timer = null;
let fullTimer = null;
function queue(type, doc, remove = false) {
  pending[type].set(doc.id, remove ? null : doc);
  clearTimeout(timer);
  timer = setTimeout(flush, 1000);
}
async function flush() {
  const ctx = context();
  for ( const type of ["Item", "Actor"] ) {
    const batch = [...pending[type].entries()];
    pending[type].clear();
    if ( !batch.length ) continue;
    for ( const sc of enabled().filter(s => s.type === type) ) {
      const pack = await getPack(sc);
      const del = batch.filter(([id, d]) => (!d || !sc.filter(d, ctx)) && pack.index.has(id)).map(([id]) => id);
      const up = batch.map(([, d]) => d).filter(d => d && sc.filter(d, ctx));
      if ( del.length ) await docClass(sc).deleteDocuments(del, { pack: pack.collection });
      await upsert(pack, sc, up);
      if ( del.length ) await removeEmptyFolders(pack);
    }
  }
}
function scheduleFull() {
  clearTimeout(fullTimer);
  fullTimer = setTimeout(() => syncAll(), 1500);
}

function registerSyncHooks() {
  const worldDoc = d => !d.parent && !d.pack && isSyncUser();
  for ( const type of ["Item", "Actor"] ) {
    const t = type.toLowerCase();
    Hooks.on(`create${type}`, d => { if ( worldDoc(d) ) queue(type, d); });
    Hooks.on(`update${type}`, d => { if ( worldDoc(d) ) queue(type, d); });
    Hooks.on(`delete${type}`, d => { if ( worldDoc(d) ) queue(type, d, true); });
  }
  // Objet intégré d'un acteur d'invocation modifié : recopier l'acteur.
  const embedded = item => {
    const actor = item.parent;
    if ( (actor instanceof Actor) && !actor.pack && isSyncUser()
      && game.packs.get(SUMMON_PACK)?.index.has(actor.id) ) queue("Actor", actor);
  };
  Hooks.on("createItem", embedded);
  Hooks.on("updateItem", embedded);
  Hooks.on("deleteItem", embedded);
  // Un dossier renommé ou déplacé : tout resynchroniser (seuls les éléments concernés sont recopiés).
  Hooks.on("updateFolder", folder => {
    if ( ["Item", "Actor"].includes(folder.type) && !folder.pack && isSyncUser() ) scheduleFull();
  });
}

/* -------------------------------------------- */
/*  3. Masquer les autres sources               */
/* -------------------------------------------- */

async function hideOtherSources() {
  const key = "packSourceConfiguration";
  if ( !game.settings.settings.has(`dnd5e.${key}`) ) return;
  const ours = new Set(SHOWCASES.map(packId));
  const current = foundry.utils.deepClone(game.settings.get("dnd5e", key) ?? {});
  let changed = false;
  for ( const pack of game.packs ) {
    if ( pack.documentName !== "Item" ) continue;
    const want = ours.has(pack.collection);
    if ( current[pack.collection] !== want ) {
      current[pack.collection] = want;
      changed = true;
    }
  }
  for ( const id of ours ) {
    if ( game.packs.get(id) && (current[id] !== true) ) { current[id] = true; changed = true; }
  }
  if ( changed ) {
    await game.settings.set("dnd5e", key, current);
    log("Sources du navigateur de compendiums mises à jour.");
  }
}

/* -------------------------------------------- */
/*  Démarrage                                   */
/* -------------------------------------------- */

Hooks.once("ready", async () => {
  if ( game.settings.get(MOD, "fixReferences") ) fixReferences();
  if ( !isSyncUser() ) return;
  try {
    if ( enabled().length ) {
      registerSyncHooks();
      await syncAll();
    }
    if ( game.settings.get(MOD, "hideSources") ) await hideOtherSources();
  } catch(err) {
    console.error("S-Faerûn VF |", err);
    ui.notifications.error("S-Faerûn VF : erreur pendant la mise à jour des vitrines (voir la console).");
  }
});

// Accès manuel : game.modules.get("s-faerun-vf").api.syncAll()
Hooks.once("init", () => {
  game.modules.get(MOD).api = { syncAll, syncOne, fixReferences, hideOtherSources, showcases: SHOWCASES };
});
