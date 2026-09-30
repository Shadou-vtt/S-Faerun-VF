/**
 * S-Faerûn VF — module maison de Shadou (L'épopée de Faerûn)
 * 1. Références des états et des règles vers le SRD 2024 français (dnd5e.content24)
 *    au lieu des pages anglaises du Manuel des joueurs.
 * 2. Vitrine : copie automatique des options de personnage du monde (classes,
 *    sous-classes, espèces, historiques, dons) dans le compendium du monde
 *    « Options de personnage (VF) », pour le navigateur « Ajouter une classe… ».
 *    Les objets du monde restent la seule version de référence.
 * 3. Masquage, dans le navigateur de compendiums, des autres sources de ces options.
 */

const MOD = "s-faerun-vf";
const PACK_NAME = "options-de-personnage";
const PACK_ID = `world.${PACK_NAME}`;
const PACK_LABEL = "Options de personnage (VF)";
const PHB_PREFIX = "Compendium.dnd-players-handbook.content.";
const SRD_PREFIX = "Compendium.dnd5e.content24.";
const log = (...args) => console.log("S-Faerûn VF |", ...args);

/* -------------------------------------------- */
/*  Réglages                                    */
/* -------------------------------------------- */

Hooks.once("init", () => {
  const reg = (key, name, hint, def = true) => game.settings.register(MOD, key, {
    name, hint, scope: "world", config: true, type: Boolean, default: def,
    requiresReload: true
  });
  reg("fixReferences", "États et règles en français",
    "Les liens automatiques vers les états (À terre, Étourdi…) et les règles pointent vers le SRD 2024 français au lieu du Manuel des joueurs anglais.");
  reg("syncOptions", "Vitrine des options de personnage",
    `Copie automatiquement les classes, sous-classes, espèces, historiques et dons du monde dans le compendium « ${PACK_LABEL} ».`);
  reg("hideSources", "Masquer les autres sources",
    "Dans le navigateur de compendiums, masque les autres compendiums qui proposent des classes, sous-classes, espèces, historiques ou dons.");
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
    const rest = value.slice(PHB_PREFIX.length);          // JournalEntry.<id>.JournalEntryPage.<id>
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
/*  2. Vitrine des options de personnage        */
/* -------------------------------------------- */

const OPTION_TYPES = new Set(["class", "subclass", "race", "background"]);

function isOption(item) {
  if ( !item || item.parent || item.pack ) return false;
  if ( OPTION_TYPES.has(item.type) ) return true;
  return (item.type === "feat") && (item.system?.type?.value === "feat");
}

function isSyncUser() {
  const gm = game.users.activeGM;
  return !!gm && gm.isSelf;
}

async function getPack() {
  let pack = game.packs.get(PACK_ID);
  if ( !pack ) {
    const CC = foundry.documents?.collections?.CompendiumCollection ?? CompendiumCollection;
    pack = await CC.createCompendium({ label: PACK_LABEL, name: PACK_NAME, type: "Item" });
  }
  if ( pack.locked ) await pack.configure({ locked: false });
  return pack;
}

/** Recrée dans le compendium la même arborescence de dossiers que dans le monde. */
async function packFolderFor(pack, worldFolder) {
  if ( !worldFolder ) return null;
  const chain = [];
  for ( let f = worldFolder; f; f = f.folder ) chain.unshift(f);
  let parent = null;
  for ( const wf of chain ) {
    let pf = pack.folders.find(f => (f.name === wf.name) && ((f.folder?.id ?? null) === parent));
    if ( !pf ) {
      [pf] = await Folder.createDocuments([{
        name: wf.name, type: "Item", folder: parent, color: wf.color ?? null, sorting: wf.sorting
      }], { pack: pack.collection });
    }
    parent = pf.id;
  }
  return parent;
}

function stamp(item) {
  return `${item._stats?.modifiedTime ?? 0}|${item.folder?.id ?? ""}`;
}

async function payload(pack, item) {
  const data = item.toObject();
  data.folder = await packFolderFor(pack, item.folder);
  delete data.ownership;
  data.flags ??= {};
  data.flags[MOD] = { source: item.uuid, stamp: stamp(item) };
  return data;
}

/** Remplace la copie (suppression puis recréation avec le même identifiant). */
async function upsert(pack, items) {
  if ( !items.length ) return;
  const ids = items.map(i => i.id).filter(id => pack.index.has(id));
  if ( ids.length ) await Item.deleteDocuments(ids, { pack: pack.collection });
  const datas = [];
  for ( const i of items ) datas.push(await payload(pack, i));
  for ( let k = 0; k < datas.length; k += 50 ) {
    await Item.createDocuments(datas.slice(k, k + 50), { pack: pack.collection, keepId: true });
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

async function syncAll() {
  const pack = await getPack();
  await pack.getIndex({ fields: [`flags.${MOD}.stamp`] });
  const options = game.items.filter(isOption);
  const wanted = new Set(options.map(i => i.id));
  const changed = options.filter(i => pack.index.get(i.id)?.flags?.[MOD]?.stamp !== stamp(i));
  const extra = pack.index.filter(e => !wanted.has(e._id)).map(e => e._id);
  if ( extra.length ) await Item.deleteDocuments(extra, { pack: pack.collection });
  await upsert(pack, changed);
  await removeEmptyFolders(pack);
  log(`Vitrine à jour : ${options.length} options, ${changed.length} copiées, ${extra.length} retirées.`);
  return { total: options.length, updated: changed.length, removed: extra.length };
}

/* Mise à jour immédiate quand un objet du monde change (regroupée par 1 s). */
const pending = new Map();
let timer = null;
function queue(item, remove = false) {
  pending.set(item.id, remove ? null : item);
  clearTimeout(timer);
  timer = setTimeout(flush, 1000);
}
async function flush() {
  const batch = [...pending.entries()];
  pending.clear();
  const pack = await getPack();
  const del = batch.filter(([, i]) => !i || !isOption(i)).map(([id]) => id).filter(id => pack.index.has(id));
  const up = batch.map(([, i]) => i).filter(i => i && isOption(i));
  if ( del.length ) await Item.deleteDocuments(del, { pack: pack.collection });
  await upsert(pack, up);
  if ( del.length ) await removeEmptyFolders(pack);
}

function registerSyncHooks() {
  const watch = item => !item.parent && !item.pack && isSyncUser();
  Hooks.on("createItem", item => { if ( watch(item) && isOption(item) ) queue(item); });
  Hooks.on("updateItem", item => {
    if ( !watch(item) ) return;
    if ( isOption(item) || game.packs.get(PACK_ID)?.index.has(item.id) ) queue(item);
  });
  Hooks.on("deleteItem", item => { if ( watch(item) ) queue(item, true); });
  // Un dossier renommé ou déplacé : on resynchronise tout (seuls les objets concernés sont recopiés).
  Hooks.on("updateFolder", folder => {
    if ( (folder.type === "Item") && !folder.pack && isSyncUser() ) {
      clearTimeout(timer);
      timer = setTimeout(() => syncAll(), 1500);
    }
  });
}

/* -------------------------------------------- */
/*  3. Masquer les autres sources               */
/* -------------------------------------------- */

async function hideOtherSources() {
  const key = "packSourceConfiguration";
  if ( !game.settings.settings.has(`dnd5e.${key}`) ) return;
  const current = foundry.utils.deepClone(game.settings.get("dnd5e", key) ?? {});
  let changed = false;
  for ( const pack of game.packs ) {
    if ( (pack.documentName !== "Item") || (pack.collection === PACK_ID) ) continue;
    await pack.getIndex({ fields: ["system.type.value"] });
    const hasOptions = pack.index.some(e => OPTION_TYPES.has(e.type)
      || ((e.type === "feat") && (e.system?.type?.value === "feat")));
    if ( hasOptions && (current[pack.collection] !== false) ) {
      current[pack.collection] = false;
      changed = true;
    }
  }
  if ( current[PACK_ID] !== true ) { current[PACK_ID] = true; changed = true; }
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
    if ( game.settings.get(MOD, "syncOptions") ) {
      registerSyncHooks();
      await syncAll();
    }
    if ( game.settings.get(MOD, "hideSources") ) await hideOtherSources();
  } catch(err) {
    console.error("S-Faerûn VF |", err);
    ui.notifications.error("S-Faerûn VF : erreur pendant la mise à jour de la vitrine (voir la console).");
  }
});

// Accès manuel : game.modules.get("s-faerun-vf").api.syncAll()
Hooks.once("init", () => {
  game.modules.get(MOD).api = { syncAll, fixReferences, hideOtherSources };
});
