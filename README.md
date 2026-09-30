# Central de Operações

Painel operacional que roda em servidor próprio e recebe, sozinho, o resultado do
que um agente de IA produz ao longo do dia.

A instância real vive em `agentjj.com.br`, com nginx, TLS, autenticação e publicação
automatizada. **Este repositório é a vitrine pública**: o mesmo código, servindo dados
de demonstração, para que recrutadores e amigos possam abrir e navegar sem credencial.

---

## Quem fez

Este projeto foi feito em par, com dois papéis distintos:

**Jonas Francisco de Lima Filho** — autor do sistema e das decisões. Definiu a
arquitetura, o que a Central deveria mostrar, quais módulos fazer sentido e onde cada
informação aparece. É o que opera a instância de produção.

**Alfred** — o agente autônomo que Jonas criou, e que implementou o sistema ao lado
dele. Escreveu o código do portal, os scripts de deploy e as rotinas; escreveu a
análise que está publicada aqui; mantém a base de contexto que registra as decisões.

A divisão é real e vale dizer: o código é do Alfred, a decisão sobre o que deve existir
é do Jonas. Um sistema assim não é escrito — é decidido antes de ser escrito.

## O que a Central faz

A Central é o ponto onde o trabalho do agente se torna visível. O agente executa
rotinas, produz análises e relatórios; a Central é onde esse resultado aparece
organizado por módulo.

O portal tem nove módulos, e o que cada um agrupa está em `data/modules.json`. O
manifesto `data/index.json` é a fonte única: o `index.html` busca esse arquivo e
monta o painel inteiro a partir dele. Não há back-end — tudo é HTML, CSS e JavaScript
lendo JSON estático.

O fluxo de uma publicação:

```
rotina executa  →  publica JSON em data/publications/
                →  atualiza data/index.json (manifesto)
                →  o painel busca o manifesto e renderiza
```

Uma publicação pode ter página dedicada, com o corpo em Markdown renderizado, e
mídias anexadas. É o formato que a análise do Composio, abaixo, usa.

## Como a instância real é publicada

Todo deploy é um comando:

```bash
cd /var/www/central_operacoes
./scripts/deploy.sh "mensagem do commit"
```

O worktree do git **é** o webroot do nginx. O script faz, nesta ordem: commit →
sincroniza as tags de versão dos assets → smoke test → push. A verificação roda
**antes** do push, então um deploy quebrado não chega ao GitHub.

Duas decisões que valem explicar:

**Os assets são versionados por commit.** O HTML referencia
`css/style.css?v=<short-sha>`, e o sha é o do commit que mudou o arquivo. É o que
permite cache de um ano nos assets sem nunca servir versão velha.

**A credencial de deploy não está no repositório.** Vive em `~/.site_auth`, com modo
600, fora da árvore do git. Passar a senha pela linha de comando a colocaria no
histórico do shell e visível em `ps` para qualquer usuário da máquina.

Esses dois scripts não estão nesta vitrine — são infraestrutura da instância real.

## O que dá para ver aqui

**A análise do Composio** — a única publicação com corpo completo. São 7.819
caracteres sobre a camada de integração do agente: 1.000 toolkits e 40.702 tools
mapeados contra as demandas reais, com o estado de cada conta verificado por leitura
direta, não por estimativa. Está no painel, e tem página própria.

**Os nove módulos** e o painel de rotinas, com histórico de execução e estado.

## Limites desta versão

A vitrine não é a instância real, e o que ela não tem está listado aqui em vez de
fingir que existe:

- **Sem endpoint `/health`.** Na instância real existe, e o painel consulta para
  mostrar o status do sistema. Aqui é um arquivo estático.
- **Sem logs de execução.** O painel de rotinas na instância real mostra o log de
  cada execução; aqui só o estado.
- **Sem subdomínios.** A instância real tem módulos em `ads.agentjj.com.br`,
  `gestao.agentjj.com.br` e `briefing.agentjj.com.br`. Esses nomes foram removidos
  desta cópia de propósito: são infraestrutura interna, e publicar o mapa não
  acrescenta nada para quem só quer ver o projeto.
- **Dados de demonstração.** As rotinas e estatísticas aqui são de exemplo. As da
  instância real refletem o estado verdadeiro, inclusive as falhas.

Por isso a instância real não é pública: ela tem credencial de deploy, logs de
execução e dados operacionais, e nenhum dos três pertence a um repositório aberto.

## A vitrine é gerada, não editada à mão

Este repositório **não** se edita direto. Um script gera a vitrine a partir da
instância real:

```bash
~/hermes_tools/gerar_vitrine.sh
```

O script lê o repositório privado e escreve aqui, sempre num sentido só. Ele copia os
arquivos estáticos, leva só as publicações que se sustentam sozinhas, regenera os
manifestos com dados de demonstração, converte os caminhos absolutos em relativos
para o GitHub Pages resolver o subdiretório, e no fim confere que o repositório
privado não mudou de HEAD.

Se algo aqui parece errado, o lugar para corrigir é o gerador — não este repositório.

## Verificação

```bash
python3 ~/hermes_tools/verificar_vitrine.py
```

Sobe um servidor estático em subdiretório, como o GitHub Pages faz, e confere que
todos os assets respondem 200, que não sobrou caminho absoluto, que o manifesto não
carrega subdomínio e que a nota sobre a versão privada está no `index.html`.

## Stack

HTML, CSS e JavaScript sem framework, Python e Bash nos scripts, nginx servindo com
TLS e autenticação básica, Git para versionamento, Ubuntu Server na Oracle Cloud.

O JavaScript não usa biblioteca de front-end nem de Markdown: o renderizador de
Markdown do visualizador de publicações são ~40 linhas em `js/feed.js`. O painel
inteiro são três arquivos, sem build.

---

**Jonas Francisco de Lima Filho** — [GitHub](https://github.com/JonasFilhoDev) ·
[LinkedIn](https://www.linkedin.com/in/jonasfilhodev) · [jonasfilho.dev.br](https://jonasfilho.dev.br)
