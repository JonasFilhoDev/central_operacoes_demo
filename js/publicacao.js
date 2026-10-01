/**
 * Central de Operações Hermes - página da publicação.
 *
 * Lê ?id=<publicação> e renderiza o conteúdo, as mídias embutidas e os
 * metadados operacionais. As mídias são servidas de /media/<id>/..., ou seja,
 * são vistas dentro da própria central, sem depender de link externo.
 */

(function () {
  'use strict';

  const F = window.CentralFeed;
  const $ = F.$;
  const esc = F.esc;

  const id = new URLSearchParams(location.search).get('id');

  /* ------------------------------------------------------------------
   * Visualizador de imagem.
   *
   * Antes, ver uma mídia maior exigia baixá-la. Agora a imagem abre em
   * sobreposição, com teclado funcionando: Enter abre, Esc fecha, setas
   * trocam de imagem quando há várias.
   *
   * Usa <dialog> nativo: o foco fica preso dentro dele, o Esc é do
   * navegador, e o fundo não rola. Isso evita reimplementar armadilha de
   * foco e aria-modal na mão.
   * ------------------------------------------------------------------ */
  const Visualizador = (function () {
    let dialog = null;
    let img = null;
    let legenda = null;
    let indice = 0;
    let grupo = [];
    let anteriorFoco = null;

    function garantir() {
      if (dialog) return;
      dialog = document.createElement('dialog');
      dialog.className = 'viz';
      dialog.innerHTML = `
        <button type="button" class="viz-fechar" aria-label="Fechar">&times;</button>
        <button type="button" class="viz-nav viz-ant" aria-label="Imagem anterior">&#8249;</button>
        <figure class="viz-figura">
          <img class="viz-img" alt="">
          <figcaption class="viz-legenda"></figcaption>
        </figure>
        <button type="button" class="viz-nav viz-prox" aria-label="Próxima imagem">&#8250;</button>`;
      document.body.appendChild(dialog);

      img = dialog.querySelector('.viz-img');
      legenda = dialog.querySelector('.viz-legenda');

      dialog.querySelector('.viz-fechar').addEventListener('click', fechar);
      dialog.querySelector('.viz-ant').addEventListener('click', () => mover(-1));
      dialog.querySelector('.viz-prox').addEventListener('click', () => mover(1));

      // clique no fundo (fora da figura) fecha; na figura, nao
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) fechar();
      });
      // setas navegam entre as imagens da mesma publicação
      dialog.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); mover(-1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); mover(1); }
      });
      // um clique/toque fora do <dialog> fecha (comportamento nativo do
      // Chromium antigo, mas explicito aqui para nao depender dele)
      dialog.addEventListener('close', () => {
        if (anteriorFoco && anteriorFoco.focus) anteriorFoco.focus();
      });
    }

    function mostrar(i) {
      const m = grupo[i];
      if (!m) return;
      img.src = '/' + m.path;
      img.alt = m.legenda || m.nome || '';
      legenda.textContent = m.legenda || m.nome || '';
      const varios = grupo.length > 1;
      legenda.dataset.contador = varios ? `${i + 1} / ${grupo.length}` : '';
      dialog.querySelector('.viz-nav').hidden = !varios;
    }

    function abrir(midias, i) {
      garantir();
      grupo = midias.filter((m) => tipoDeMidia(m) === 'image');
      if (!grupo.length) return;
      indice = i;
      mostrar(indice);
      anteriorFoco = document.activeElement;
      if (!dialog.open) dialog.showModal();
    }

    function fechar() {
      if (dialog && dialog.open) dialog.close();
    }

    function mover(delta) {
      if (!grupo.length) return;
      indice = (indice + delta + grupo.length) % grupo.length;
      mostrar(indice);
    }

    return { abrir, fechar };
  })();

  function tipoDeMidia(m) {
    // O tipo pode vir em ingles ("image", "video", "audio", valor que o
    // `--midia` grava por padrao) ou em portugues ("imagem", "video",
    // "audio"). Sem normalizar, uma midia com tipo em portugues caia no
    // `default` e aparecia como o nome do arquivo em texto, sem imagem.
    const t = String(m.tipo || '').toLowerCase();
    if (t === 'imagem' || t === 'image' || t === 'foto' || t === 'photo') return 'image';
    if (t === 'video' || t === 'vídeo') return 'video';
    if (t === 'audio' || t === 'áudio') return 'audio';
    return t;
  }

  function midiaHTML(m, indice, midias) {
    const src = '/' + m.path;
    const tipo = tipoDeMidia(m);
    let preview;
    switch (tipo) {
      case 'image':
        // a miniatura vira botao: abre no visualizador em vez de só
        // link para baixar. O botao e o que dá o foco e o papel acessivel.
        preview = `<button type="button" class="media-zoom" data-media="${indice}"
                   aria-label="Ampliar imagem: ${esc(m.legenda || m.nome || 'mídia')}">
                   <img src="${esc(src)}" alt="${esc(m.legenda || '')}"
                        loading="lazy" decoding="async"></button>`;
        break;
      case 'video':
        preview = `<video src="${esc(src)}" controls preload="metadata" playsinline></video>`;
        break;
      case 'audio':
        preview = `<audio src="${esc(src)}" controls preload="metadata"></audio>`;
        break;
      default:
        preview = `<span class="pub-thumb-empty">${esc(m.nome || 'arquivo')}</span>`;
    }
    const baixar = tipo === 'image' ? '' :
      `<a class="media-download" href="${esc(src)}" download>baixar</a>`;
    return `<figure class="media-item">
      ${preview}${baixar}
      <figcaption>${esc(m.legenda || m.nome || '')}</figcaption>
    </figure>`;
  }

  function ligaVisualizador(midias) {
    const botoes = document.querySelectorAll('.media-zoom');
    botoes.forEach((b) => {
      b.addEventListener('click', () => {
        Visualizador.abrir(midias, Number(b.dataset.media));
      });
    });
  }

  function operacionalHTML(p) {
    const itens = [];
    const push = (k, v) => { if (v !== null && v !== undefined && v !== '') itens.push(
      `<li><span class="k">${esc(k)}:</span> ${v}</li>`); };

    push('tipo', esc(p.tipo));
    push('módulo', esc(p.modulo));
    if (p.duracao_s !== undefined && p.duracao_s !== null) {
      push('duração', esc(F.duracao(p.duracao_s)));
    }
    if (p.modelo) push('modelo', esc(p.modelo));
    if (p.provedor) push('provedor', esc(p.provedor));
    if (p.tokens_in !== undefined && p.tokens_in !== null) {
      push('tokens', `${esc(F.tokens(p.tokens_in))} entrada` +
        (p.tokens_out ? ` / ${esc(F.tokens(p.tokens_out))} saída` : '') +
        (p.tokens_estimados ? ' <span class="k">(estimado)</span>' : ''));
    }
    if (typeof p.custo_usd === 'number') {
      push('custo', `US$ ${p.custo_usd.toFixed(4)}`);
    } else if (p.tokens_in !== undefined && p.tokens_in !== null) {
      push('custo', '<span class="k">sem preço cadastrado para o modelo</span>');
    }
    if (typeof p.meta_erros === 'number') push('erros', String(p.meta_erros));
    push('origem', esc(p.origem || '—'));
    if (p.job) push('rotina', esc(p.job));
    push('publicado', esc(F.dataHora(p.publicado_em)));
    push('id', esc(p.id));
    return itens.join('');
  }

  async function init() {
    if (!id) {
      $('#pub-status').textContent = 'Nenhuma publicação informada (falta ?id=).';
      return;
    }

    let manifesto;
    try {
      manifesto = await F.carregar(true);
    } catch (e) {
      $('#pub-status').textContent = `Falha ao carregar o manifesto: ${e.message}`;
      return;
    }

    const idx = (manifesto.publicacoes || []).findIndex((p) => p.id === id);
    if (idx === -1) {
      $('#pub-status').innerHTML =
        `Publicação <code>${esc(id)}</code> não encontrada no manifesto. ` +
        `<a href="/">Voltar ao feed</a>.`;
      return;
    }

    // o card traz o resumo; o corpo completo vem do arquivo da publicação
    const card = manifesto.publicacoes[idx];
    let full = null;
    try {
      const r = await fetch(`./data/publications/${encodeURIComponent(id)}.json?t=${Date.now()}`,
                           { cache: 'no-store' });
      if (r.ok) full = await r.json();
    } catch (e) {
      /* segue com o card: a página ainda mostra título, metadados e thumbnail */
    }

    const p = Object.assign({}, card, full || {});
    if (full && full.meta) p.meta_erros = full.meta.erros;

    const mod = (manifesto.modulos || []).find((m) => m.id === p.modulo);
    document.title = `${p.titulo} — Central de Operações`;

    $('#pub-status').hidden = true;
    $('#pub-grid').hidden = false;

    $('#pub-modulo').textContent = mod ? mod.nome : p.modulo;
    $('#pub-data').textContent = F.dataHora(p.publicado_em);
    $('#pub-data').setAttribute('datetime', p.publicado_em || '');
    $('#pub-tipo').textContent = p.tipo || 'registro';
    $('#pub-titulo').textContent = p.titulo;

    const meta = [];
    meta.push(`publicado em ${F.dataHora(p.publicado_em)}`);
    if (p.duracao_s !== undefined && p.duracao_s !== null) {
      meta.push(`duração ${F.duracao(p.duracao_s)}`);
    }
    if (p.modelo) meta.push(`modelo ${p.modelo}`);
    if (p.provedor) meta.push(`via ${p.provedor}`);
    if (typeof p.custo_usd === 'number') meta.push(`custo US$ ${p.custo_usd.toFixed(4)}`);
    if (p.job) meta.push(`rotina ${p.job}`);
    $('#pub-meta').innerHTML = meta.map((t) => `<span>${esc(t)}</span>`).join('');

    const corpo = full ? full.corpo : (card.resumo || '');
    $('#pub-conteudo').innerHTML = F.markdown(corpo) ||
      '<p class="pub-resumo">Esta publicação não tem corpo em markdown.</p>';

    const mids = (full && full.midias) || (p.capa ? [{ path: p.capa, tipo: 'image', nome: '' }] : []);
    if (mids.length) {
      $('#pub-midia').innerHTML =
        `<h2 class="aside-title" style="margin-top: var(--space-huge);">Mídias</h2>
         <div class="media-gallery">${mids.map((m, i) => midiaHTML(m, i, mids)).join('')}</div>`;
      ligaVisualizador(mids);
    }

    if ((p.tags || []).length) {
      $('#pub-tags').innerHTML = p.tags
        .map((t) => `<span class="pub-tag">${esc(t)}</span>`).join('');
    }

    const links = (full && full.links) || [];
    const log = full && full.log;
    if (links.length || log) {
      const bloco = [];
      links.forEach((l) => bloco.push(
        `<div><a href="${esc(l.url)}" target="_blank" rel="noopener" class="pub-open">${esc(l.label)} →</a></div>`));
      if (log) bloco.push(`<div><a href="/${esc(log)}" target="_blank" rel="noopener" class="pub-open">Log da execução →</a></div>`);
      $('#pub-links').innerHTML = bloco.join('');
    }

    $('#pub-operacional').innerHTML = operacionalHTML(p);

    // publicações anteriores = as mais recentes do mesmo módulo
    const irmas = (manifesto.publicacoes || [])
      .filter((x) => x.modulo === p.modulo && x.id !== p.id)
      .slice(0, 8);
    $('#pub-anteriores').innerHTML = irmas.length
      ? irmas.map((x) => `<li><a href="?id=${encodeURIComponent(x.id)}">${esc(x.titulo)}</a>
          <span class="k">${esc(F.dataHora(x.publicado_em))}</span></li>`).join('')
      : '<li class="k">nenhuma outra publicação neste módulo</li>';
  }

  document.addEventListener('DOMContentLoaded', init);
})();
