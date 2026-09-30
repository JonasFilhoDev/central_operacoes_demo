/**
 * Central de Operações Hermes - camada de dados e render do feed.
 *
 * Compartilhado por index.html (feed) e publicacao.html (página da publicação).
 *
 * REGRA DE OURO DESTE ARQUIVO: o manifesto data/index.json já vem ordenado do
 * mais recente para o mais antigo (ordem definida pelo publicador, em Python).
 * O front-end NUNCA reordena client-side sem um critério explícito do usuário —
 * reordenar por String(published) mistura fusos e quebra a exigência de "mais
 * recente primeiro".
 */

(function (global) {
  'use strict';

  const CONFIG = {
    manifest: './data/index.json',
    pagina: './publicacao.html',
    refreshMs: 60000,
  };

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  // ------------------------------------------------------------- utilidades

  /** HTML seguro: escapa tudo, evita injeção via título/resumo dos manifests. */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function semAcento(s) {
    return String(s || '')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')   // remove diacríticos combinantes
      .toLowerCase();
  }

  /** 2026-09-29T21:04:11Z -> "29/09/2026 21:04" */
  function dataHora(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    if (isNaN(d)) return ts;
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ` +
           `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
  }

  function duracao(s) {
    if (typeof s !== 'number') return null;
    if (s < 60) return `${s.toFixed(1)}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${String(Math.round(s - m * 60)).padStart(2, '0')}s`;
  }

  function tokens(n) {
    if (typeof n !== 'number') return null;
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
    return String(n);
  }

  /** Timestamp parseado, para ordenar de forma confiável. */
  function ts(pub) {
    const t = Date.parse(pub.publicado_em || '');
    return isNaN(t) ? 0 : t;
  }

  const ESTADOS = {
    ok:       { label: 'OK',        cls: 'badge-ok' },
    falha:    { label: 'Falhou',    cls: 'badge-falha' },
    pendente: { label: 'Pendente',  cls: 'badge-pendente' },
    rodando:  { label: 'Rodando',   cls: 'badge-rodando' },
  };

  // ------------------------------------------------------- markdown mínimo
  // Só o que aparece nos relatórios do agente. Sem HTML bruto: o texto é
  // escapado ANTES de virar tag, então não existe vetor de injeção.

  function inline(txt) {
    let s = esc(txt);
    s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/\[([^\]]+)\]\((https?:[^\s)]+)\)/g,
      (_, t, u) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`);
    return s;
  }

  function markdown(src) {
    if (!src) return '';
    const linhas = String(src).replace(/\r\n/g, '\n').split('\n');
    let html = '';
    let emLista = false, emCodigo = false, tabela = null;

    const fechaLista = () => { if (emLista) { html += '</ul>'; emLista = false; } };
    const fechaTabela = () => {
      if (tabela) {
        html += '</tbody></table>';
        tabela = null;
      }
    };

    for (let i = 0; i < linhas.length; i++) {
      const raw = linhas[i];
      const l = raw.trimEnd();

      // bloco de código
      if (/^```/.test(l.trim())) {
        fechaLista(); fechaTabela();
        html += emCodigo ? '</code></pre>' : '<pre><code>';
        emCodigo = !emCodigo;
        continue;
      }
      if (emCodigo) { html += esc(raw) + '\n'; continue; }

      if (!l.trim()) { fechaLista(); fechaTabela(); continue; }

      // tabela: "| a | b |" seguido de "| --- | --- |".
      // A próxima linha é lida pelo índice, e não por indexOf(linha) — conteúdo
      // repetido na tabela faria indexOf devolver a ocorrência errada.
      const proxima = linhas[i + 1] || '';
      if (/^\|/.test(l.trim()) && /^\|[\s:|-]+\|?\s*$/.test(proxima.trim())) {
        fechaLista();
        const cols = l.trim().slice(1, -1).split('|').map((c) => c.trim());
        if (!tabela) {
          html += `<table><thead><tr>${cols.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>`;
          tabela = cols;
        }
        continue;
      }
      if (tabela && /^\|/.test(l.trim())) {
        const cols = l.trim().slice(1, -1).split('|').map((c) => c.trim());
        html += `<tr>${cols.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`;
        continue;
      }
      fechaTabela();

      let m;
      if ((m = l.match(/^(#{1,4})\s+(.*)$/))) {
        fechaLista();
        const n = m[1].length;
        html += `<h${n}>${inline(m[2])}</h${n}>`;
      } else if ((m = l.match(/^\s*[-*]\s+(.*)$/))) {
        if (!emLista) { html += '<ul>'; emLista = true; }
        html += `<li>${inline(m[1])}</li>`;
      } else if ((m = l.match(/^\s*\d+[.)]\s+(.*)$/))) {
        if (!emLista) { html += '<ul>'; emLista = true; }
        html += `<li>${inline(m[1])}</li>`;
      } else if ((m = l.match(/^>\s?(.*)$/))) {
        fechaLista();
        html += `<blockquote>${inline(m[1])}</blockquote>`;
      } else {
        fechaLista();
        html += `<p>${inline(l)}</p>`;
      }
    }
    fechaLista(); fechaTabela();
    if (emCodigo) html += '</code></pre>';
    return html;
  }

  // ------------------------------------------------------------ dados

  let cache = null;

  async function carregar(forcar) {
    if (cache && !forcar) return cache;
    // cache:no-store porque o nginx já manda no-store; o parametro ?t= evita
    // que um proxy intermediário sirva um manifesto velho.
    const r = await fetch(`${CONFIG.manifest}?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!r.ok) throw new Error(`manifesto ${r.status}`);
    cache = await r.json();
    return cache;
  }

  // ------------------------------------------------------------ render

  function cardHTML(p) {
    const data = $('[data-nome-modulo="' + p.modulo + '"]');
    const nomeModulo = data ? data.dataset.nome : p.modulo;
    const url = p.pagina_dedicada ? `${CONFIG.pagina}?id=${encodeURIComponent(p.id)}` : null;

    const thumb = p.capa
      ? `<img src="/${esc(p.capa)}" alt="" loading="lazy" decoding="async">` +
        (p.n_midias > 1 ? `<span class="pub-thumb-count">${p.n_midias} mídias</span>` : '')
      : `<span class="pub-thumb-empty">${esc(p.tipo || 'registro')}</span>`;

    const meta = [];
    const d = duracao(p.duracao_s);
    if (d) meta.push(`<span class="pub-meta-item">duração <b>${esc(d)}</b></span>`);
    if (p.modelo) meta.push(`<span class="pub-meta-item">modelo <b>${esc(p.modelo)}</b></span>`);
    if (typeof p.provedor === 'string' && p.provedor) {
      meta.push(`<span class="pub-meta-item">via <b>${esc(p.provedor)}</b></span>`);
    }
    const tk = tokens(p.tokens_in);
    if (tk) {
      const sufixo = p.tokens_estimados ? '~' : '';
      meta.push(`<span class="pub-meta-item">tokens <b>${esc(tk)}${sufixo}</b></span>`);
    }
    if (typeof p.custo_usd === 'number') {
      meta.push(`<span class="pub-meta-item">custo <b>US$ ${p.custo_usd.toFixed(4)}</b></span>`);
    } else if (p.tokens_in != null) {
      meta.push('<span class="pub-meta-item">custo <b>—</b></span>');
    }
    if (p.tem_log) meta.push('<span class="pub-meta-item">log anexado</span>');

    const tags = (p.tags || []).slice(0, 3)
      .map((t) => `<span class="pub-tag">${esc(t)}</span>`).join('');

    // chips de busca: titulo + resumo + tags + modulo + job + tipo
    const busca = [p.titulo, p.resumo, p.modulo, p.tipo, p.job, ...(p.tags || [])]
      .filter(Boolean).map(semAcento).join(' ');

    const titulo = url
      ? `<a href="${url}">${esc(p.titulo)}</a>`
      : esc(p.titulo);

    return `<article class="pub-card" data-id="${esc(p.id)}" data-busca="${esc(busca)}"
                     data-modulo="${esc(p.modulo)}" data-ts="${ts(p)}">
      <a class="pub-thumb" ${url ? `href="${url}"` : ''}
         ${p.pagina_dedicada ? '' : 'aria-hidden="true" tabindex="-1"'}>
        ${thumb}
      </a>
      <div class="pub-body">
        <div class="pub-topline">
          <span class="pub-module">${esc(nomeModulo)}</span>
          <time class="pub-time" datetime="${esc(p.publicado_em)}">${esc(dataHora(p.publicado_em))}</time>
        </div>
        <h3 class="pub-title">${titulo}</h3>
        ${p.resumo ? `<p class="pub-resumo">${esc(p.resumo)}</p>` : ''}
        ${meta.length ? `<div class="pub-meta">${meta.join('')}</div>` : ''}
        <div class="pub-foot">
          <div class="pub-tags">${tags}</div>
          ${url ? `<a class="pub-open" href="${url}">Abrir →</a>` : '<span></span>'}
        </div>
      </div>
    </article>`;
  }

  function statusCardHTML(j) {
    const e = ESTADOS[j.estado] || ESTADOS.pendente;
    const quando = j.atualizado_em ? `atualizado ${dataHora(j.atualizado_em)}` : '';
    const partes = [];
    if (typeof j.ultima_duracao_s === 'number') partes.push(`duração ${duracao(j.ultima_duracao_s)}`);
    if (j.falhas_consecutivas) partes.push(`${j.falhas_consecutivas} falha(s) seguida(s)`);
    if (quando) partes.push(quando);
    if (j.proxima) partes.push(`próxima ${j.proxima}`);
    if (j.ultima_publicacao) {
      partes.push(`<a href="${CONFIG.pagina}?id=${encodeURIComponent(j.ultima_publicacao)}">ver execução</a>`);
    }
    return `<article class="status-card">
      <div class="status-card-head">
        <div>
          <h3 class="status-card-name">${esc(j.nome || j.job)}</h3>
          ${j.agenda ? `<p class="status-card-agenda">${esc(j.agenda)}</p>` : ''}
        </div>
        <span class="badge ${e.cls}">${e.label}</span>
      </div>
      ${j.mensagem ? `<p class="status-card-msg">${esc(j.mensagem)}</p>` : ''}
      <div class="status-card-foot">${partes.map((p) => `<span>${p}</span>`).join('')}</div>
    </article>`;
  }

  function subsiteHTML(s) {
    const pronto = s.status === 'ativo';
    return `<article class="subsite-card">
      <h3 class="subsite-host">${esc(s.host)}</h3>
      <p class="module-chip-desc">${esc(s.descricao || '')}</p>
      <div class="pub-foot">
        <span class="badge ${pronto ? 'badge-ok' : 'badge-outline'}">${esc(s.status)}</span>
        <span class="pub-module">${esc(s.nome)}</span>
      </div>
    </article>`;
  }

  // ------------------------------------------------------------ filtros

  const Feed = {
    estado: { q: '', modulo: '', ordem: 'recentes' },

    init(opcoes = {}) {
      this.grid = $(opcoes.grid || '#feed-grid');
      this.resumoEl = $(opcoes.resumo || '#feed-resumo');
      if (!this.grid) return;
      this.aplicarOpcoes(opcoes);
      this.carregar();
      setInterval(() => this.carregar(true), CONFIG.refreshMs);
    },

    opcoes: {},

    aplicarOpcoes({ selectModulo, selectOrdem, inputBusca, botaoLimpar }) {
      this.selectModulo = $(selectModulo || '#filtro-modulo');
      this.selectOrdem = $(selectOrdem || '#filtro-ordem');
      this.inputBusca = $(inputBusca || '#filtro-busca');
      this.botaoLimpar = $(botaoLimpar || '#filtro-limpar');

      // popular módulos a partir do manifesto, para que o filtro nunca ofereça
      // uma opção vazia
      if (this.selectModulo) {
        carregar().then((m) => {
          const sel = this.selectModulo;
          const atual = sel.value;
          sel.innerHTML = '<option value="">Todos os módulos</option>' +
            m.modulos.map((x) =>
              `<option value="${esc(x.id)}">${esc(x.nome)} (${m.stats.por_modulo[x.id] || 0})</option>`
            ).join('');
          sel.value = atual;
          this.estado.modulo = atual;
          if (this.inputBusca) this.inputBusca.value = this.estado.q;
          this.render();
        }).catch(() => {});
      }

      if (this.selectModulo) {
        this.selectModulo.addEventListener('change', (e) => {
          this.estado.modulo = e.target.value;
          this.render();
        });
      }
      if (this.selectOrdem) {
        this.selectOrdem.addEventListener('change', (e) => {
          this.estado.ordem = e.target.value;
          this.render();
        });
      }
      if (this.inputBusca) {
        let t;
        this.inputBusca.addEventListener('input', (e) => {
          clearTimeout(t);
          const v = e.target.value;
          t = setTimeout(() => { this.estado.q = v; this.render(); }, 120);
        });
      }
      if (this.botaoLimpar) {
        this.botaoLimpar.addEventListener('click', () => {
          this.estado = { q: '', modulo: '', ordem: this.estado.ordem };
          if (this.inputBusca) this.inputBusca.value = '';
          if (this.selectModulo) this.selectModulo.value = '';
          this.render();
        });
      }
    },

    async carregar(forcar) {
      try {
        const m = await carregar(forcar);
        this.manifesto = m;
        this.estado.modulo = this.selectModulo ? this.selectModulo.value : this.estado.modulo;
        this.estado.q = this.inputBusca ? this.inputBusca.value : this.estado.q;
        this.render();
        if (typeof this.aposRender === 'function') this.aposRender(m);
      } catch (e) {
        this.grid.innerHTML =
          `<p class="load-state">Não foi possível carregar o manifesto: ${esc(e.message)}</p>`;
      }
    },

    filtrar(pubs) {
      const { q, modulo } = this.estado;
      const alvo = semAcento(q.trim());
      return pubs.filter((p) => {
        if (modulo && p.modulo !== modulo) return false;
        if (alvo) {
          const card = p;
          const busca = [card.titulo, card.resumo, card.modulo, card.tipo, card.job,
                         ...(card.tags || [])]
            .filter(Boolean).map(semAcento).join(' ');
          if (!busca.includes(alvo)) return false;
        }
        return true;
      });
    },

    render() {
      if (!this.manifesto) return;
      const todas = this.manifesto.publicacoes || [];
      let visiveis = this.filtrar(todas);

      if (this.estado.ordem === 'antigas') {
        visiveis = [...visiveis].sort((a, b) => ts(a) - ts(b));
      } else if (this.estado.ordem === 'titulo') {
        visiveis = [...visiveis].sort((a, b) =>
          semAcento(a.titulo).localeCompare(semAcento(b.titulo), 'pt-BR'));
      }
      // 'recentes' (padrão) e 'antigas' não dependem da ordem do manifesto:
      // o manifesto já é mais-recente-primeiro, mas ordenar explicitamente por
      // timestamp garante o contrato mesmo se o manifesto vier de outra fonte.

      this.grid.innerHTML = visiveis.length
        ? visiveis.map(cardHTML).join('')
        : `<p class="feed-empty">Nenhuma publicação corresponde a este filtro.</p>`;

      if (this.resumoEl) {
        const filtrosAtivos = (this.estado.q ? 1 : 0) + (this.estado.modulo ? 1 : 0);
        this.resumoEl.textContent = filtrosAtivos
          ? `${visiveis.length} de ${todas.length} publicações`
          : `${todas.length} publicações · mais recentes primeiro`;
      }
    },
  };

  global.CentralFeed = {
    CONFIG, esc, semAcento, dataHora, duracao, tokens, ts,
    markdown, carregar, cardHTML, statusCardHTML, subsiteHTML, Feed,
    $: $, $$: $$,
  };

})(window);
