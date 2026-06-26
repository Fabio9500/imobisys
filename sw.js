// ══════════════════════════════════════════
// ImobiSys — Service Worker PWA
// Versão: 1.0
// Estratégia: Cache First + Atualização em segundo plano
// ══════════════════════════════════════════

const CACHE_NOME = 'imobisys-cache-v1';

// Arquivos essenciais para funcionamento offline
const ARQUIVOS_CACHE = [
  './imobisys.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// URLs que NUNCA devem ser cacheadas (sempre precisam de internet)
const NUNCA_CACHEAR = [
  'api.github.com',
  'wa.me',
  'raw.githubusercontent.com',
  'codeload.github.com'
];

// ── INSTALL: pré-carrega os arquivos essenciais no cache ──
self.addEventListener('install', event => {
  console.log('[ImobiSys SW] Instalando e cacheando arquivos essenciais...');
  event.waitUntil(
    caches.open(CACHE_NOME)
      .then(cache => {
        console.log('[ImobiSys SW] Cache aberto, adicionando arquivos...');
        return Promise.allSettled(
          ARQUIVOS_CACHE.map(url =>
            cache.add(url).catch(err => console.warn('[ImobiSys SW] Não foi possível cachear:', url, err))
          )
        );
      })
      .then(() => {
        console.log('[ImobiSys SW] ✅ Instalação concluída!');
        return self.skipWaiting(); // Ativa imediatamente sem esperar reload
      })
  );
});

// ── ACTIVATE: limpa caches antigos de versões anteriores ──
self.addEventListener('activate', event => {
  console.log('[ImobiSys SW] Ativando e limpando caches antigos...');
  event.waitUntil(
    caches.keys()
      .then(nomesCaches => {
        return Promise.all(
          nomesCaches
            .filter(nome => nome !== CACHE_NOME)
            .map(nomeAntigo => {
              console.log('[ImobiSys SW] Removendo cache antigo:', nomeAntigo);
              return caches.delete(nomeAntigo);
            })
        );
      })
      .then(() => {
        console.log('[ImobiSys SW] ✅ Ativação concluída! Controlando todas as abas.');
        return self.clients.claim(); // Controla abas abertas imediatamente
      })
  );
});

// ── FETCH: intercepta requisições e serve do cache quando offline ──
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Não intercepta chamadas de API ou serviços externos
  const deveIgnorar = NUNCA_CACHEAR.some(dominio => url.includes(dominio));
  if (deveIgnorar) {
    return; // Deixa o navegador lidar normalmente (vai falhar se offline — esperado)
  }

  // Apenas intercepta requisições GET
  if (event.request.method !== 'GET') return;

  // Estratégia: Cache First com atualização em segundo plano (Stale While Revalidate)
  event.respondWith(
    caches.open(CACHE_NOME).then(cache => {
      return cache.match(event.request).then(respostaCache => {

        // Busca na rede em segundo plano para atualizar o cache
        const buscaRede = fetch(event.request)
          .then(respostaRede => {
            if (respostaRede && respostaRede.status === 200 && respostaRede.type !== 'opaque') {
              cache.put(event.request, respostaRede.clone());
              console.log('[ImobiSys SW] Cache atualizado:', url.split('/').pop());
            }
            return respostaRede;
          })
          .catch(() => {
            // Sem internet — sem problema, retorna do cache
            console.log('[ImobiSys SW] Offline detectado, usando cache para:', url.split('/').pop());
            return respostaCache;
          });

        // Retorna do cache imediatamente (se disponível), rede atualiza em background
        return respostaCache || buscaRede;
      });
    })
  );
});

// ── MESSAGE: comunicação com a página ──
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'LIMPAR_CACHE') {
    caches.delete(CACHE_NOME).then(() => {
      console.log('[ImobiSys SW] Cache limpo manualmente.');
    });
  }
});
