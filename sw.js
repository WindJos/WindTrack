/* ============================================================
   WindTrack — sw.js
   Service Worker · Stratégie Cache First · Offline-First
   ============================================================ */

'use strict';

/* Nom et version du cache — à incrémenter à chaque mise à jour */
const CACHE_NAME = 'windtrack-v1.0.0';

/* Fichiers à mettre en cache lors de l'installation */
const FICHIERS_A_CACHER = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

/* ── Événement INSTALL ─────────────────────────────────── */
/* Déclenché à la première installation du Service Worker.
   On met en cache tous les fichiers statiques de l'app.    */
self.addEventListener('install', (event) => {
  console.log('[SW] Installation — mise en cache des ressources');

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FICHIERS_A_CACHER);
    }).then(() => {
      /* Forcer l'activation immédiate sans attendre le refresh */
      return self.skipWaiting();
    })
  );
});

/* ── Événement ACTIVATE ────────────────────────────────── */
/* Déclenché lors de l'activation du nouveau Service Worker.
   On supprime les anciens caches obsolètes.                */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation — nettoyage des anciens caches');

  event.waitUntil(
    caches.keys().then((noms) => {
      return Promise.all(
        noms
          .filter((nom) => nom !== CACHE_NAME)
          .map((nom) => {
            console.log('[SW] Suppression ancien cache :', nom);
            return caches.delete(nom);
          })
      );
    }).then(() => {
      /* Prendre le contrôle de tous les clients immédiatement */
      return self.clients.claim();
    })
  );
});

/* ── Événement FETCH ───────────────────────────────────── */
/* Intercepte toutes les requêtes réseau.
   Stratégie : Cache First — on sert d'abord depuis le cache.
   Si pas en cache, on tente le réseau, puis on met en cache. */
self.addEventListener('fetch', (event) => {
  /* Ignorer les requêtes non-GET et les extensions Chrome */
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;

  /* Ignorer les requêtes vers des CDN externes en mode dégradé */
  const url = new URL(event.request.url);
  const estLocal = url.origin === self.location.origin;

  if (estLocal) {
    /* Stratégie Cache First pour les ressources locales */
    event.respondWith(
      caches.match(event.request).then((reponseCache) => {
        if (reponseCache) {
          /* Ressource trouvée dans le cache → la retourner */
          return reponseCache;
        }

        /* Pas en cache → tenter le réseau */
        return fetch(event.request).then((reponseReseau) => {
          /* Vérifier que la réponse est valide */
          if (!reponseReseau || reponseReseau.status !== 200 || reponseReseau.type !== 'basic') {
            return reponseReseau;
          }

          /* Cloner la réponse (elle ne peut être lue qu'une fois) */
          const reponseAMettrEnCache = reponseReseau.clone();

          /* Mettre en cache pour les prochains accès */
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, reponseAMettrEnCache);
          });

          return reponseReseau;
        }).catch(() => {
          /* Hors ligne et pas en cache : retourner page offline si disponible */
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
      })
    );
  } else {
    /* Stratégie Network First pour les ressources CDN (Google Fonts, Tailwind) */
    event.respondWith(
      fetch(event.request).then((reponseReseau) => {
        /* Mettre en cache les ressources CDN aussi */
        if (reponseReseau && reponseReseau.status === 200) {
          const clone = reponseReseau.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return reponseReseau;
      }).catch(() => {
        /* Hors ligne : servir depuis le cache si disponible */
        return caches.match(event.request);
      })
    );
  }
});

/* ── Événement MESSAGE ─────────────────────────────────── */
/* Permet à l'app de communiquer avec le Service Worker.
   ex: forcer une mise à jour du cache.                    */
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
