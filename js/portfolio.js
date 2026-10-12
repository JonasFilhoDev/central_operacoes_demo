/* portfolio.js — lógica da página Portfólio */
(function () {
  'use strict';

  function byId(id) { return document.getElementById(id); }

  var allPosts = [];
  var filteredPosts = [];

  function initFilters() {
    var busca = document.getElementById('portfolio-busca');
    var formato = document.getElementById('filtro-formato');
    var ordem = document.getElementById('filtro-ordem');
    var limpar = document.getElementById('filtro-limpar');

    if (busca) busca.addEventListener('input', applyFilters);
    if (formato) formato.addEventListener('change', applyFilters);
    if (ordem) ordem.addEventListener('change', applyFilters);
    var limparBtn = document.getElementById('filtro-limpar');
    if (limparBtn) limparBtn.addEventListener('click', clearFilters);
  }

  function clearFilters() {
    var busca = document.getElementById('portfolio-busca');
    var formato = document.getElementById('filtro-formato');
    var ordem = document.getElementById('filtro-ordem');
    if (busca) busca.value = '';
    if (formato) formato.value = '';
    if (ordem) ordem.value = 'recentes';
    applyFilters();
  }

  function applyFilters() {
    var buscaEl = document.getElementById('portfolio-busca');
    var formatoEl = document.getElementById('filtro-formato');
    var ordemEl = document.getElementById('filtro-ordem');
    var q = (buscaEl?.value || '').toLowerCase().trim();
    var fmt = formatoEl?.value || '';
    var ord = ordemEl?.value || 'recentes';

    filteredPosts = allPosts.filter(function(p) {
      if (q && !p.titulo.toLowerCase().includes(q) &&
          !(p.resumo || '').toLowerCase().includes(q) &&
          !(p.tags || []).some(function(t) { return t.toLowerCase().includes(q); })) {
        return false;
      }
      if (fmt && p.formato !== fmt) return false;
      return true;
    });

    filteredPosts.sort(function(a, b) {
      var da = new Date(a.publicado_em || 0);
      var db = new Date(b.publicado_em || 0);
      if (ord === 'recentes') return db - da;
      if (ord === 'antigas') return da - db;
      return a.titulo.localeCompare(b.titulo);
    });

    renderGrid();
    updateSummary();
  }

  function updateSummary() {
    var el = document.getElementById('portfolio-resumo');
    if (!el) return;
    var total = allPosts.length;
    var showing = filteredPosts.length;
    if (total === showing) {
      el.textContent = total + ' publicação' + (total !== 1 ? 'ões' : '');
    } else {
      el.textContent = showing + ' de ' + total + ' publicação' + (total !== 1 ? 'ões' : '');
    }
  }

  function renderGrid() {
    var gridEl = document.getElementById('portfolio-grid');
    if (!gridEl) return;

    if (filteredPosts.length === 0) {
      gridEl.innerHTML = '<p class="load-state">Nenhuma publicação encontrada com esses filtros.</p>';
      return;
    }

    var cardsHtml = filteredPosts.map(function(p) {
      var capa = p.capa || (p.midias && p.midias[0]?.url) || '';
      var formatoLabel = p.formato || (p.tipo === 'carrossel' ? 'CARROSSEL' : p.tipo === 'reel' ? 'REEL' : 'IMAGEM UNICA');
      var data = p.publicado_em ? new Date(p.publicado_em).toLocaleDateString('pt-BR') : '';
      var tagsHtml = (p.tags || []).slice(0, 4).map(function(t) {
        return '<span class="tag">' + t + '</span>';
      }).join('');
      var thumbHtml = capa
        ? '<div class="portfolio-thumb" style="background-image:url(\'' + capa + '\')"></div>'
        : '<div class="portfolio-thumb placeholder"></div>';

      return '<article class="portfolio-card" data-id="' + p.id + '">' +
        thumbHtml +
        '<div class="portfolio-body">' +
        '<div class="portfolio-meta">' +
        '<span class="portfolio-format">' + formatoLabel + '</span>' +
        '<time class="portfolio-date">' + data + '</time>' +
        '</div>' +
        '<h3 class="portfolio-title">' + p.titulo + '</h3>' +
        '<p class="portfolio-excerpt">' + (p.resumo || '').slice(0, 160) + ((p.resumo || '').length > 160 ? '…' : '') + '</p>' +
        '<div class="portfolio-tags">' + tagsHtml + '</div>' +
        '<a href="./publicacao.html?id=' + p.id + '" class="portfolio-link">Ver detalhes →</a>' +
        '</div>' +
        '</article>';
    }).join('');

    var gridEl = document.getElementById('portfolio-grid');
    if (gridEl) gridEl.innerHTML = cardsHtml;
  }

  function updateSummary() {
    var el = document.getElementById('portfolio-resumo');
    if (!el) return;
    var total = allPosts.length;
    var showing = filteredPosts.length;
    if (total === showing) {
      el.textContent = total + ' publicação' + (total !== 1 ? 'ões' : '');
    } else {
      el.textContent = showing + ' de ' + total + ' publicação' + (total !== 1 ? 'ões' : '');
    }
  }

  function init() {
    fetch('./data/index.json')
      .then(function(r) { return r.json(); })
      .then(function(manifest) {
        allPosts = manifest.publicacoes || [];
        allPosts.forEach(function(p) {
          p.formato = p.formato || (p.tipo === 'carrossel' ? 'CARROSSEL' : p.tipo === 'reel' ? 'REEL' : 'IMAGEM UNICA');
        });
        filteredPosts = allPosts.slice();
        initFilters();
        applyFilters();
      })
      .catch(function(e) {
        console.error('Erro ao carregar portfólio:', e);
        var grid = document.getElementById('portfolio-grid');
        if (grid) grid.innerHTML = '<p class="load-state">Erro ao carregar portfólio.</p>';
      });
  }

  function initFilters() {
    var busca = document.getElementById('portfolio-busca');
    var formato = document.getElementById('filtro-formato');
    var ordem = document.getElementById('filtro-ordem');
    var limpar = document.getElementById('filtro-limpar');

    if (busca) busca.addEventListener('input', applyFilters);
    if (formato) formato.addEventListener('change', applyFilters);
    if (ordem) ordem.addEventListener('change', applyFilters);
    var limparBtn = document.getElementById('filtro-limpar');
    if (limparBtn) limparBtn.addEventListener('click', clearFilters);
  }

  function clearFilters() {
    var busca = document.getElementById('portfolio-busca');
    var formato = document.getElementById('filtro-formato');
    var ordem = document.getElementById('filtro-ordem');
    if (busca) busca.value = '';
    if (formato) formato.value = '';
    if (ordem) ordem.value = 'recentes';
    applyFilters();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();