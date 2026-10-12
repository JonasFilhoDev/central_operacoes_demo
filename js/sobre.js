/* sobre.js — lógica da página Sobre */
(function () {
  'use strict';

  const API_BASE = './data/';

  async function fetchJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }

  function $(sel, ctx = document) { return ctx.querySelector(sel); }
  function $$(sel, ctx = document) { return Array.from(ctx.querySelectorAll(sel)); }

  function setStat(id, value) {
    const el = document.querySelector(`[data-stat="${id}"]`);
    if (el) el.textContent = value;
  }

  function renderServices(services) {
    const grid = $('#services-grid');
    if (!grid) return;
    grid.innerHTML = services.map(s => `
      <article class="service-card">
        <div class="service-icon" aria-hidden="true">${s.icon}</div>
        <h3>${s.title}</h3>
        <p>${s.description}</p>
        <ul class="service-features">
          ${s.features.map(f => `<li>${f}</li>`).join('')}
        </ul>
        <a href="./portfolio.html?tag=${encodeURIComponent(s.tag)}" class="service-link">Ver exemplos →</a>
      </article>
    `).join('');
  }

  function renderSteps(steps) {
    const list = $('#steps-list');
    if (!list) return;
    list.innerHTML = steps.map((s, i) => `
      <li class="step-item">
        <span class="step-number">${i + 1}</span>
        <div class="step-content">
          <h3>${s.title}</h3>
          <p>${s.description}</p>
        </div>
      </li>
    `).join('');
  }

  function renderTech(tech) {
    const grid = $('#tech-grid');
    if (!grid) return;
    grid.innerHTML = tech.map(t => `
      <article class="tech-card">
        <h3>${t.title}</h3>
        <p>${t.description}</p>
      </article>
    `).join('');
  }

  async function init() {
    try {
      const [manifest, modules] = await Promise.all([
        fetchJSON(`${API_BASE}index.json`),
        fetchJSON(`${API_BASE}modules.json`)
      ]);

      // Stats
      if (manifest.stats) {
        setStat('posts', manifest.stats.total || manifest.stats.por_modulo?.conteudo || 0);
        setStat('formatos', 'Carrossel, Reel, Imagem única');
        setStat('rotinas', manifest.cron?.length || 0);
      }

      // Services baseados nos módulos reais + tags das publicações
      const tagsFromPosts = new Set();
      manifest.publicacoes?.forEach(p => p.tags?.forEach(t => tagsFromPosts.add(t)));

      const services = [
        {
          title: 'Carrosséis técnicos',
          description: 'Sequência de 3 a 6 slides explicando conceitos, processos ou dados técnicos.',
          icon: '☐',
          tag: 'carrossel',
          features: ['3 a 6 slides', 'Legenda otimizada', 'Verificação de corte e colisão', 'Acentuação conferida']
        },
        {
          title: 'Reels técnicos',
          description: 'Vídeos curtos (9-20s) com frames renderizados via Chromium + ffmpeg.',
          icon: '▶',
          tag: 'reel',
          features: ['9 a 20 segundos', 'Capa no frame 0', 'Legenda sincronizada', 'Share to feed']
        },
        {
          title: 'Imagens únicas',
          description: 'Uma ideia, um frame, texto curto — para anúncios e avisos pontuais.',
          icon: '■',
          tag: 'imagem unica',
          features: ['1080x1350', 'Texto curto', 'Sem carrossel', 'Publicação instantânea']
        },
        {
          title: 'Automação de publicação',
          description: 'Pipeline completo: agenda → gera → verifica → publica → registra.',
          icon: '⟳',
          tag: 'automacao',
          features: ['Crons 10h/14h/16h/20h', 'Verificação de colisão DOM', 'Logo e corte conferidos', 'Registro na Central']
        },
        {
          title: 'Integrações & Dashboards',
          description: 'Composio conecta Instagram, GitHub, Gmail, Drive, LinkedIn, ClickUp, Meta Ads.',
          icon: '⌬',
          tag: 'integracoes',
          features: ['1000+ toolkits', 'OAuth por toolkit', 'Proxy para APIs brutas', 'Health checks automáticos']
        },
        {
          title: 'Infraestrutura observável',
          description: 'VPS Oracle Always Free, nginx, TLS, Central de Operações com health checks.',
          icon: '☰',
          tag: 'infra',
          features: ['Always Free eligible', 'nginx + TLS', 'Tailscale private net', 'Backup diário no Drive']
        }
      ];

      renderServices(services);

      const steps = [
        { title: 'Agenda', description: 'Crons disparam nos horários definidos (10h, 14h, 16h, 20h BRT).' },
        { title: 'Gera', description: 'Escolhe tema, cria arte (carrossel, Reel ou imagem) e escreve legenda.' },
        { title: 'Verifica', description: 'Corte por pixel, colisão DOM, área do logo, acentuação — tudo automatizado.' },
        { title: 'Publica', description: 'Container → status FINISHED → publish → leitura de volta via Graph API.' },
        { title: 'Registra', description: 'Permalink, media_id, legenda, mídia e métricas na Central de Operações.' }
      ];
      renderSteps(steps);

      const tech = [
        { title: 'Orquestração', description: 'Hermes Agent (gateway, scheduler, crons, skills)' },
        { title: 'Integrações', description: 'Composio (Instagram, GitHub, Gmail, Drive, LinkedIn, ClickUp, Meta Ads)' },
        { title: 'IA & Geração', description: 'OpenRouter (Nemotron 3 Ultra, Gemini Flash Lite), Chromium headless' },
        { title: 'Infra', description: 'VPS Oracle Cloud (Always Free), nginx, TLS, Tailscale, GitHub Pages' },
        { title: 'Conteúdo', description: 'Instagram Graph API, Chromium headless (PNG/JPEG), ffmpeg (Reels)' },
        { title: 'Observabilidade', description: 'Central de Operações (feed, rotinas, módulos, status, health checks)' }
      ];
      renderTech(tech);

    } catch (e) {
      console.error('Erro ao carregar dados da página Sobre:', e);
      $$('.load-state').forEach(el => el.textContent = 'Erro ao carregar dados');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();