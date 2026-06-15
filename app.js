/* ============================================================
   WindTrack — app.js
   Logique applicative complète : IndexedDB · Navigation ·
   Dashboard · Saisie · Historique · Graphiques · Paramètres
   ============================================================ */

'use strict';

/* ══════════════════════════════════════════════════════════
   1. ÉTAT GLOBAL
══════════════════════════════════════════════════════════ */

/** Base de données IndexedDB */
let db = null;

/** Écran courant */
let ecranCourant = 'dashboard';

/** Type sélectionné dans le formulaire */
let typeCourant = 'Entrée';

/** Période active sur le dashboard */
let periodeActive = 'mois';

/** Période active dans l'historique */
let histPeriode = 'mois';

/** Filtre type dans l'historique */
let histType = 'all';

/** Raccourcis boostage configurables */
let raccourcisBoostage = [
  { label: 'Contrat 3j', montant: 5000,  description: 'Contrat Facebook 3 jours' },
  { label: 'Contrat 7j', montant: 15000, description: 'Contrat Facebook 7 jours' },
  { label: 'Contrat 14j',montant: 28000, description: 'Contrat Facebook 14 jours' },
];

/* ══════════════════════════════════════════════════════════
   2. INITIALISATION — IndexedDB
══════════════════════════════════════════════════════════ */

/**
 * Ouvre la base IndexedDB et crée les stores si nécessaire.
 * Version 1 : stores "categories" et "transactions".
 */
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('windtrack_db', 1);

    request.onupgradeneeded = (e) => {
      const database = e.target.result;

      /* ── Store categories ── */
      if (!database.objectStoreNames.contains('categories')) {
        const catStore = database.createObjectStore('categories', {
          keyPath: 'id', autoIncrement: true,
        });
        catStore.createIndex('type',    'type',    { unique: false });
        catStore.createIndex('secteur', 'secteur', { unique: false });
      }

      /* ── Store transactions ── */
      if (!database.objectStoreNames.contains('transactions')) {
        const txStore = database.createObjectStore('transactions', {
          keyPath: 'id', autoIncrement: true,
        });
        txStore.createIndex('date',        'date',        { unique: false });
        txStore.createIndex('category_id', 'category_id', { unique: false });
      }

      /* ── Store config (raccourcis, préférences) ── */
      if (!database.objectStoreNames.contains('config')) {
        database.createObjectStore('config', { keyPath: 'cle' });
      }
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Injecte les catégories par défaut si la base est vide.
 */
async function seedCategories() {
  const toutes = await dbGetAll('categories');
  if (toutes.length > 0) return; // Déjà initialisé

  const defaut = [
    /* Entrées Professionnel */
    { nom: 'Boostage Facebook',    type: 'Entrée', secteur: 'Professionnel', emoji: '🚀', custom: false },
    { nom: 'Graphisme & Conception',type: 'Entrée', secteur: 'Professionnel', emoji: '🎨', custom: false },
    { nom: 'Imprimerie',            type: 'Entrée', secteur: 'Professionnel', emoji: '🖨️', custom: false },
    { nom: 'Vente de Licences',     type: 'Entrée', secteur: 'Professionnel', emoji: '🔑', custom: false },
    /* Sorties Professionnel */
    { nom: 'Connexion Internet',    type: 'Sortie', secteur: 'Professionnel', emoji: '📡', custom: false },
    { nom: 'Matériel de travail',   type: 'Sortie', secteur: 'Professionnel', emoji: '🖥️', custom: false },
    { nom: 'Location espace / Cyber',type:'Sortie', secteur: 'Professionnel', emoji: '🏢', custom: false },
    /* Sorties Académique */
    { nom: 'Formations',            type: 'Sortie', secteur: 'Académique',    emoji: '📚', custom: false },
    { nom: 'Frais de scolarité',    type: 'Sortie', secteur: 'Académique',    emoji: '🎓', custom: false },
    /* Sorties Personnel */
    { nom: 'Carburant',             type: 'Sortie', secteur: 'Personnel',     emoji: '⛽', custom: false },
    { nom: 'Nourriture / Restau',   type: 'Sortie', secteur: 'Personnel',     emoji: '🍽️', custom: false },
    { nom: 'Divers quotidien',      type: 'Sortie', secteur: 'Personnel',     emoji: '🛒', custom: false },
  ];

  for (const cat of defaut) {
    await dbAdd('categories', cat);
  }
}

/**
 * Charge la configuration sauvegardée (raccourcis, etc.)
 */
async function chargerConfig() {
  const savedRacc = await dbGet('config', 'raccourcis_boostage');
  if (savedRacc) raccourcisBoostage = savedRacc.valeur;

  const savedTheme = await dbGet('config', 'theme');
  if (savedTheme) {
    appliquerTheme(savedTheme.valeur);
  }
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
  parametres: 'Paramètres',
};

function navigateTo(ecran) {
  /* Masquer tous les écrans */
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

  /* Afficher l'écran cible */
  const el = document.getElementById(`screen-${ecran}`);
  if (!el) return;
  el.classList.add('active');
  ecranCourant = ecran;

  /* Mettre à jour le titre */
  document.getElementById('header-title').textContent = TITRES[ecran] || '';

  /* Mettre à jour la nav du bas */
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  const navMap = { dashboard: 0, historique: 1, graphiques: 3, parametres: 4 };
  if (navMap[ecran] !== undefined) {
    document.querySelectorAll('.nav-btn')[navMap[ecran]]?.classList.add('active');
  }

  /* Remonter en haut de l'écran */
  el.scrollTop = 0;

  /* Charger les données de l'écran */
  switch (ecran) {
    case 'dashboard':  rafraichirDashboard();  break;
    case 'saisie':     initSaisie();            break;
    case 'historique': rafraichirHistorique();  break;
    case 'graphiques': rafraichirGraphiques();  break;
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
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    document.getElementById('theme-icon').textContent = '☀️';
  } else {
    document.documentElement.classList.remove('dark');
    document.getElementById('theme-icon').textContent = '🌙';
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

/**
 * Formate un nombre en FCFA avec séparateurs.
 */
function fCFA(n) {
  if (!n && n !== 0) return '—';
  return Number(n).toLocaleString('fr-FR') + ' F';
}

/**
 * Formate une date ISO en français court.
 */
function fDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short',
  });
}

/**
 * Date du jour en ISO (YYYY-MM-DD).
 */
function dateAujourdhui() {
  return new Date().toISOString().slice(0, 10);
}

/* ══════════════════════════════════════════════════════════
   8. FILTRAGE PAR PÉRIODE
══════════════════════════════════════════════════════════ */

/**
 * Retourne {debut, fin} en ISO selon la période choisie.
 */
function getPlageDates(periode) {
  const auj = new Date();
  let debut, fin;

  switch (periode) {
    case 'aujourd_hui':
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
    case 'tout':
    default:
      debut = '2000-01-01';
      fin   = '2099-12-31';
      break;
  }
  return { debut, fin };
}

/**
 * Filtre les transactions selon la période.
 */
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

  /* ── Totaux ── */
  const entrees = txPeriode.filter(t => {
    const cat = categories.find(c => c.id === t.category_id);
    return cat?.type === 'Entrée';
  }).reduce((s, t) => s + t.montant, 0);

  const sorties = txPeriode.filter(t => {
    const cat = categories.find(c => c.id === t.category_id);
    return cat?.type === 'Sortie';
  }).reduce((s, t) => s + t.montant, 0);

  const solde = entrees - sorties;

  /* ── Carte solde ── */
  const soldeCard = document.getElementById('solde-card');
  const soldeVal  = document.getElementById('solde-value');
  soldeVal.textContent = (solde >= 0 ? '+' : '') + fCFA(solde);
  if (solde >= 0) {
    soldeCard.classList.remove('negative');
  } else {
    soldeCard.classList.add('negative');
  }

  /* ── Tendance vs mois précédent ── */
  const moisPrecedent = getMoisPrecedent();
  const txMoisPrec = toutes.filter(tx => tx.date >= moisPrecedent.debut && tx.date <= moisPrecedent.fin);
  const soldePrecedent = calculerSolde(txMoisPrec, categories);
  afficherTendance(solde, soldePrecedent);

  /* ── Totaux ── */
  document.getElementById('total-entrees').textContent = fCFA(entrees);
  document.getElementById('total-sorties').textContent = fCFA(sorties);

  /* ── Répartition dépenses par secteur ── */
  const txSorties = txPeriode.filter(t => {
    const cat = categories.find(c => c.id === t.category_id);
    return cat?.type === 'Sortie';
  });

  const parSecteur = { Professionnel: 0, Personnel: 0, Académique: 0 };
  txSorties.forEach(t => {
    const cat = categories.find(c => c.id === t.category_id);
    if (cat?.secteur && parSecteur[cat.secteur] !== undefined) {
      parSecteur[cat.secteur] += t.montant;
    }
  });

  const totalSorties = Object.values(parSecteur).reduce((s, v) => s + v, 0) || 1;
  const pcts = {
    Professionnel: Math.round((parSecteur.Professionnel / totalSorties) * 100),
    Personnel:     Math.round((parSecteur.Personnel     / totalSorties) * 100),
    Académique:    Math.round((parSecteur.Académique    / totalSorties) * 100),
  };

  document.getElementById('pct-pro').textContent   = pcts.Professionnel + '%';
  document.getElementById('pct-perso').textContent  = pcts.Personnel + '%';
  document.getElementById('pct-acad').textContent   = pcts.Académique + '%';
  document.getElementById('bar-pro').style.width    = pcts.Professionnel + '%';
  document.getElementById('bar-perso').style.width  = pcts.Personnel + '%';
  document.getElementById('bar-acad').style.width   = pcts.Académique + '%';

  /* ── Bilan par secteur ── */
  const secteurs = ['Professionnel', 'Personnel', 'Académique'];
  const emojis   = { Professionnel: '💼', Personnel: '🏠', Académique: '🎓' };
  let bilanHTML  = '';

  for (const sect of secteurs) {
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
        <span class="text-sm text-gray-600 dark:text-gray-300">${emojis[sect]} ${sect}</span>
        <span class="montant text-sm font-semibold ${couleur}">${soldeSect >= 0 ? '+' : ''}${fCFA(soldeSect)}</span>
      </div>`;
  }
  document.getElementById('bilan-secteurs').innerHTML = bilanHTML || '<p class="text-sm text-gray-400">Aucune donnée.</p>';

  /* ── Transactions récentes ── */
  const recentes = [...txPeriode]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const recentesEl = document.getElementById('recentes-list');
  if (!recentes.length) {
    recentesEl.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">Aucune transaction pour cette période.</p>';
    return;
  }

  recentesEl.innerHTML = recentes.map(tx => {
    const cat    = categories.find(c => c.id === tx.category_id);
    const isEntree = cat?.type === 'Entrée';
    const couleur  = isEntree ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400';
    const signe    = isEntree ? '+' : '−';
    return `
      <div class="tx-row">
        <div class="cat-badge" style="background:${isEntree ? '#DCFCE7' : '#FEE2E2'}">
          ${cat?.emoji || (isEntree ? '↑' : '↓')}
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
  const moisPrecedent = new Date(auj.getFullYear(), auj.getMonth() - 1, 1);
  const dernierJour   = new Date(auj.getFullYear(), auj.getMonth(), 0);
  return {
    debut: moisPrecedent.toISOString().slice(0, 10),
    fin:   dernierJour.toISOString().slice(0, 10),
  };
}

function calculerSolde(transactions, categories) {
  let solde = 0;
  transactions.forEach(tx => {
    const cat = categories.find(c => c.id === tx.category_id);
    if (cat?.type === 'Entrée') solde += tx.montant;
    else solde -= tx.montant;
  });
  return solde;
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

  if (diff > 0) {
    tendanceIcon.textContent = '↑ +' + pct + '%';
    tendanceText.textContent = 'vs mois précédent';
  } else if (diff < 0) {
    tendanceIcon.textContent = '↓ −' + pct + '%';
    tendanceText.textContent = 'vs mois précédent';
  } else {
    tendanceIcon.textContent = '→ stable';
    tendanceText.textContent = 'vs mois précédent';
  }
}

/* ══════════════════════════════════════════════════════════
   10. FORMULAIRE DE SAISIE
══════════════════════════════════════════════════════════ */

async function initSaisie() {
  /* Réinitialiser le formulaire */
  document.getElementById('input-montant').value      = '';
  document.getElementById('input-description').value  = '';
  document.getElementById('input-date').value         = dateAujourdhui();

  setType('Entrée');
  await chargerCategories();
}

function setType(type) {
  typeCourant = type;

  const btnEntree = document.getElementById('btn-entree');
  const btnSortie = document.getElementById('btn-sortie');

  if (type === 'Entrée') {
    btnEntree.className = 'type-btn active-entree';
    btnSortie.className = 'type-btn';
  } else {
    btnEntree.className = 'type-btn';
    btnSortie.className = 'type-btn active-sortie';
  }

  chargerCategories();
}

async function chargerCategories() {
  const categories = await dbGetAll('categories');
  const filtrees   = categories.filter(c => c.type === typeCourant);
  const select     = document.getElementById('input-categorie');

  select.innerHTML = '<option value="">Sélectionner une catégorie…</option>' +
    filtrees.map(c => `<option value="${c.id}">${c.emoji || ''} ${c.nom}</option>`).join('');

  /* Masquer les raccourcis par défaut */
  document.getElementById('raccourcis-boostage').classList.add('hidden');
}

function onCategorieChange() {
  const select = document.getElementById('input-categorie');
  const option = select.options[select.selectedIndex];
  const texte  = option?.text || '';

  /* Afficher les raccourcis si Boostage Facebook sélectionné */
  if (texte.includes('Boostage Facebook')) {
    afficherRaccourcis();
  } else {
    document.getElementById('raccourcis-boostage').classList.add('hidden');
  }
}

function afficherRaccourcis() {
  const container = document.getElementById('raccourcis-boostage');
  const list      = document.getElementById('raccourcis-list');

  list.innerHTML = raccourcisBoostage.map((r, i) => `
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

function onMontantChange() {
  /* Rien de spécial pour l'instant — hook disponible pour extensions */
}

async function enregistrerTransaction() {
  const montantBrut = document.getElementById('input-montant').value;
  const montant     = parseFloat(montantBrut);
  const catId       = parseInt(document.getElementById('input-categorie').value);
  const description = document.getElementById('input-description').value.trim();
  const date        = document.getElementById('input-date').value;

  /* Validations */
  if (!montant || montant <= 0) {
    showToast('Saisis un montant valide', 'error');
    return;
  }
  if (!catId) {
    showToast('Sélectionne une catégorie', 'error');
    return;
  }
  if (!date) {
    showToast('Sélectionne une date', 'error');
    return;
  }

  try {
    await dbAdd('transactions', {
      montant,
      category_id: catId,
      description: description || null,
      date,
      createdAt: new Date().toISOString(),
    });

    showToast('Transaction enregistrée ✓', 'success');

    /* Remettre le formulaire à zéro */
    document.getElementById('input-montant').value     = '';
    document.getElementById('input-description').value = '';
    document.getElementById('raccourcis-boostage').classList.add('hidden');

    /* Revenir au dashboard après 600ms */
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

  /* Filtre par type */
  if (histType !== 'all') {
    filtrees = filtrees.filter(tx => {
      const cat = categories.find(c => c.id === tx.category_id);
      return cat?.type === histType;
    });
  }

  /* Tri du plus récent au plus ancien */
  filtrees.sort((a, b) => b.date.localeCompare(a.date));

  const container = document.getElementById('historique-list');

  if (!filtrees.length) {
    container.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">Aucune transaction pour cette période.</p>';
    return;
  }

  container.innerHTML = filtrees.map(tx => {
    const cat      = categories.find(c => c.id === tx.category_id);
    const isEntree = cat?.type === 'Entrée';
    const couleur  = isEntree ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400';
    const signe    = isEntree ? '+' : '−';

    return `
      <div class="tx-row" id="tx-${tx.id}">
        <div class="cat-badge" style="background:${isEntree ? '#DCFCE7' : '#FEE2E2'}">
          ${cat?.emoji || (isEntree ? '↑' : '↓')}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">${cat?.nom || '—'}</p>
          ${tx.description ? `<p class="text-xs text-gray-400 truncate">${tx.description}</p>` : ''}
          <p class="text-xs text-gray-400">${fDate(tx.date)}</p>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <p class="montant text-sm font-bold ${couleur}">${signe}${fCFA(tx.montant)}</p>
          <button class="delete-btn" onclick="supprimerTransaction(${tx.id})" title="Supprimer">
            🗑
          </button>
        </div>
      </div>`;
  }).join('');

  /* Gestion du swipe / long press pour révéler le bouton supprimer */
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

async function supprimerTransaction(id) {
  if (!confirm('Supprimer cette transaction ?')) return;
  await dbDelete('transactions', id);
  showToast('Transaction supprimée', 'info');
  rafraichirHistorique();
}

/* ══════════════════════════════════════════════════════════
   12. GRAPHIQUES (SVG pur, sans librairie)
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

/**
 * Génère un graphique SVG en barres groupées (entrées vs sorties) sur 6 mois.
 */
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

  /* Calculer max pour l'échelle */
  const valeurs = mois6.map(m => {
    const txMois = transactions.filter(tx => tx.date.startsWith(m.key));
    const ent = txMois.filter(tx => categories.find(c=>c.id===tx.category_id)?.type==='Entrée').reduce((s,t)=>s+t.montant,0);
    const sor = txMois.filter(tx => categories.find(c=>c.id===tx.category_id)?.type==='Sortie').reduce((s,t)=>s+t.montant,0);
    return { ent, sor, label: m.label };
  });

  const maxVal = Math.max(...valeurs.flatMap(v => [v.ent, v.sor]), 1);

  /* Construire le SVG */
  let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;

  /* Lignes de grille horizontales */
  [0, 0.25, 0.5, 0.75, 1].forEach(pct => {
    const y = PAD.top + innerH * (1 - pct);
    const label = pct === 0 ? '' : formatMontantCourt(maxVal * pct);
    svg += `<line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}" stroke="#E7E5E4" stroke-width="1" stroke-dasharray="3,3"/>`;
    if (label) svg += `<text x="${PAD.left - 4}" y="${y + 4}" text-anchor="end" font-size="9" fill="#9CA3AF" font-family="DM Mono, monospace">${label}</text>`;
  });

  /* Barres */
  valeurs.forEach((v, i) => {
    const xGroupe = PAD.left + i * largeurGroupe + 6;
    const xEnt    = xGroupe;
    const xSor    = xGroupe + largeurBarre + 4;

    const hEnt = Math.max((v.ent / maxVal) * innerH, v.ent > 0 ? 3 : 0);
    const hSor = Math.max((v.sor / maxVal) * innerH, v.sor > 0 ? 3 : 0);

    const yEnt = PAD.top + innerH - hEnt;
    const ySor = PAD.top + innerH - hSor;

    /* Barre entrées */
    if (v.ent > 0) {
      svg += `<rect x="${xEnt}" y="${yEnt}" width="${largeurBarre}" height="${hEnt}" rx="3" fill="#22C55E" opacity="0.85"/>`;
    }
    /* Barre sorties */
    if (v.sor > 0) {
      svg += `<rect x="${xSor}" y="${ySor}" width="${largeurBarre}" height="${hSor}" rx="3" fill="#EF4444" opacity="0.75"/>`;
    }

    /* Label mois */
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

  /* CA par mois */
  const caParMois = mois6.map(m => {
    const txMois = transactions.filter(tx => tx.date.startsWith(m.key));
    return txMois.filter(tx => categories.find(c=>c.id===tx.category_id)?.type==='Entrée')
                 .reduce((s,t) => s+t.montant, 0);
  });
  const meilleurIdx    = caParMois.indexOf(Math.max(...caParMois));
  const meilleurMois   = mois6[meilleurIdx];
  const meilleurRevenu = caParMois[meilleurIdx] || 0;

  /* Moyenne mensuelle */
  const moyMois = caParMois.reduce((s,v)=>s+v,0) / 6;

  /* Total général */
  const totalEntrees = transactions
    .filter(tx => categories.find(c=>c.id===tx.category_id)?.type==='Entrée')
    .reduce((s,t)=>s+t.montant,0);

  const totalSorties = transactions
    .filter(tx => categories.find(c=>c.id===tx.category_id)?.type==='Sortie')
    .reduce((s,t)=>s+t.montant,0);

  const statsItems = [
    { label: '📅 Meilleur mois',     val: meilleurMois?.label || '—' },
    { label: '🏆 Revenu ce mois-là', val: fCFA(meilleurRevenu) },
    { label: '📊 Moy. mensuelle',    val: fCFA(Math.round(moyMois)) },
    { label: '💳 Nb. transactions',  val: transactions.length },
    { label: '↑ Total entrées',      val: fCFA(totalEntrees) },
    { label: '↓ Total sorties',      val: fCFA(totalSorties) },
  ];

  document.getElementById('stats-grid').innerHTML = statsItems.map(s => `
    <div class="bg-beige-50 dark:bg-zinc-800 rounded-xl p-3">
      <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">${s.label}</p>
      <p class="montant text-sm font-bold text-gray-800 dark:text-white">${s.val}</p>
    </div>
  `).join('');
}

function afficherTopCategories(transactions, categories) {
  const entrees = transactions.filter(tx => {
    const cat = categories.find(c=>c.id===tx.category_id);
    return cat?.type === 'Entrée';
  });

  const parCat = {};
  entrees.forEach(tx => {
    if (!parCat[tx.category_id]) parCat[tx.category_id] = 0;
    parCat[tx.category_id] += tx.montant;
  });

  const top = Object.entries(parCat)
    .sort((a,b) => b[1]-a[1])
    .slice(0,5);

  const maxVal = top[0]?.[1] || 1;

  const container = document.getElementById('top-categories');
  if (!top.length) {
    container.innerHTML = '<p class="text-sm text-gray-400">Aucune entrée enregistrée.</p>';
    return;
  }

  container.innerHTML = top.map(([catId, total]) => {
    const cat = categories.find(c=>c.id===Number(catId));
    const pct = Math.round((total/maxVal)*100);
    return `
      <div>
        <div class="flex justify-between text-xs text-gray-600 dark:text-gray-300 mb-1.5">
          <span>${cat?.emoji||''} ${cat?.nom||'—'}</span>
          <span class="montant font-semibold">${fCFA(total)}</span>
        </div>
        <div class="progress-bar"><div class="progress-fill bg-indigo-500" style="width:${pct}%"></div></div>
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════════
   13. PARAMÈTRES
══════════════════════════════════════════════════════════ */

function initParametres() {
  afficherConfigRaccourcis();
  afficherCategoriesCustom();
}

function afficherConfigRaccourcis() {
  const container = document.getElementById('raccourcis-config');
  container.innerHTML = raccourcisBoostage.map((r, i) => `
    <div class="space-y-1.5 p-3 bg-beige-50 dark:bg-zinc-800 rounded-xl">
      <p class="text-xs font-semibold text-gray-500 dark:text-gray-400">Raccourci ${i+1}</p>
      <div class="grid grid-cols-2 gap-2">
        <input type="text" value="${r.label}" placeholder="Nom"
          class="wt-input text-sm" id="racc-label-${i}" />
        <input type="number" value="${r.montant}" placeholder="Montant"
          class="wt-input montant text-sm" id="racc-montant-${i}" />
      </div>
      <input type="text" value="${r.description}" placeholder="Description pré-remplie"
        class="wt-input text-sm" id="racc-desc-${i}" />
    </div>
  `).join('');
}

async function sauvegarderRaccourcis() {
  const nouveaux = raccourcisBoostage.map((_, i) => ({
    label:       document.getElementById(`racc-label-${i}`)?.value   || '',
    montant:     parseFloat(document.getElementById(`racc-montant-${i}`)?.value) || 0,
    description: document.getElementById(`racc-desc-${i}`)?.value    || '',
  }));

  raccourcisBoostage = nouveaux;
  await dbPut('config', { cle: 'raccourcis_boostage', valeur: nouveaux });
  showToast('Raccourcis sauvegardés ✓', 'success');
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
      <span class="text-sm text-gray-700 dark:text-gray-300">${c.emoji||''} ${c.nom} · <span class="text-gray-400">${c.type} · ${c.secteur}</span></span>
      <button onclick="supprimerCategorie(${c.id})" class="text-red-400 text-sm active:scale-95 px-2">✕</button>
    </div>
  `).join('');
}

async function ajouterCategorie() {
  const nom     = document.getElementById('new-cat-nom').value.trim();
  const type    = document.getElementById('new-cat-type').value;
  const secteur = document.getElementById('new-cat-secteur').value;

  if (!nom) { showToast('Saisis un nom de catégorie', 'error'); return; }

  await dbAdd('categories', { nom, type, secteur, emoji: '📌', custom: true });
  document.getElementById('new-cat-nom').value = '';
  showToast('Catégorie ajoutée ✓', 'success');
  afficherCategoriesCustom();
}

async function supprimerCategorie(id) {
  if (!confirm('Supprimer cette catégorie ?')) return;
  await dbDelete('categories', id);
  showToast('Catégorie supprimée', 'info');
  afficherCategoriesCustom();
}

/* ══════════════════════════════════════════════════════════
   14. EXPORT / IMPORT
══════════════════════════════════════════════════════════ */

async function exporterDonnees() {
  const [transactions, categories, config] = await Promise.all([
    dbGetAll('transactions'),
    dbGetAll('categories'),
    dbGetAll('config'),
  ]);

  const snapshot = {
    version:    '1.0.0',
    exportedAt: new Date().toISOString(),
    data:       { transactions, categories, config },
  };

  const blob     = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  a.href         = url;
  a.download     = `windtrack_backup_${dateAujourdhui()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Données exportées ✓', 'success');
}

async function importerDonnees(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const snapshot = JSON.parse(e.target.result);
      if (!snapshot.data) throw new Error('Format invalide');

      /* Vider les stores avant restauration */
      await dbClear('transactions');
      await dbClear('categories');
      await dbClear('config');

      /* Réimporter */
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

      showToast('Import réussi ✓', 'success');
      navigateTo('dashboard');
    } catch (err) {
      showToast('Erreur lors de l\'import', 'error');
      console.error(err);
    }
  };
  reader.readAsText(file);
}

async function reinitialiserDonnees() {
  if (!confirm('⚠️ Supprimer TOUTES tes données ? Action irréversible.')) return;
  await dbClear('transactions');
  await dbClear('categories');
  await dbClear('config');
  await seedCategories();
  showToast('Données réinitialisées', 'info');
  navigateTo('dashboard');
}

/* ══════════════════════════════════════════════════════════
   15. TOASTS
══════════════════════════════════════════════════════════ */

function showToast(message, type = 'info', duree = 3000) {
  const container = document.getElementById('toast-container');
  const toast     = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duree);
}

/* ══════════════════════════════════════════════════════════
   16. SERVICE WORKER (enregistrement PWA)
══════════════════════════════════════════════════════════ */

function enregistrerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(() => {
      console.log('[WindTrack] Service Worker enregistré ✓');
    }).catch(err => {
      console.warn('[WindTrack] Service Worker non disponible :', err);
    });
  }
}

/* ══════════════════════════════════════════════════════════
   17. DÉMARRAGE DE L'APPLICATION
══════════════════════════════════════════════════════════ */

async function demarrer() {
  try {
    await initDB();
    await seedCategories();
    await chargerConfig();
    enregistrerServiceWorker();

    /* Afficher le dashboard */
    navigateTo('dashboard');

    console.log('[WindTrack] Application démarrée ✓');
  } catch (err) {
    console.error('[WindTrack] Erreur démarrage :', err);
    showToast('Erreur au démarrage. Recharge la page.', 'error');
  }
}

/* Lancer dès que le DOM est prêt */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', demarrer);
} else {
  demarrer();
}
