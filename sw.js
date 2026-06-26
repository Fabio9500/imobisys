// ══════════════════════════════════════════
// ImobiSys — Service Worker PWA v2
// Otimizado para iPhone/iOS Safari
// ══════════════════════════════════════════

const CACHE_NOME = 'imobisys-cache-v2';

// ── INSTALL: cacheia os arquivos essenciais usando URL absoluta ──
self.addEventListener('install', event => {
  console.log('[ImobiSys SW] Instalando v2...');
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NOME);
      const base = self.registration.scope;
      const arquivos = [
        base + 'imobisys.html',
        base + 'manifest.json',
        base + 'icon-192.png',
        base + 'icon-512.png',
      ];
      // Cacheia cada arquivo individualmente para não falhar tudo se um der erro
      await Promise.allSettled(
        arquivos.map(url =>
          fetch(url).then(r => {
            if (r && r.ok) return cache.put(url, r);
          }).catch(e => console.warn('[SW] Não cacheou:', url, e))
        )
      );
      console.log('[ImobiSys SW] ✅ Instalação concluída!');
      await self.skipWaiting();
    })()
  );
});

// ── ACTIVATE: remove caches antigos ──
self.addEventListener('activate', event => {
  console.log('[ImobiSys SW] Ativando, limpando caches antigos...');
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(k => k !== CACHE_NOME).map(k => caches.delete(k))
      );
      await self.clients.claim();
      console.log('[ImobiSys SW] ✅ Ativo! Controlando todas as abas.');
    })()
  );
});

// ── FETCH: intercepta requisições ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = request.url;

  // Ignora métodos que não são GET
  if (request.method !== 'GET') return;

  // Nunca cacheia chamadas de API ou serviços externos
  if (
    url.includes('api.github.com') ||
    url.includes('wa.me') ||
    url.includes('raw.githubusercontent.com') ||
    url.includes('codeload.github.com')
  ) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NOME);

      // ── Requisições de navegação (abrir o app) ──
      // Crítico para iOS: garante que a página carrega offline
      if (request.mode === 'navigate') {
        // Tenta o cache primeiro (offline-first para navegação)
        const base = self.registration.scope;
        const paginaCache = await cache.match(request)
          || await cache.match(base + 'imobisys.html');

        if (paginaCache) {
          // Atualiza o cache em background enquanto serve do cache
          fetch(request).then(r => {
            if (r && r.ok) cache.put(request, r.clone());
          }).catch(() => {});
          return paginaCache;
        }

        // Sem cache — tenta a rede
        try {
          const resposta = await fetch(request);
          if (resposta && resposta.ok) cache.put(request, resposta.clone());
          return resposta;
        } catch (e) {
          // Offline e sem cache — página de erro amigável
          return new Response(`
            <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <title>ImobiSys — Offline</title>
            <style>body{font-family:Arial,sans-serif;background:#0d1117;color:#e6edf3;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;flex-direction:column;gap:16px;padding:20px;text-align:center}
            .icon{font-size:60px}.title{font-size:22px;font-weight:800;color:#4ade80}.msg{font-size:14px;color:#8b949e;max-width:320px;line-height:1.6}
            button{background:#4ade80;color:#000;border:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;margin-top:8px}</style>
            </head><body>
            <div class="icon">🏠</div>
            <div class="title">ImobiSys</div>
            <div class="msg">Você está offline e ainda não há cache disponível.<br><br>Conecte-se à internet uma vez para habilitar o modo offline.</div>
            <button onclick="location.reload()">🔄 Tentar novamente</button>
            </body></html>
          `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
      }

      // ── Outros recursos (ícones, manifest, etc.) ──
      // Cache first, atualiza em background
      const cached = await cache.match(request);

      const networkFetch = fetch(request).then(response => {
        if (response && response.status === 200) {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(() => cached || null);

      return cached || networkFetch;
    })()
  );
});

// ── MESSAGE: comunicação com a página ──
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'LIMPAR_CACHE') {
    caches.delete(CACHE_NOME).then(() => {
      console.log('[ImobiSys SW] Cache limpo manualmente.');
    });
  }
});
