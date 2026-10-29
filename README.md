# SimulaBolsa

Simulador estático e responsivo, em português, para estimar uma operação de compra e venda de ações ou cotas de FIIs. Exibe quantidade inteira, capital aplicado, sobra do orçamento, resultado líquido, estimativa de IR e cenários de preço.

## Estrutura

```text
.
├── .github/workflows/deploy-pages.yml  # publicação automática no GitHub Pages
├── public/
│   ├── assets/
│   │   ├── css/styles.css               # tema e layout responsivo
│   │   └── js/
│   │       ├── calculator.js            # cálculos, sem dependência do DOM
│   │       ├── formatters.js             # conversão e formatação de valores
│   │       ├── main.js                   # eventos do simulador
│   │       └── portfolio.js              # cadastro e resumo da carteira
│   ├── favicon.svg
│   ├── carteira.html                     # gerenciamento da carteira
│   └── index.html
└── README.md
```

O projeto não usa framework, bibliotecas externas, etapas de compilação ou fontes remotas. Scripts adiados mantêm a lógica separada da interface e também permitem abrir o simulador localmente. Os valores monetários são calculados em centavos inteiros.

## Visualizar localmente

Para abrir diretamente, use o `index.html` da raiz; ele encaminha para a página em `public/`. Se preferir testar por um servidor local e tiver Python instalado, execute na pasta do projeto:

```bash
python -m http.server 8000 --directory public
```

Depois acesse `http://localhost:8000`.

## Publicar no GitHub Pages

O workflow em `.github/workflows/deploy-pages.yml` publica automaticamente o conteúdo de `public/` quando há um push na branch `main`. Ele também pode ser iniciado manualmente pela aba **Actions**.

1. Crie um repositório no GitHub e envie este projeto para a branch `main`.
2. No repositório, abra **Settings → Pages**.
3. Em **Build and deployment → Source**, selecione **GitHub Actions**.
4. Acompanhe a execução do workflow na aba **Actions**. Ao concluir, o GitHub mostrará o endereço publicado.

O caminho público padrão será `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`. O workflow publica apenas `public/`, mantendo os arquivos de configuração e documentação fora do site.

## Premissas da estimativa

- A quantidade considera unidades inteiras e usa todo o capital possível pelo preço informado.
- Os custos informados são descontados do resultado antes da estimativa de imposto.
- As alíquotas usadas são 15% para ações em operação comum e 20% para day trade e ganhos na venda de cotas de FIIs.
- A isenção mensal estimada de até R$ 20 mil considera a soma do valor desta venda com as outras vendas comuns de ações informadas.
- Um prejuízo anterior só deve ser preenchido quando for compensável para a mesma categoria de ativo e modalidade.
- A simulação não consolida lucros e prejuízos de outras operações, não calcula IRRF, DARF, proventos, corretagem discriminada ou situações fiscais específicas.

## Carteira

A página `public/carteira.html` permite cadastrar, editar e remover posições de ações e FIIs, atualizar preços manualmente e acompanhar valores e resultados. Os dados são guardados no armazenamento local do navegador e não são enviados a um servidor; eles não sincronizam entre dispositivos e podem ser apagados ao limpar os dados do navegador.

As regras tributárias podem mudar. Consulte as [orientações da Receita Federal para bolsa](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/renda-variavel/bolsa-de-valores-1/bolsa-de-valores), as [regras de isenção](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/renda-variavel/bolsa-de-valores-1/isencoes) e as [regras para FIIs](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/renda-variavel/fundos-de-investimento-no-brasil). A ferramenta é educativa e não substitui apuração fiscal nem orientação profissional.
