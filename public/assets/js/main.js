(() => {
const {
  ASSETS,
  OPERATIONS,
  SCENARIOS,
  calculateOperation,
  calculateScenarios,
} = window.SimulaBolsa.calculator;
const {
  formatMoney,
  formatNumber,
  formatSignedMoney,
  formatSignedPercent,
  toCents,
} = window.SimulaBolsa.formatters;

const $ = (id) => document.getElementById(id);
const scenarioRows = createScenarioRows();

function selectedValue(name) {
  return document.querySelector(`input[name="${name}"]:checked`).value;
}

function readInputs() {
  return {
    asset: selectedValue('asset'),
    operation: selectedValue('operation'),
    capitalCents: toCents($('capital').value),
    buyPriceCents: toCents($('buy').value),
    sellPriceCents: toCents($('sell').value),
    costsCents: toCents($('costs').value),
    otherMonthlySalesCents: toCents($('otherSales').value),
    eligibleLossCents: $('useLoss').checked ? toCents($('loss').value) : 0,
  };
}

function createScenarioRows() {
  const fragment = document.createDocumentFragment();

  const rows = SCENARIOS.map(({ label }) => {
    const row = document.createElement('article');
    row.className = 'scenario-row';
    row.setAttribute('role', 'listitem');

    const scenario = document.createElement('div');
    scenario.className = 'scenario-name';
    const title = document.createElement('span');
    title.textContent = label;
    const price = document.createElement('small');
    scenario.append(title, price);

    const result = document.createElement('strong');
    result.className = 'scenario-result';
    const returnValue = document.createElement('span');
    returnValue.className = 'scenario-return';

    row.append(scenario, result, returnValue);
    fragment.append(row);
    return { price, result, returnValue };
  });

  $('scenarios').replaceChildren(fragment);
  return rows;
}

function updateScenarioResults(input) {
  const scenarios = calculateScenarios(input);

  scenarios.forEach((scenario, index) => {
    const row = scenarioRows[index];
    row.price.textContent = `Venda a ${formatMoney(Math.round(input.buyPriceCents * scenario.multiplier))}`;
    row.result.textContent = formatSignedMoney(scenario.netResultCents);
    row.returnValue.textContent = formatSignedPercent(scenario.returnPercent);
    row.result.classList.toggle('is-negative', scenario.netResultCents < 0);
    row.returnValue.classList.toggle('is-negative', scenario.netResultCents < 0);
  });
}

function taxDescription(input, result) {
  if (input.asset === ASSETS.FIIS) {
    return {
      note: `Alíquota estimada: ${(result.taxRate * 100).toFixed(0)}%`,
      notice: input.operation === OPERATIONS.DAY_TRADE
        ? 'Day trade com FIIs: estimativa de 20% sobre o ganho tributável. Não inclui IRRF retido nem apuração consolidada do mês.'
        : 'FIIs: estimativa de 20% sobre o ganho tributável na venda. Cotas de FIIs não têm a isenção mensal de R$ 20 mil.',
      warning: true,
    };
  }

  if (input.operation === OPERATIONS.DAY_TRADE) {
    return {
      note: `Alíquota estimada: ${(result.taxRate * 100).toFixed(0)}%`,
      notice: 'Day trade: estimativa de 20% sobre o ganho tributável. Não inclui IRRF retido nem apuração consolidada do mês.',
      warning: true,
    };
  }

  if (result.exemptionApplied) {
    return {
      note: 'Isenção estimada aplicada',
      notice: 'Vendas de ações informadas até R$ 20 mil: isenção estimada para operação comum. Lucros e prejuízos das demais operações do mês não entram nesta conta.',
      warning: false,
    };
  }

  return {
    note: `Alíquota estimada: ${(result.taxRate * 100).toFixed(0)}%`,
    notice: 'Vendas mensais informadas acima de R$ 20 mil: estimativa de 15% neste resultado. A apuração consolidada das demais operações não está incluída.',
    warning: true,
  };
}

function render(input) {
  const result = calculateOperation(input);
  const tax = taxDescription(input, result);
  const isNegative = result.netResultCents < 0;

  $('quantity').textContent = formatNumber(result.quantity);
  $('invested').textContent = formatMoney(result.investedCents);
  $('remaining').textContent = `${formatMoney(result.remainingCents)} não investidos`;
  $('revenue').textContent = formatMoney(result.revenueCents);
  $('tax').textContent = formatMoney(result.taxCents);
  $('taxNote').textContent = tax.note;
  $('netResult').textContent = formatSignedMoney(result.netResultCents);
  $('netResult').classList.toggle('is-negative', isNegative);
  $('returnPercent').textContent = formatSignedPercent(result.returnPercent);
  $('returnPercent').classList.toggle('is-negative', isNegative);
  $('preTaxResult').textContent = formatSignedMoney(result.resultBeforeTaxCents);
  $('estimatedWealth').textContent = formatMoney(result.estimatedWealthCents);

  const status = $('resultStatus');
  status.textContent = isNegative ? 'PREJUÍZO' : result.netResultCents === 0 ? 'EMPATE' : 'LUCRO';
  status.classList.toggle('is-negative', isNegative);

  $('resultMeter').style.width = `${Math.min(100, Math.abs(result.returnPercent))}%`;
  $('resultMeter').classList.toggle('is-negative', isNegative);
  $('taxNotice').textContent = tax.notice;
  $('taxNotice').classList.toggle('is-warning', tax.warning);

  updateScenarioResults(input);
  return result;
}

function updateConditionalFields() {
  const isCommonStockOperation = selectedValue('asset') === ASSETS.STOCKS
    && selectedValue('operation') === OPERATIONS.COMMON;
  $('stockFields').hidden = !isCommonStockOperation;
  $('lossField').hidden = !$('useLoss').checked;
}

function getOperationLabel(operation) {
  return operation === OPERATIONS.DAY_TRADE ? 'Day trade' : 'Operação comum';
}

function getAssetLabel(asset) {
  return asset === ASSETS.FIIS ? 'FIIs' : 'Ações';
}

function createSummary(input, result) {
  const lines = [
    'SimulaBolsa — Resumo da operação',
    `Ativo: ${getAssetLabel(input.asset)}`,
    `Modalidade: ${getOperationLabel(input.operation)}`,
    `Capital disponível: ${formatMoney(input.capitalCents)}`,
    `Preço de compra: ${formatMoney(input.buyPriceCents)}`,
    `Preço de venda: ${formatMoney(input.sellPriceCents)}`,
    `Custos informados: ${formatMoney(input.costsCents)}`,
    `Quantidade: ${formatNumber(result.quantity)} unidades`,
    `Valor aplicado: ${formatMoney(result.investedCents)}`,
    `Sobra do orçamento: ${formatMoney(result.remainingCents)}`,
    `Valor da venda: ${formatMoney(result.revenueCents)}`,
  ];

  if (input.asset === ASSETS.STOCKS && input.operation === OPERATIONS.COMMON) {
    lines.push(`Outras vendas de ações no mês: ${formatMoney(input.otherMonthlySalesCents)}`);
  }
  if (input.eligibleLossCents > 0) {
    lines.push(`Prejuízo compensável informado: ${formatMoney(input.eligibleLossCents)}`);
  }

  lines.push(
    `IR estimado: ${formatMoney(result.taxCents)}`,
    `Resultado líquido: ${formatSignedMoney(result.netResultCents)} (${formatSignedPercent(result.returnPercent)})`,
    '',
    'Estimativa educativa; não é recomendação nem apuração fiscal.',
  );
  return lines.join('\n');
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Tenta o método compatível com navegadores sem acesso à Clipboard API.
    }
  }

  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.className = 'clipboard-buffer';
  document.body.append(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  if (!copied) throw new Error('Não foi possível acessar a área de transferência.');
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => toast.classList.remove('is-visible'), 2400);
}

function restoreExample() {
  $('capital').value = '1000';
  $('buy').value = '5.64';
  $('sell').value = '8';
  $('costs').value = '0';
  $('otherSales').value = '0';
  $('loss').value = '0';
  $('useLoss').checked = false;
  document.querySelector('input[name="asset"][value="stocks"]').checked = true;
  document.querySelector('input[name="operation"][value="common"]').checked = true;
  updateConditionalFields();
  render(readInputs());
  showToast('Exemplo restaurado.');
}

document.addEventListener('input', (event) => {
  if (event.target.matches('input')) render(readInputs());
});

document.addEventListener('change', (event) => {
  if (event.target.name === 'asset' || event.target.name === 'operation' || event.target.id === 'useLoss') {
    updateConditionalFields();
    render(readInputs());
  }
});

$('reset').addEventListener('click', restoreExample);
$('copy').addEventListener('click', async () => {
  const input = readInputs();
  const result = calculateOperation(input);

  try {
    await copyToClipboard(createSummary(input, result));
    showToast('Resumo copiado.');
  } catch {
    showToast('Não foi possível copiar o resumo.');
  }
});

$('year').textContent = new Date().getFullYear();
updateConditionalFields();
render(readInputs());
})();
