/* ============================================================
   WindTrack — app.js  v2.0.0
   Nouvelles fonctionnalités :
   - Modals de confirmation (saisie + suppression)
   - Catégories personnalisées libres (secteur texte libre)
   - États financiers PDF (jour / semaine / mois / semestre)
   - Sauvegarde automatique configurable
   - Icônes SVG dans toute l'interface (plus d'emojis)
   ============================================================ */

'use strict';

/* ══════════════════════════════════════════════════════════
   1. ÉTAT GLOBAL
══════════════════════════════════════════════════════════ */

let db = null;
let ecranCourant = 'dashboard';
let typeCourant  = 'Entrée';
let periodeActive = 'mois';
let histPeriode   = 'mois';
let histType      = 'all';
let rapportPeriode = 'jour';

/** Raccourcis boostage configurables */
let raccourcisBoostage = [
  { label: 'Contrat 3j',  montant: 5000,  description: 'Contrat Facebook 3 jours' },
  { label: 'Contrat 7j',  montant: 15000, description: 'Contrat Facebook 7 jours' },
  { label: 'Contrat 14j', montant: 28000, description: 'Contrat Facebook 14 jours' },
];

/** Transaction en attente de confirmation (suppression) */
let txASupprimer = null;

/** Données en attente de confirmation (saisie) */
let saisieEnAttente = null;

/** Config sauvegarde automatique */
let backupConfig = { frequence: 'disabled', derniereDate: null };

/* ══════════════════════════════════════════════════════════
   2. INITIALISATION — IndexedDB
══════════════════════════════════════════════════════════ */

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('windtrack_db', 2); // version 2 pour upgrade

    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      const oldVersion = e.oldVersion;

      if (!database.objectStoreNames.contains('categories')) {
        const catStore = database.createObjectStore('categories', {
          keyPath: 'id', autoIncrement: true,
        });
        catStore.createIndex('type',    'type',    { unique: false });
        catStore.createIndex('secteur', 'secteur', { unique: false });
      }

      if (!database.objectStoreNames.contains('transactions')) {
        const txStore = database.createObjectStore('transactions', {
          keyPath: 'id', autoIncrement: true,
        });
        txStore.createIndex('date',        'date',        { unique: false });
        txStore.createIndex('category_id', 'category_id', { unique: false });
      }

      if (!database.objectStoreNames.contains('config')) {
        database.createObjectStore('config', { keyPath: 'cle' });
      }
    };

    request.onsuccess  = (e) => { db = e.target.result; resolve(db); };
    request.onerror    = () => reject(request.error);
  });
}

async function seedCategories() {
  const toutes = await dbGetAll('categories');
  if (toutes.length > 0) return;

  const defaut = [
    { nom: 'Boostage Facebook',     type: 'Entrée', secteur: 'Professionnel', custom: false },
    { nom: 'Graphisme & Conception',type: 'Entrée', secteur: 'Professionnel', custom: false },
    { nom: 'Imprimerie',            type: 'Entrée', secteur: 'Professionnel', custom: false },
    { nom: 'Vente de Licences',     type: 'Entrée', secteur: 'Professionnel', custom: false },
    { nom: 'Connexion Internet',    type: 'Sortie', secteur: 'Professionnel', custom: false },
    { nom: 'Matériel de travail',   type: 'Sortie', secteur: 'Professionnel', custom: false },
    { nom: 'Location espace / Cyber',type:'Sortie', secteur: 'Professionnel', custom: false },
    { nom: 'Formations',            type: 'Sortie', secteur: 'Académique',    custom: false },
    { nom: 'Frais de scolarité',    type: 'Sortie', secteur: 'Académique',    custom: false },
    { nom: 'Carburant',             type: 'Sortie', secteur: 'Personnel',     custom: false },
    { nom: 'Nourriture / Restau',   type: 'Sortie', secteur: 'Personnel',     custom: false },
    { nom: 'Divers quotidien',      type: 'Sortie', secteur: 'Personnel',     custom: false },
  ];

  for (const cat of defaut) await dbAdd('categories', cat);
}

async function chargerConfig() {
  const savedRacc = await dbGet('config', 'raccourcis_boostage');
  if (savedRacc) raccourcisBoostage = savedRacc.valeur;

  const savedTheme = await dbGet('config', 'theme');
  if (savedTheme) appliquerTheme(savedTheme.valeur);

  const savedBackup = await dbGet('config', 'backup_config');
  if (savedBackup) backupConfig = savedBackup.valeur;
}

/* ══════════════════════════════════════════════════════════
   3. HELPERS INDEXEDDB
══════════════════════════════════════════════════════════ */

function dbAdd(store, data) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).add(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function dbPut(store, data) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function dbGet(store, key) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function dbGetAll(store) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function dbDelete(store, key) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

function dbClear(store) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

/* ══════════════════════════════════════════════════════════
   4. NAVIGATION SPA
══════════════════════════════════════════════════════════ */

const TITRES = {
  dashboard:  'Tableau de bord',
  saisie:     'Nouveau flux',
  historique: 'Historique',
  graphiques: 'Graphiques',
  rapports:   'États financiers',
  parametres: 'Paramètres',
};

/* Index de nav du bas (dashboard=0, historique=1, [FAB=2], rapports=3, parametres=4) */
const NAV_INDEX = { dashboard: 0, historique: 1, rapports: 3, parametres: 4 };

function navigateTo(ecran) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(`screen-${ecran}`);
  if (!el) return;
  el.classList.add('active');
  ecranCourant = ecran;

  document.getElementById('header-title').textContent = TITRES[ecran] || '';

  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  if (NAV_INDEX[ecran] !== undefined) {
    document.querySelectorAll('.nav-btn')[NAV_INDEX[ecran]]?.classList.add('active');
  }

  el.scrollTop = 0;

  switch (ecran) {
    case 'dashboard':  rafraichirDashboard();  break;
    case 'saisie':     initSaisie();            break;
    case 'historique': rafraichirHistorique();  break;
    case 'graphiques': rafraichirGraphiques();  break;
    case 'rapports':   initRapports();          break;
    case 'parametres': initParametres();        break;
  }
}

/* ══════════════════════════════════════════════════════════
   5. SIDEBAR
══════════════════════════════════════════════════════════ */

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

/* ══════════════════════════════════════════════════════════
   6. THÈME JOUR / NUIT
══════════════════════════════════════════════════════════ */

function appliquerTheme(theme) {
  const sun  = document.getElementById('theme-icon-sun');
  const moon = document.getElementById('theme-icon-moon');
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    sun.style.display  = 'block';
    moon.style.display = 'none';
  } else {
    document.documentElement.classList.remove('dark');
    sun.style.display  = 'none';
    moon.style.display = 'block';
  }
}

async function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  const newTheme = isDark ? 'light' : 'dark';
  appliquerTheme(newTheme);
  await dbPut('config', { cle: 'theme', valeur: newTheme });
}

/* ══════════════════════════════════════════════════════════
   7. FORMATAGE
══════════════════════════════════════════════════════════ */

function fCFA(n) {
  if (!n && n !== 0) return '—';
  return Number(n).toLocaleString('fr-FR') + ' F';
}

function fDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function fDateLong(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function dateAujourdhui() {
  return new Date().toISOString().slice(0, 10);
}

/* ══════════════════════════════════════════════════════════
   8. FILTRAGE PAR PÉRIODE
══════════════════════════════════════════════════════════ */

function getPlageDates(periode) {
  const auj = new Date();
  let debut, fin;

  switch (periode) {
    case 'aujourd_hui':
    case 'jour':
      debut = dateAujourdhui();
      fin   = dateAujourdhui();
      break;
    case 'semaine': {
      const jourSemaine = auj.getDay() || 7;
      const lundi = new Date(auj);
      lundi.setDate(auj.getDate() - jourSemaine + 1);
      debut = lundi.toISOString().slice(0, 10);
      fin   = dateAujourdhui();
      break;
    }
    case 'mois':
      debut = `${auj.getFullYear()}-${String(auj.getMonth() + 1).padStart(2, '0')}-01`;
      fin   = dateAujourdhui();
      break;
    case 'semestre': {
      const d6 = new Date(auj);
      d6.setMonth(d6.getMonth() - 5);
      d6.setDate(1);
      debut = d6.toISOString().slice(0, 10);
      fin   = dateAujourdhui();
      break;
    }
    case 'tout':
    default:
      debut = '2000-01-01';
      fin   = '2099-12-31';
      break;
  }
  return { debut, fin };
}

function filtrerParPeriode(transactions, periode) {
  const { debut, fin } = getPlageDates(periode);
  return transactions.filter(tx => tx.date >= debut && tx.date <= fin);
}

/* ══════════════════════════════════════════════════════════
   9. DASHBOARD
══════════════════════════════════════════════════════════ */

function setPeriod(periode, btn) {
  periodeActive = periode;
  document.querySelectorAll('[data-period]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  rafraichirDashboard();
}

async function rafraichirDashboard() {
  const [toutes, categories] = await Promise.all([
    dbGetAll('transactions'),
    dbGetAll('categories'),
  ]);

  const txPeriode = filtrerParPeriode(toutes, periodeActive);

  const entrees = txPeriode.filter(t => {
    const cat = categories.find(c => c.id === t.category_id);
    return cat?.type === 'Entrée';
  }).reduce((s, t) => s + t.montant, 0);

  const sorties = txPeriode.filter(t => {
    const cat = categories.find(c => c.id === t.category_id);
    return cat?.type === 'Sortie';
  }).reduce((s, t) => s + t.montant, 0);

  const solde = entrees - sorties;

  const soldeCard = document.getElementById('solde-card');
  const soldeVal  = document.getElementById('solde-value');
  soldeVal.textContent = (solde >= 0 ? '+' : '') + fCFA(solde);
  soldeCard.classList.toggle('negative', solde < 0);

  const moisPrecedent  = getMoisPrecedent();
  const txMoisPrec     = toutes.filter(tx => tx.date >= moisPrecedent.debut && tx.date <= moisPrecedent.fin);
  const soldePrecedent = calculerSolde(txMoisPrec, categories);
  afficherTendance(solde, soldePrecedent);

  document.getElementById('total-entrees').textContent = fCFA(entrees);
  document.getElementById('total-sorties').textContent = fCFA(sorties);

  /* Répartition dépenses par secteur */
  const txSorties = txPeriode.filter(t => {
    const cat = categories.find(c => c.id === t.category_id);
    return cat?.type === 'Sortie';
  });

  /* Calcul dynamique des secteurs présents */
  const parSecteur = {};
  txSorties.forEach(t => {
    const cat = categories.find(c => c.id === t.category_id);
    if (cat?.secteur) {
      parSecteur[cat.secteur] = (parSecteur[cat.secteur] || 0) + t.montant;
    }
  });

  const totalSorties2 = Object.values(parSecteur).reduce((s, v) => s + v, 0) || 1;
  const pctPro   = Math.round(((parSecteur['Professionnel'] || 0) / totalSorties2) * 100);
  const pctPerso = Math.round(((parSecteur['Personnel']     || 0) / totalSorties2) * 100);
  const pctAcad  = Math.round(((parSecteur['Académique']    || 0) / totalSorties2) * 100);

  document.getElementById('pct-pro').textContent  = pctPro   + '%';
  document.getElementById('pct-perso').textContent = pctPerso + '%';
  document.getElementById('pct-acad').textContent  = pctAcad  + '%';
  document.getElementById('bar-pro').style.width   = pctPro   + '%';
  document.getElementById('bar-perso').style.width = pctPerso + '%';
  document.getElementById('bar-acad').style.width  = pctAcad  + '%';

  /* Bilan par secteur (tous les secteurs présents) */
  const tousSecteursSet = new Set(categories.map(c => c.secteur).filter(Boolean));
  let bilanHTML = '';

  for (const sect of tousSecteursSet) {
    const entreesSect = txPeriode.filter(t => {
      const cat = categories.find(c => c.id === t.category_id);
      return cat?.type === 'Entrée' && cat?.secteur === sect;
    }).reduce((s, t) => s + t.montant, 0);

    const sortiesSect = txPeriode.filter(t => {
      const cat = categories.find(c => c.id === t.category_id);
      return cat?.type === 'Sortie' && cat?.secteur === sect;
    }).reduce((s, t) => s + t.montant, 0);

    const soldeSect = entreesSect - sortiesSect;
    const couleur = soldeSect >= 0
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-500 dark:text-red-400';

    bilanHTML += `
      <div class="flex items-center justify-between py-1.5">
        <span class="text-sm text-gray-600 dark:text-gray-300">${sect}</span>
        <span class="montant text-sm font-semibold ${couleur}">${soldeSect >= 0 ? '+' : ''}${fCFA(soldeSect)}</span>
      </div>`;
  }
  document.getElementById('bilan-secteurs').innerHTML = bilanHTML ||
    '<p class="text-sm text-gray-400">Aucune donnée.</p>';

  /* Transactions récentes */
  const recentes = [...txPeriode].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const recentesEl = document.getElementById('recentes-list');

  if (!recentes.length) {
    recentesEl.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">Aucune transaction pour cette période.</p>';
    return;
  }

  recentesEl.innerHTML = recentes.map(tx => {
    const cat     = categories.find(c => c.id === tx.category_id);
    const isE     = cat?.type === 'Entrée';
    const couleur = isE ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400';
    const signe   = isE ? '+' : '−';
    return `
      <div class="tx-row">
        <div class="cat-badge" style="background:${isE ? '#DCFCE7' : '#FEE2E2'}">
          ${isE
            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15803D" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>'
            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>'
          }
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">${cat?.nom || '—'}</p>
          ${tx.description ? `<p class="text-xs text-gray-400 truncate">${tx.description}</p>` : ''}
        </div>
        <div class="text-right flex-shrink-0">
          <p class="montant text-sm font-bold ${couleur}">${signe}${fCFA(tx.montant)}</p>
          <p class="text-xs text-gray-400">${fDate(tx.date)}</p>
        </div>
      </div>`;
  }).join('');
}

function getMoisPrecedent() {
  const auj = new Date();
  const mp  = new Date(auj.getFullYear(), auj.getMonth() - 1, 1);
  const dj  = new Date(auj.getFullYear(), auj.getMonth(), 0);
  return { debut: mp.toISOString().slice(0, 10), fin: dj.toISOString().slice(0, 10) };
}

function calculerSolde(transactions, categories) {
  return transactions.reduce((s, tx) => {
    const cat = categories.find(c => c.id === tx.category_id);
    return s + (cat?.type === 'Entrée' ? tx.montant : -tx.montant);
  }, 0);
}

function afficherTendance(soldeCourant, soldePrecedent) {
  const tendanceIcon = document.getElementById('tendance-icon');
  const tendanceText = document.getElementById('tendance-text');

  if (soldePrecedent === 0) {
    tendanceIcon.textContent = '—';
    tendanceText.textContent = 'vs mois précédent';
    return;
  }

  const diff = soldeCourant - soldePrecedent;
  const pct  = Math.abs(Math.round((diff / Math.abs(soldePrecedent)) * 100));

  if (diff > 0)      { tendanceIcon.textContent = '↑ +' + pct + '%'; }
  else if (diff < 0) { tendanceIcon.textContent = '↓ −' + pct + '%'; }
  else               { tendanceIcon.textContent = '→ stable'; }
  tendanceText.textContent = 'vs mois précédent';
}

/* ══════════════════════════════════════════════════════════
   10. FORMULAIRE DE SAISIE
══════════════════════════════════════════════════════════ */

async function initSaisie() {
  document.getElementById('input-montant').value     = '';
  document.getElementById('input-description').value = '';
  document.getElementById('input-date').value        = dateAujourdhui();
  setType('Entrée');
  await chargerCategories();
}

function setType(type) {
  typeCourant = type;
  document.getElementById('btn-entree').className = type === 'Entrée' ? 'type-btn active-entree' : 'type-btn';
  document.getElementById('btn-sortie').className = type === 'Sortie' ? 'type-btn active-sortie' : 'type-btn';
  chargerCategories();
}

async function chargerCategories() {
  const categories = await dbGetAll('categories');
  const filtrees   = categories.filter(c => c.type === typeCourant);
  const select     = document.getElementById('input-categorie');

  select.innerHTML = '<option value="">Sélectionner une catégorie…</option>' +
    filtrees.map(c => `<option value="${c.id}">${c.nom} (${c.secteur})</option>`).join('');

  document.getElementById('raccourcis-boostage').classList.add('hidden');
}

function onCategorieChange() {
  const select = document.getElementById('input-categorie');
  const texte  = select.options[select.selectedIndex]?.text || '';
  if (texte.includes('Boostage Facebook')) {
    afficherRaccourcis();
  } else {
    document.getElementById('raccourcis-boostage').classList.add('hidden');
  }
}

function afficherRaccourcis() {
  const container = document.getElementById('raccourcis-boostage');
  document.getElementById('raccourcis-list').innerHTML = raccourcisBoostage.map((r, i) => `
    <button class="raccourci-btn" onclick="appliquerRaccourci(${i})">
      ${r.label} — ${fCFA(r.montant)}
    </button>
  `).join('');
  container.classList.remove('hidden');
}

function appliquerRaccourci(index) {
  const r = raccourcisBoostage[index];
  if (!r) return;
  document.getElementById('input-montant').value     = r.montant;
  document.getElementById('input-description').value = r.description;
}

function onMontantChange() { /* hook disponible */ }

/* ── Confirmation avant enregistrement ── */

async function demanderConfirmationSaisie() {
  const montant     = parseFloat(document.getElementById('input-montant').value);
  const catId       = parseInt(document.getElementById('input-categorie').value);
  const description = document.getElementById('input-description').value.trim();
  const date        = document.getElementById('input-date').value;

  if (!montant || montant <= 0) { showToast('Saisis un montant valide', 'error'); return; }
  if (!catId)                   { showToast('Sélectionne une catégorie', 'error'); return; }
  if (!date)                    { showToast('Sélectionne une date', 'error'); return; }

  const categories = await dbGetAll('categories');
  const cat = categories.find(c => c.id === catId);

  saisieEnAttente = { montant, catId, description, date };

  const isE = typeCourant === 'Entrée';
  document.getElementById('confirm-details').innerHTML = `
    <div class="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-700">
      <span class="text-gray-500 dark:text-gray-400">Type</span>
      <span class="font-semibold ${isE ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}">${typeCourant}</span>
    </div>
    <div class="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-700">
      <span class="text-gray-500 dark:text-gray-400">Montant</span>
      <span class="montant font-bold text-gray-800 dark:text-white text-base">${fCFA(montant)}</span>
    </div>
    <div class="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-700">
      <span class="text-gray-500 dark:text-gray-400">Catégorie</span>
      <span class="font-medium text-gray-700 dark:text-gray-200">${cat?.nom || '—'}</span>
    </div>
    <div class="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-700">
      <span class="text-gray-500 dark:text-gray-400">Secteur</span>
      <span class="font-medium text-gray-700 dark:text-gray-200">${cat?.secteur || '—'}</span>
    </div>
    <div class="flex justify-between py-1">
      <span class="text-gray-500 dark:text-gray-400">Date</span>
      <span class="font-medium text-gray-700 dark:text-gray-200">${fDateLong(date)}</span>
    </div>
    ${description ? `
    <div class="pt-2 text-xs text-gray-400 italic">"${description}"</div>` : ''}
  `;

  ouvrirModal('modal-confirm-saisie');
}

function fermerModalSaisie() {
  fermerModal('modal-confirm-saisie');
  saisieEnAttente = null;
}

async function confirmerEnregistrement() {
  if (!saisieEnAttente) return;
  fermerModal('modal-confirm-saisie');

  try {
    await dbAdd('transactions', {
      montant:     saisieEnAttente.montant,
      category_id: saisieEnAttente.catId,
      description: saisieEnAttente.description || null,
      date:        saisieEnAttente.date,
      createdAt:   new Date().toISOString(),
    });

    saisieEnAttente = null;
    showToast('Transaction enregistrée', 'success');
    document.getElementById('input-montant').value     = '';
    document.getElementById('input-description').value = '';
    document.getElementById('raccourcis-boostage').classList.add('hidden');
    setTimeout(() => navigateTo('dashboard'), 600);
  } catch (err) {
    console.error('[WindTrack] Erreur enregistrement :', err);
    showToast('Erreur lors de l\'enregistrement', 'error');
  }
}

/* ══════════════════════════════════════════════════════════
   11. HISTORIQUE
══════════════════════════════════════════════════════════ */

function setHistPeriod(periode, btn) {
  histPeriode = periode;
  document.querySelectorAll('[data-period-hist]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  rafraichirHistorique();
}

function setHistType(type, btn) {
  histType = type;
  document.querySelectorAll('[data-type-hist]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  rafraichirHistorique();
}

async function rafraichirHistorique() {
  const [toutes, categories] = await Promise.all([
    dbGetAll('transactions'),
    dbGetAll('categories'),
  ]);

  let filtrees = filtrerParPeriode(toutes, histPeriode);
  if (histType !== 'all') {
    filtrees = filtrees.filter(tx => {
      const cat = categories.find(c => c.id === tx.category_id);
      return cat?.type === histType;
    });
  }
  filtrees.sort((a, b) => b.date.localeCompare(a.date));

  const container = document.getElementById('historique-list');

  if (!filtrees.length) {
    container.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">Aucune transaction pour cette période.</p>';
    return;
  }

  container.innerHTML = filtrees.map(tx => {
    const cat  = categories.find(c => c.id === tx.category_id);
    const isE  = cat?.type === 'Entrée';
    const c    = isE ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400';
    const sgn  = isE ? '+' : '−';
    return `
      <div class="tx-row" id="tx-${tx.id}">
        <div class="cat-badge" style="background:${isE ? '#DCFCE7' : '#FEE2E2'}">
          ${isE
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803D" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>'
          }
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">${cat?.nom || '—'}</p>
          ${tx.description ? `<p class="text-xs text-gray-400 truncate">${tx.description}</p>` : ''}
          <p class="text-xs text-gray-400">${fDate(tx.date)}</p>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <p class="montant text-sm font-bold ${c}">${sgn}${fCFA(tx.montant)}</p>
          <button class="delete-btn" onclick="demanderSuppressionTx(${tx.id})" title="Supprimer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
          </button>
        </div>
      </div>`;
  }).join('');

  /* Long press pour révéler le bouton supprimer */
  container.querySelectorAll('.tx-row').forEach(row => {
    let timer;
    row.addEventListener('touchstart', () => {
      timer = setTimeout(() => {
        container.querySelectorAll('.tx-row').forEach(r => r.classList.remove('reveal'));
        row.classList.add('reveal');
      }, 500);
    }, { passive: true });
    row.addEventListener('touchend', () => clearTimeout(timer));
    row.addEventListener('touchmove', () => clearTimeout(timer), { passive: true });
  });
}

async function demanderSuppressionTx(id) {
  const [toutes, categories] = await Promise.all([
    dbGetAll('transactions'),
    dbGetAll('categories'),
  ]);
  const tx  = toutes.find(t => t.id === id);
  const cat = categories.find(c => c.id === tx?.category_id);

  txASupprimer = id;

  document.getElementById('delete-details').innerHTML = tx ? `
    <div class="flex justify-between mb-2">
      <span class="text-gray-500 dark:text-gray-400">Catégorie</span>
      <span class="font-semibold text-gray-800 dark:text-white">${cat?.nom || '—'}</span>
    </div>
    <div class="flex justify-between mb-2">
      <span class="text-gray-500 dark:text-gray-400">Montant</span>
      <span class="montant font-bold text-red-600 dark:text-red-400">${fCFA(tx.montant)}</span>
    </div>
    <div class="flex justify-between">
      <span class="text-gray-500 dark:text-gray-400">Date</span>
      <span class="font-medium text-gray-700 dark:text-gray-200">${fDateLong(tx.date)}</span>
    </div>
  ` : '<p class="text-gray-400">Transaction introuvable.</p>';

  ouvrirModal('modal-confirm-suppression');
}

function fermerModalSuppression() {
  fermerModal('modal-confirm-suppression');
  txASupprimer = null;
}

async function confirmerSuppression() {
  if (!txASupprimer) return;
  const id = txASupprimer;
  fermerModal('modal-confirm-suppression');
  txASupprimer = null;
  await dbDelete('transactions', id);
  showToast('Transaction supprimée', 'info');
  rafraichirHistorique();
}

/* ══════════════════════════════════════════════════════════
   12. GRAPHIQUES
══════════════════════════════════════════════════════════ */

async function rafraichirGraphiques() {
  const [toutes, categories] = await Promise.all([
    dbGetAll('transactions'),
    dbGetAll('categories'),
  ]);
  dessinerGraphique6Mois(toutes, categories);
  afficherStats(toutes, categories);
  afficherTopCategories(toutes, categories);
}

function dessinerGraphique6Mois(transactions, categories) {
  const mois6 = derniers6Mois();
  const container = document.getElementById('chart-container');
  const W = container.clientWidth || 300;
  const H = 160;
  const PAD = { top: 10, right: 10, bottom: 30, left: 40 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const nbMois = mois6.length;
  const largeurGroupe = innerW / nbMois;
  const largeurBarre  = (largeurGroupe - 12) / 2;

  const valeurs = mois6.map(m => {
    const txMois = transactions.filter(tx => tx.date.startsWith(m.key));
    const ent = txMois.filter(tx => categories.find(c=>c.id===tx.category_id)?.type==='Entrée').reduce((s,t)=>s+t.montant,0);
    const sor = txMois.filter(tx => categories.find(c=>c.id===tx.category_id)?.type==='Sortie').reduce((s,t)=>s+t.montant,0);
    return { ent, sor, label: m.label };
  });

  const maxVal = Math.max(...valeurs.flatMap(v => [v.ent, v.sor]), 1);

  let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;

  [0, 0.25, 0.5, 0.75, 1].forEach(pct => {
    const y = PAD.top + innerH * (1 - pct);
    const label = pct === 0 ? '' : formatMontantCourt(maxVal * pct);
    svg += `<line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}" stroke="#E7E5E4" stroke-width="1" stroke-dasharray="3,3"/>`;
    if (label) svg += `<text x="${PAD.left - 4}" y="${y + 4}" text-anchor="end" font-size="9" fill="#9CA3AF" font-family="DM Mono, monospace">${label}</text>`;
  });

  valeurs.forEach((v, i) => {
    const xGroupe = PAD.left + i * largeurGroupe + 6;
    const hEnt = Math.max((v.ent / maxVal) * innerH, v.ent > 0 ? 3 : 0);
    const hSor = Math.max((v.sor / maxVal) * innerH, v.sor > 0 ? 3 : 0);
    const yEnt = PAD.top + innerH - hEnt;
    const ySor = PAD.top + innerH - hSor;

    if (v.ent > 0) svg += `<rect x="${xGroupe}" y="${yEnt}" width="${largeurBarre}" height="${hEnt}" rx="3" fill="#22C55E" opacity="0.85"/>`;
    if (v.sor > 0) svg += `<rect x="${xGroupe + largeurBarre + 4}" y="${ySor}" width="${largeurBarre}" height="${hSor}" rx="3" fill="#EF4444" opacity="0.75"/>`;

    const xLabel = xGroupe + largeurGroupe / 2 - 6;
    svg += `<text x="${xLabel}" y="${H - 6}" text-anchor="middle" font-size="9" fill="#9CA3AF" font-family="Inter, sans-serif">${v.label}</text>`;
  });

  svg += '</svg>';
  container.innerHTML = svg;
}

function derniers6Mois() {
  const mois = [];
  const now  = new Date();
  for (let i = 5; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = d.toLocaleDateString('fr-FR', { month: 'short' });
    mois.push({ key, label });
  }
  return mois;
}

function formatMontantCourt(n) {
  if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n/1000).toFixed(0) + 'k';
  return String(Math.round(n));
}

function afficherStats(transactions, categories) {
  const mois6 = derniers6Mois();
  const caParMois = mois6.map(m => {
    const txMois = transactions.filter(tx => tx.date.startsWith(m.key));
    return txMois.filter(tx => categories.find(c=>c.id===tx.category_id)?.type==='Entrée').reduce((s,t)=>s+t.montant,0);
  });
  const meilleurIdx  = caParMois.indexOf(Math.max(...caParMois));
  const moyMois      = caParMois.reduce((s,v)=>s+v,0) / 6;
  const totalEntrees = transactions.filter(tx => categories.find(c=>c.id===tx.category_id)?.type==='Entrée').reduce((s,t)=>s+t.montant,0);
  const totalSorties = transactions.filter(tx => categories.find(c=>c.id===tx.category_id)?.type==='Sortie').reduce((s,t)=>s+t.montant,0);

  const statsItems = [
    { label: 'Meilleur mois',    val: mois6[meilleurIdx]?.label || '—' },
    { label: 'Revenu ce mois',   val: fCFA(caParMois[meilleurIdx] || 0) },
    { label: 'Moy. mensuelle',   val: fCFA(Math.round(moyMois)) },
    { label: 'Nb. transactions', val: transactions.length },
    { label: 'Total entrées',    val: fCFA(totalEntrees) },
    { label: 'Total sorties',    val: fCFA(totalSorties) },
  ];

  document.getElementById('stats-grid').innerHTML = statsItems.map(s => `
    <div class="bg-beige-50 dark:bg-zinc-800 rounded-xl p-3">
      <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">${s.label}</p>
      <p class="montant text-sm font-bold text-gray-800 dark:text-white">${s.val}</p>
    </div>
  `).join('');
}

function afficherTopCategories(transactions, categories) {
  const entrees = transactions.filter(tx => categories.find(c=>c.id===tx.category_id)?.type==='Entrée');
  const parCat  = {};
  entrees.forEach(tx => { parCat[tx.category_id] = (parCat[tx.category_id] || 0) + tx.montant; });
  const top    = Object.entries(parCat).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const maxVal = top[0]?.[1] || 1;

  const container = document.getElementById('top-categories');
  if (!top.length) { container.innerHTML = '<p class="text-sm text-gray-400">Aucune entrée enregistrée.</p>'; return; }

  container.innerHTML = top.map(([catId, total]) => {
    const cat = categories.find(c=>c.id===Number(catId));
    const pct = Math.round((total/maxVal)*100);
    return `
      <div>
        <div class="flex justify-between text-xs text-gray-600 dark:text-gray-300 mb-1.5">
          <span>${cat?.nom || '—'}</span>
          <span class="montant font-semibold">${fCFA(total)}</span>
        </div>
        <div class="progress-bar"><div class="progress-fill bg-indigo-500" style="width:${pct}%"></div></div>
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════════
   13. ÉTATS FINANCIERS — EXPORT PDF
══════════════════════════════════════════════════════════ */

function selectRapportPeriode(periode, btn) {
  rapportPeriode = periode;
  document.querySelectorAll('.export-option').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  mettreAJourApercuRapport();
}

async function mettreAJourApercuRapport() {
  const [toutes, categories] = await Promise.all([
    dbGetAll('transactions'),
    dbGetAll('categories'),
  ]);

  const tx     = filtrerParPeriode(toutes, rapportPeriode);
  const entrees = tx.filter(t => categories.find(c=>c.id===t.category_id)?.type==='Entrée').reduce((s,t)=>s+t.montant,0);
  const sorties = tx.filter(t => categories.find(c=>c.id===t.category_id)?.type==='Sortie').reduce((s,t)=>s+t.montant,0);
  const solde   = entrees - sorties;
  const { debut, fin } = getPlageDates(rapportPeriode);

  document.getElementById('rapport-apercu').innerHTML = `
    <div class="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-700">
      <span class="text-gray-400 text-xs">Période</span>
      <span class="text-xs font-medium text-gray-700 dark:text-gray-200">${fDateLong(debut)} → ${fDateLong(fin)}</span>
    </div>
    <div class="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-700">
      <span class="text-gray-400 text-xs">Transactions</span>
      <span class="text-xs font-semibold text-gray-800 dark:text-white">${tx.length}</span>
    </div>
    <div class="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-700">
      <span class="text-gray-400 text-xs">Total entrées</span>
      <span class="montant text-xs font-bold text-green-600">${fCFA(entrees)}</span>
    </div>
    <div class="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-700">
      <span class="text-gray-400 text-xs">Total sorties</span>
      <span class="montant text-xs font-bold text-red-500">${fCFA(sorties)}</span>
    </div>
    <div class="flex justify-between py-1">
      <span class="text-gray-400 text-xs font-semibold">Solde net</span>
      <span class="montant text-xs font-bold ${solde >= 0 ? 'text-indigo-600' : 'text-red-600'}">${solde >= 0 ? '+' : ''}${fCFA(solde)}</span>
    </div>
  `;
}

function initRapports() {
  rapportPeriode = 'jour';
  document.querySelectorAll('.export-option').forEach(b => b.classList.remove('selected'));
  document.getElementById('rpt-opt-jour')?.classList.add('selected');
  mettreAJourApercuRapport();
}

async function genererPDF() {
  const [toutes, categories] = await Promise.all([
    dbGetAll('transactions'),
    dbGetAll('categories'),
  ]);

  const tx      = filtrerParPeriode(toutes, rapportPeriode);
  const entrees = tx.filter(t => categories.find(c=>c.id===t.category_id)?.type==='Entrée').reduce((s,t)=>s+t.montant,0);
  const sorties = tx.filter(t => categories.find(c=>c.id===t.category_id)?.type==='Sortie').reduce((s,t)=>s+t.montant,0);
  const solde   = entrees - sorties;
  const { debut, fin } = getPlageDates(rapportPeriode);

  const periodeLabel = {
    jour:     'Journalier',
    semaine:  'Hebdomadaire',
    mois:     'Mensuel',
    semestre: 'Semestriel',
  }[rapportPeriode] || 'Personnalisé';

  /* Répartition par secteur */
  const parSecteur = {};
  tx.forEach(t => {
    const cat = categories.find(c=>c.id===t.category_id);
    if (!cat) return;
    const k = cat.secteur || 'Autre';
    if (!parSecteur[k]) parSecteur[k] = { entrees: 0, sorties: 0 };
    if (cat.type === 'Entrée') parSecteur[k].entrees += t.montant;
    else parSecteur[k].sorties += t.montant;
  });

  /* Lignes de transactions */
  const lignesTx = tx
    .sort((a,b) => b.date.localeCompare(a.date))
    .map(t => {
      const cat = categories.find(c=>c.id===t.category_id);
      const isE = cat?.type === 'Entrée';
      return `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #f0ede6;font-size:12px;">${fDateLong(t.date)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f0ede6;font-size:12px;">${cat?.nom || '—'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f0ede6;font-size:12px;color:#6b7280;">${cat?.secteur || '—'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f0ede6;font-size:12px;text-align:right;font-weight:600;color:${isE ? '#15803d' : '#b91c1c'};">
          ${isE ? '+' : '−'}${fCFA(t.montant)}
        </td>
        <td style="padding:6px 10px;border-bottom:1px solid #f0ede6;font-size:11px;color:#9ca3af;">${t.description || ''}</td>
      </tr>`;
    }).join('');

  const secteurRows = Object.entries(parSecteur).map(([sect, data]) => `
    <tr>
      <td style="padding:5px 10px;font-size:12px;">${sect}</td>
      <td style="padding:5px 10px;font-size:12px;font-weight:600;color:#15803d;text-align:right;">+${fCFA(data.entrees)}</td>
      <td style="padding:5px 10px;font-size:12px;font-weight:600;color:#b91c1c;text-align:right;">−${fCFA(data.sorties)}</td>
      <td style="padding:5px 10px;font-size:12px;font-weight:700;text-align:right;color:${data.entrees - data.sorties >= 0 ? '#2c44a8' : '#b91c1c'};">
        ${data.entrees - data.sorties >= 0 ? '+' : ''}${fCFA(data.entrees - data.sorties)}
      </td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>WindTrack — État ${periodeLabel}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #fdfbf7; color: #1c1917; font-size: 13px; }
  .page { max-width: 800px; margin: 0 auto; padding: 40px 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #3b5bdb; padding-bottom: 16px; margin-bottom: 28px; }
  .brand { font-weight: 800; font-size: 22px; color: #3b5bdb; letter-spacing: -0.5px; }
  .brand span { font-size: 11px; font-weight: 400; color: #9ca3af; display: block; letter-spacing: 0; }
  .report-title { text-align: right; }
  .report-title h1 { font-size: 16px; font-weight: 700; color: #1c1917; }
  .report-title p  { font-size: 11px; color: #9ca3af; margin-top: 3px; }
  .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 28px; }
  .summary-card { background: #fff; border-radius: 12px; padding: 14px 16px; border: 1px solid #e7e5e4; }
  .summary-card .label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .summary-card .value { font-size: 18px; font-weight: 700; font-family: 'Courier New', monospace; }
  .value.green  { color: #15803d; }
  .value.red    { color: #b91c1c; }
  .value.blue   { color: #2c44a8; }
  section { margin-bottom: 28px; }
  section h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #e7e5e4; }
  table { width: 100%; border-collapse: collapse; }
  thead th { font-size: 11px; text-align: left; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; padding: 6px 10px; background: #f9f7f4; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e7e5e4; display: flex; justify-content: space-between; font-size: 10px; color: #d4d4d4; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="brand">WindTrack<span>Gestion financière personnelle</span></div>
    <div class="report-title">
      <h1>État financier — ${periodeLabel}</h1>
      <p>Du ${fDateLong(debut)} au ${fDateLong(fin)}</p>
      <p>Généré le ${fDateLong(dateAujourdhui())}</p>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="label">Total Entrées</div>
      <div class="value green">+${fCFA(entrees)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Total Sorties</div>
      <div class="value red">−${fCFA(sorties)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Solde Net</div>
      <div class="value ${solde >= 0 ? 'blue' : 'red'}">${solde >= 0 ? '+' : ''}${fCFA(solde)}</div>
    </div>
  </div>

  <section>
    <h2>Bilan par secteur</h2>
    <table>
      <thead><tr>
        <th>Secteur</th><th style="text-align:right">Entrées</th>
        <th style="text-align:right">Sorties</th><th style="text-align:right">Solde</th>
      </tr></thead>
      <tbody>${secteurRows}</tbody>
    </table>
  </section>

  <section>
    <h2>Détail des transactions (${tx.length})</h2>
    <table>
      <thead><tr>
        <th>Date</th><th>Catégorie</th><th>Secteur</th>
        <th style="text-align:right">Montant</th><th>Description</th>
      </tr></thead>
      <tbody>${lignesTx || '<tr><td colspan="5" style="padding:16px 10px;text-align:center;color:#9ca3af;">Aucune transaction pour cette période.</td></tr>'}</tbody>
    </table>
  </section>

  <div class="footer">
    <span>WindTrack v2.0.0 · 100% Hors-ligne</span>
    <span>État ${periodeLabel} · ${fDateLong(dateAujourdhui())}</span>
  </div>
</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `windtrack_etat_${rapportPeriode}_${dateAujourdhui()}.html`;
  a.click();
  URL.revokeObjectURL(url);

  showToast('État financier téléchargé', 'success');
}

/* ══════════════════════════════════════════════════════════
   14. PARAMÈTRES
══════════════════════════════════════════════════════════ */

function initParametres() {
  afficherConfigRaccourcis();
  afficherCategoriesCustom();
  afficherConfigBackup();
}

function afficherConfigRaccourcis() {
  document.getElementById('raccourcis-config').innerHTML = raccourcisBoostage.map((r, i) => `
    <div class="space-y-1.5 p-3 bg-beige-50 dark:bg-zinc-800 rounded-xl">
      <p class="text-xs font-semibold text-gray-500 dark:text-gray-400">Raccourci ${i+1}</p>
      <div class="grid grid-cols-2 gap-2">
        <input type="text" value="${r.label}" placeholder="Nom" class="wt-input text-sm" id="racc-label-${i}" />
        <input type="number" value="${r.montant}" placeholder="Montant" class="wt-input montant text-sm" id="racc-montant-${i}" />
      </div>
      <input type="text" value="${r.description}" placeholder="Description pré-remplie" class="wt-input text-sm" id="racc-desc-${i}" />
    </div>
  `).join('');
}

async function sauvegarderRaccourcis() {
  raccourcisBoostage = raccourcisBoostage.map((_, i) => ({
    label:       document.getElementById(`racc-label-${i}`)?.value   || '',
    montant:     parseFloat(document.getElementById(`racc-montant-${i}`)?.value) || 0,
    description: document.getElementById(`racc-desc-${i}`)?.value    || '',
  }));
  await dbPut('config', { cle: 'raccourcis_boostage', valeur: raccourcisBoostage });
  showToast('Raccourcis sauvegardés', 'success');
}

async function afficherCategoriesCustom() {
  const categories = await dbGetAll('categories');
  const custom     = categories.filter(c => c.custom === true);
  const container  = document.getElementById('custom-categories-list');

  if (!custom.length) {
    container.innerHTML = '<p class="text-xs text-gray-400">Aucune catégorie personnalisée.</p>';
    return;
  }

  container.innerHTML = custom.map(c => `
    <div class="flex items-center justify-between p-2 bg-beige-50 dark:bg-zinc-800 rounded-lg">
      <div class="min-w-0">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">${c.nom}</span>
        <span class="text-xs text-gray-400 ml-1">(${c.type} · ${c.secteur})</span>
      </div>
      <button onclick="demanderSuppressionCategorie(${c.id})" class="text-red-400 text-sm active:scale-95 px-2 ml-2 flex-shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `).join('');
}

async function ajouterCategorie() {
  const nom     = document.getElementById('new-cat-nom').value.trim();
  const type    = document.getElementById('new-cat-type').value;
  const secteur = document.getElementById('new-cat-secteur').value.trim() || 'Autre';

  if (!nom) { showToast('Saisis un nom de catégorie', 'error'); return; }

  await dbAdd('categories', { nom, type, secteur, custom: true });
  document.getElementById('new-cat-nom').value     = '';
  document.getElementById('new-cat-secteur').value = '';
  showToast('Catégorie ajoutée', 'success');
  afficherCategoriesCustom();
}

async function demanderSuppressionCategorie(id) {
  /* Vérifier si des transactions utilisent cette catégorie */
  const transactions = await dbGetAll('transactions');
  const utilisee     = transactions.some(t => t.category_id === id);
  if (utilisee) {
    showToast('Cette catégorie est utilisée par des transactions existantes.', 'error');
    return;
  }
  if (!confirm('Supprimer cette catégorie ?')) return;
  await dbDelete('categories', id);
  showToast('Catégorie supprimée', 'info');
  afficherCategoriesCustom();
}

/* ── Sauvegarde automatique ── */

function afficherConfigBackup() {
  const select = document.getElementById('backup-frequence');
  if (select) select.value = backupConfig.frequence || 'disabled';
  mettreAJourBadgeBackup();
}

function mettreAJourBadgeBackup() {
  const badge = document.getElementById('backup-status-badge');
  const info  = document.getElementById('backup-last-info');
  if (!badge) return;

  const actif = backupConfig.frequence !== 'disabled';
  badge.className = `backup-badge ${actif ? 'active' : 'inactive'}`;
  badge.innerHTML = `
    <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>
    ${actif ? 'Active' : 'Inactive'}
  `;
  if (info) {
    info.textContent = backupConfig.derniereDate
      ? `Dernière sauvegarde : ${fDateLong(backupConfig.derniereDate.slice(0, 10))}`
      : 'Dernière sauvegarde : jamais';
  }
}

async function sauvegarderConfigBackup() {
  const select = document.getElementById('backup-frequence');
  backupConfig.frequence = select?.value || 'disabled';
  await dbPut('config', { cle: 'backup_config', valeur: backupConfig });
  mettreAJourBadgeBackup();
  showToast('Config sauvegarde mise à jour', 'success');
}

async function lancerBackupManuel() {
  await effectuerBackup();
  showToast('Sauvegarde téléchargée', 'success');
}

async function effectuerBackup() {
  const [transactions, categories, config] = await Promise.all([
    dbGetAll('transactions'),
    dbGetAll('categories'),
    dbGetAll('config'),
  ]);

  const snapshot = {
    version:    '2.0.0',
    exportedAt: new Date().toISOString(),
    type:       'backup',
    data:       { transactions, categories, config },
  };

  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `windtrack_backup_${dateAujourdhui()}.json`;
  a.click();
  URL.revokeObjectURL(url);

  backupConfig.derniereDate = new Date().toISOString();
  await dbPut('config', { cle: 'backup_config', valeur: backupConfig });
  mettreAJourBadgeBackup();
}

/**
 * Vérifie si une sauvegarde automatique doit être lancée aujourd'hui.
 */
async function verifierBackupAuto() {
  if (!backupConfig.frequence || backupConfig.frequence === 'disabled') return;

  const maintenant    = new Date();
  const derniere      = backupConfig.derniereDate ? new Date(backupConfig.derniereDate) : null;
  let doitSauvegarder = false;

  if (!derniere) {
    doitSauvegarder = true;
  } else if (backupConfig.frequence === 'daily') {
    doitSauvegarder = derniere.toDateString() !== maintenant.toDateString();
  } else if (backupConfig.frequence === 'weekly') {
    /* Déclencher le lundi si pas encore fait cette semaine */
    const lundiDerniere = getLundi(derniere);
    const lundiAuj      = getLundi(maintenant);
    doitSauvegarder = lundiAuj > lundiDerniere;
  }

  if (doitSauvegarder) {
    /* Délai de 3 sec après le démarrage pour ne pas gêner le chargement */
    setTimeout(async () => {
      await effectuerBackup();
      showToast('Sauvegarde automatique effectuée', 'info');
    }, 3000);
  }
}

function getLundi(date) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/* ══════════════════════════════════════════════════════════
   15. EXPORT / IMPORT JSON
══════════════════════════════════════════════════════════ */

async function exporterDonnees() {
  await effectuerBackup();
}

async function importerDonnees(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const snapshot = JSON.parse(e.target.result);
      if (!snapshot.data) throw new Error('Format invalide');

      await dbClear('transactions');
      await dbClear('categories');
      await dbClear('config');

      for (const cat of (snapshot.data.categories || [])) {
        const { id: _, ...rest } = cat;
        await dbAdd('categories', rest);
      }
      for (const tx of (snapshot.data.transactions || [])) {
        const { id: _, ...rest } = tx;
        await dbAdd('transactions', rest);
      }
      for (const cfg of (snapshot.data.config || [])) {
        await dbPut('config', cfg);
      }

      await chargerConfig();
      showToast('Import réussi', 'success');
      navigateTo('dashboard');
    } catch (err) {
      showToast('Erreur lors de l\'import', 'error');
      console.error(err);
    }
  };
  reader.readAsText(file);
}

async function reinitialiserDonnees() {
  if (!confirm('Supprimer TOUTES les données ? Action irréversible.')) return;
  await dbClear('transactions');
  await dbClear('categories');
  await dbClear('config');
  await seedCategories();
  backupConfig = { frequence: 'disabled', derniereDate: null };
  showToast('Données réinitialisées', 'info');
  navigateTo('dashboard');
}

/* ══════════════════════════════════════════════════════════
   16. MODALS HELPERS
══════════════════════════════════════════════════════════ */

function ouvrirModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.add('open');
  /* Fermer en tapant sur l'overlay */
  m.addEventListener('click', function onOverlay(e) {
    if (e.target === m) {
      fermerModal(id);
      m.removeEventListener('click', onOverlay);
    }
  });
}

function fermerModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

/* ══════════════════════════════════════════════════════════
   17. TOASTS
══════════════════════════════════════════════════════════ */

function showToast(message, type = 'info', duree = 3000) {
  const container = document.getElementById('toast-container');
  const toast     = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity    = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duree);
}

/* ══════════════════════════════════════════════════════════
   18. SERVICE WORKER
══════════════════════════════════════════════════════════ */

function enregistrerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('[WindTrack] Service Worker enregistré'))
      .catch(err => console.warn('[WindTrack] SW non disponible :', err));
  }
}

/* ══════════════════════════════════════════════════════════
   19. DÉMARRAGE
══════════════════════════════════════════════════════════ */

async function demarrer() {
  try {
    await initDB();
    await seedCategories();
    await chargerConfig();
    enregistrerServiceWorker();
    await verifierBackupAuto();
    navigateTo('dashboard');
    console.log('[WindTrack] Application v2.0.0 démarrée');
  } catch (err) {
    console.error('[WindTrack] Erreur démarrage :', err);
    showToast('Erreur au démarrage. Recharge la page.', 'error');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', demarrer);
} else {
  demarrer();
}
