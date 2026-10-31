# SimulaBolsa

Aplicação estática e responsiva, em português, com simulador de compra e venda de ações e FIIs e uma área local para gerenciar posições, proventos e relatórios da carteira.

## Estrutura

```text
.
├── .github/workflows/deploy-pages.yml  # publicação automática no GitHub Pages
├── scripts/write-quote-config.mjs      # configura a URL pública do Worker durante a publicação
├── public/
│   ├── assets/
│   │   ├── css/styles.css               # tema e layout responsivo
│   │   └── js/
│   │       ├── calculator.js            # cálculos, sem dependência do DOM
│   │       ├── formatters.js             # conversão e formatação de valores
│   │       ├── main.js                   # eventos do simulador
│   │       ├── portfolio.js              # cadastro e resumo das posições
│   │       ├── portfolio-insights.js     # proventos, relatórios e cotações
│   │       ├── quotes.js                  # cliente público do proxy de cotações
│   │       └── config.js                  # URL do proxy, gerada no deploy
│   ├── favicon.svg
│   ├── carteira.html                     # gerenciamento da carteira
│   └── index.html
├── worker/
│   ├── package.json                       # comandos locais do Worker
│   ├── src/index.js                       # proxy com chave server-side
│   └── wrangler.jsonc                     # configuração do Cloudflare Worker
└── README.md
```

O site não usa framework, bibliotecas externas nem etapas de compilação. A interface não carrega fontes externas; a página da carteira consulta cotações na brapi quando o usuário solicita. A chamada autenticada ocorre no Cloudflare Worker e não no navegador. Scripts adiados mantêm a lógica separada da interface e também permitem abrir o simulador localmente. Os valores monetários são calculados em centavos inteiros.

## Visualizar localmente

Para abrir diretamente, use o `index.html` da raiz; ele encaminha para a página em `public/`. Se preferir testar por um servidor local e tiver Python instalado, execute na pasta do projeto:

```bash
python -m http.server 8000 --directory public
```

Depois acesse `http://localhost:8000`.

## Publicar no GitHub Pages

O workflow em `.github/workflows/deploy-pages.yml` publica o conteúdo de `public/` no GitHub Pages e, quando as credenciais de deploy da Cloudflare estão configuradas, publica também o proxy de cotações. Ele roda em pushes para `main` e pode ser iniciado manualmente pela aba **Actions**.

1. Crie um repositório no GitHub e envie este projeto para a branch `main`.
2. No repositório, abra **Settings → Pages**.
3. Em **Build and deployment → Source**, selecione **GitHub Actions**.
4. Para publicar o proxy, cadastre `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` como secrets do GitHub Actions. Crie o token Cloudflare com permissão de editar Workers e limite-o à conta usada neste projeto.
5. Acompanhe a execução do workflow na aba **Actions**. Quando o Worker é publicado, o workflow injeta a URL dele no site; sem os secrets Cloudflare, a publicação do site continua funcionando, mas apenas os tickers públicos de demonstração podem ser consultados.
6. No painel da Cloudflare, abra o Worker `simulabolsa-quotes` e adicione em **Settings → Variables and Secrets** um secret chamado `BRAPI_TOKEN`. A chave da brapi fica somente no Cloudflare Worker; nunca a coloque em arquivos, no JavaScript público ou em mensagens.

O caminho público padrão será `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`. O workflow publica apenas `public/`, mantendo os arquivos de configuração e documentação fora do site.

## Premissas da estimativa

- A quantidade considera unidades inteiras e usa todo o capital possível pelo preço informado.
- Os custos informados são descontados do resultado antes da estimativa de imposto.
- As alíquotas usadas são 15% para ações em operação comum e 20% para day trade e ganhos na venda de cotas de FIIs.
- A isenção mensal estimada de até R$ 20 mil considera a soma do valor desta venda com as outras vendas comuns de ações informadas.
- Um prejuízo anterior só deve ser preenchido quando for compensável para a mesma categoria de ativo e modalidade.
- A simulação não consolida lucros e prejuízos de outras operações, não calcula IRRF, DARF, proventos, corretagem discriminada ou situações fiscais específicas.

## Carteira

A página `public/carteira.html` permite cadastrar, editar e remover posições de ações e FIIs, registrar recebimentos de rendimentos, dividendos e JCP, consultar um resumo por período, comparar o resultado em aberto por ativo e exportar os proventos filtrados em CSV. As vendas encerradas não são registradas, então o resultado da carteira representa lucro ou prejuízo não realizado.

Posições e proventos ficam no armazenamento local do navegador; não são enviados a um servidor, não sincronizam entre dispositivos e podem ser apagados ao limpar os dados do navegador. O registro de proventos é manual e guarda o valor total recebido e a data de pagamento.

O painel consulta `GET /api/v2/stocks/quote` com o parâmetro `symbols`, agrupando até 20 tickers por chamada; ativos acima desse limite seguem em lotes adicionais. A rota também fornece cotações básicas de FIIs. O Cloudflare Worker lê o secret `BRAPI_TOKEN` e envia `Authorization: Bearer <token>` à brapi. A página não recebe nem persiste a chave. Sem Worker configurado, a página usa a consulta pública sem chave apenas para PETR4, VALE3, MGLU3 e ITUB4. A atualização é manual e lida com respostas sem preço, tickers não encontrados, token inválido e limites 429; a proteção do Worker aplica um limite aproximado de 30 chamadas por minuto por IP e localidade Cloudflare, e a interface respeita `Retry-After` antes de liberar outra tentativa.

Para desenvolver o Worker localmente, crie `worker/.dev.vars` com `BRAPI_TOKEN="sua-chave"` e execute `npx wrangler@4 dev` dentro de `worker/`. `.dev.vars` é ignorado pelo Git. Não compartilhe nem versione esse arquivo. A API da brapi fornece cotações com atraso conforme o plano; confira a [frequência e o atraso](https://brapi.dev/faq/qual-a-frequencia) antes de interpretar os horários.

As regras tributárias podem mudar. Consulte as [orientações da Receita Federal para bolsa](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/renda-variavel/bolsa-de-valores-1/bolsa-de-valores), as [regras de isenção](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/renda-variavel/bolsa-de-valores-1/isencoes) e as [regras para FIIs](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/renda-variavel/fundos-de-investimento-no-brasil). A ferramenta é educativa e não substitui apuração fiscal nem orientação profissional.
