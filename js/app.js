/**
 * Central de Operações Hermes - Application JavaScript
 *
 * index.html só carrega este arquivo. Aqui estão:
 *   - o status online/offline do cabeçalho (com /health)
 *   - o painel de status de rotinas e integrações
 *   - os mosaicos de estatísticas e a grade de módulos
 *   - a navegação suave e o scroll spy do cabeçalho
 *
 * O feed em si é renderizado por js/feed.js (CentralFeed.Feed), compartilhado
 * com publicacao.html.
 */

(function () {
  'use strict';

  const F = window.CentralFeed;
  const $ = F.$;
  const $$ = F.$$;
  const esc = F.esc;

  const CONFIG = {
    refreshInterval: 30000,
  };

  // ========================================
  // STATUS DO SISTEMA (cabeçalho)
  // ========================================
  const StatusIndicator = {
    init() {
      this.dot = $('.status-dot');
      this.text = $('.status-text');
      this.updateStatus(navigator.onLine);
      window.addEventListener('online', () => this.updateStatus(true));
      window.addEventListener('offline', () => this.updateStatus(false));
      setInterval(() => this.checkHealth(), CONFIG.refreshInterval);
    },

    updateStatus(online) {
      if (this.dot) this.dot.style.background = online ? 'var(--color-primary)' : 'var(--color-danger)';
      if (this.text) this.text.textContent = online ? 'Sistema ativo' : 'Offline';
    },

    async checkHealth() {
      try {
        const r = await fetch('./health.json', { method: 'HEAD', cache: 'no-cache' });
        this.updateStatus(r.ok);
      } catch {
        this.updateStatus(false);
      }
    },
  };

  // ========================================
  // PAINEL DE ROTINAS E INTEGRAÇÕES
  // ========================================
  const StatusPanel = {
    init() {
      this.grid = $('#status-grid');
      if (!this.grid) return;
      this.render();
      // o feed recarrega sozinho a cada minuto; este painel acompanha o mesmo
      // manifesto, então basta re-renderizar quando ele mudar
      setInterval(() => this.render(), 60000);
    },

    async render() {
      if (!this.grid) return;
      let m;
      try {
        m = await F.carregar();
      } catch {
        this.grid.innerHTML = '<p class="load-state">Não foi possível carregar o status das rotinas.</p>';
        return;
      }
      const jobs = m.cron || [];
      if (!jobs.length) {
        this.grid.innerHTML =
          '<p class="feed-empty">Nenhuma rotina registrada ainda. ' +
          'Toda execução de cron publica seu status aqui.</p>';
        return;
      }
      // falhas primeiro: é um painel de incidentes, não uma lista alfabética
      const ordem = { falha: 0, pendente: 1, rodando: 2, ok: 3 };
      const ordenados = [...jobs].sort((a, b) =>
        (ordem[a.estado] ?? 9) - (ordem[b.estado] ?? 9) ||
        String(a.job).localeCompare(String(b.job)));
      this.grid.innerHTML = ordenados.map(F.statusCardHTML).join('');
    },
  };

  // ========================================
  // ESTATÍSTICAS GLOBAIS
  // ========================================
  const Stats = {
    init() {
      this.tiles = $$('[data-stat]');
      if (!this.tiles.length) return;
      F.carregar().then((m) => {
        const s = m.stats || {};
        const falhas = (m.cron || []).filter((j) => j.estado === 'falha').length;
        const pendentes = (m.cron || []).filter((j) => j.estado === 'pendente').length;
        this.pontuar('total', String(s.total ?? 0));
        this.pontuar('duracao', s.duracao_media_s != null ? F.duracao(s.duracao_media_s) : '—');
        this.pontuar('falhas', falhas || pendentes ? `${falhas} / ${pendentes}` : '0');
      }).catch(() => {});
      const el = $('#footer-atualizado');
      if (el) F.carregar().then((m) => { el.textContent = F.dataHora(m.gerado_em); }).catch(() => {});
    },

    pontuar(chave, valor) {
      const el = $(`[data-stat="${chave}"]`);
      if (el) el.textContent = valor;
    },
  };

  // ========================================
  // MÓDULOS E SUBSITES
  // ========================================
  const Modules = {
    init() {
      this.grid = $('#module-grid');
      this.subgrid = $('#subsite-grid');
      if (!this.grid) return;
      F.carregar().then((m) => {
        const contagens = (m.stats && m.stats.por_modulo) || {};
        this.grid.innerHTML = m.modulos.map((x) => `
          <button type="button" class="module-chip" data-modulo="${esc(x.id)}">
            <span class="module-chip-name">${esc(x.nome)}</span>
            <span class="module-chip-desc">${esc(x.descricao)}</span>
            <span class="module-chip-count">${contagens[x.id] || 0} publicações</span>
          </button>`).join('');

        $$('.module-chip').forEach((chip) => {
          chip.addEventListener('click', () => {
            const sel = $('#filtro-modulo');
            const alvo = chip.dataset.modulo;
            // clicar de novo no mesmo chip desliga o filtro
            if (sel && sel.value === alvo) {
              sel.value = '';
            } else if (sel) {
              sel.value = alvo;
            }
            if (F.Feed.estado) F.Feed.estado.modulo = sel ? sel.value : alvo;
            if (F.Feed.render) F.Feed.render();
            $$('.module-chip').forEach((c) =>
              c.classList.toggle('active', !!sel && c.dataset.modulo === sel.value));
            const feed = $('#feed');
            if (feed) feed.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        });

        if (this.subgrid) {
          this.subgrid.innerHTML = (m.subsites || [])
            .map(F.subsiteHTML).join('');
        }
      }).catch(() => {});
    },
  };

  // ========================================
  // NAVEGAÇÃO E SCROLL SPY
  // ========================================
  const SmoothScroll = {
    init() {
      $$('a[href^="#"]').forEach((a) => {
        a.addEventListener('click', (e) => {
          const href = a.getAttribute('href');
          if (href === '#') return;
          const alvo = $(href);
          if (!alvo) return;
          e.preventDefault();
          const y = alvo.getBoundingClientRect().top + window.pageYOffset - 148;
          window.scrollTo({ top: y, behavior: 'auto' });
          history.pushState(null, '', href);
        });
      });
    },
  };

  const ScrollSpy = {
    init() {
      this.sections = $$('section[id]');
      this.navLinks = $$('.nav-link[href^="#"]');
      if (!this.sections.length || !this.navLinks.length) return;
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.navLinks.forEach((link) => {
              const on = link.getAttribute('href') === `#${entry.target.id}`;
              link.classList.toggle('active', on);
              if (on) link.setAttribute('aria-current', 'page');
              else link.removeAttribute('aria-current');
            });
          }
        });
      }, { rootMargin: '-160px 0px -60% 0px', threshold: 0 });
      this.sections.forEach((s) => this.observer.observe(s));
    },
  };

  // ========================================
  // BOOT
  // ========================================
  function boot() {
    const componentes = [StatusIndicator, StatusPanel, Stats, Modules, SmoothScroll, ScrollSpy];
    componentes.forEach((c) => {
      try { if (c.init) c.init(); }
      catch (e) { console.error('[Central] falha ao iniciar componente:', e); }
    });

    // o feed é por último: os demais componentes só dependem do manifesto
    F.Feed.aposRender = (m) => {
      $$('.module-chip').forEach((c) =>
        c.classList.toggle('active', c.dataset.modulo === F.Feed.estado.modulo));
    };
    F.Feed.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.CentralApp = { CONFIG, boot };
})();
