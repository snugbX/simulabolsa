(() => {
  const {
    formatMoney,
    formatNumber,
    formatQuantity,
    formatPercent,
    formatSignedMoney,
    formatSignedPercent,
    toCents,
  } = window.SimulaBolsa.formatters;
  const STORAGE_KEY = 'simulabolsa.portfolio.v1';
  const VALID_ASSETS = new Set(['stocks', 'fiis']);
  const $ = (id) => document.getElementById(id);
  const storage = getStorage();
  let positions = loadPositions();
  let editingId = null;

  function getStorage() {
    try {
      return window.localStorage || null;
    } catch {
      return null;
    }
  }

  function createId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
      }
    } catch {
      // Ambientes locais podem bloquear a API criptográfica do navegador.
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function normalizePosition(value) {
    if (!value || typeof value !== 'object') return null;
    const ticker = typeof value.ticker === 'string' ? value.ticker.trim().toUpperCase() : '';
    const quantity = Number(value.quantity);
    const averagePriceCents = Number(value.averagePriceCents);
    const currentPriceCents = Number(value.currentPriceCents);

    if (
      !ticker
      || !VALID_ASSETS.has(value.asset)
      || !Number.isFinite(quantity)
      || quantity <= 0
      || !Number.isSafeInteger(averagePriceCents)
      || averagePriceCents <= 0
      || !Number.isSafeInteger(currentPriceCents)
      || currentPriceCents <= 0
    ) return null;

    const position = {
      id: typeof value.id === 'string' && value.id ? value.id : createId(),
      ticker,
      asset: value.asset,
      quantity: Math.round(quantity * 10_000) / 10_000,
      averagePriceCents,
      currentPriceCents,
      quoteUpdatedAt: typeof value.quoteUpdatedAt === 'string' && Number.isFinite(Date.parse(value.quoteUpdatedAt))
        ? value.quoteUpdatedAt
        : null,
    };
    if (
      !Number.isSafeInteger(Math.round(position.quantity * position.averagePriceCents))
      || !Number.isSafeInteger(Math.round(position.quantity * position.currentPriceCents))
    ) return null;
    return position;
  }

  function loadPositions() {
    if (!storage) {
      setStorageStatus(false);
      return [];
    }

    try {
      const saved = storage.getItem(STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) throw new TypeError('Formato de carteira inválido.');
      return parsed.map(normalizePosition).filter(Boolean);
    } catch {
      $('storageBadge').textContent = 'Dados não lidos';
      $('storageMessage').textContent = 'Não foi possível ler os dados salvos. Você pode cadastrar uma nova carteira neste navegador.';
      $('storageMessage').classList.add('is-warning');
      return [];
    }
  }

  function savePositions() {
    if (!storage) {
      setStorageStatus(false);
      return;
    }

    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(positions));
      setStorageStatus(true);
    } catch {
      setStorageStatus(false);
    }
  }

  function setStorageStatus(isAvailable) {
    $('storageBadge').textContent = isAvailable ? 'Salva neste navegador' : 'Salva só nesta sessão';
    $('storageMessage').textContent = isAvailable
      ? 'Os dados da carteira e dos proventos ficam neste navegador e não são enviados para um servidor.'
      : 'O armazenamento local está indisponível. As alterações ficam apenas enquanto esta página estiver aberta.';
    $('storageMessage').classList.toggle('is-warning', !isAvailable);
  }

  function getPositionValues(position) {
    const investedCents = Math.round(position.quantity * position.averagePriceCents);
    const currentValueCents = Math.round(position.quantity * position.currentPriceCents);
    const resultCents = currentValueCents - investedCents;
    const returnPercent = investedCents > 0 ? (resultCents / investedCents) * 100 : 0;
    return { investedCents, currentValueCents, resultCents, returnPercent };
  }

  function renderSummary() {
    const totals = positions.reduce((summary, position) => {
      const value = getPositionValues(position);
      summary.investedCents += value.investedCents;
      summary.currentValueCents += value.currentValueCents;
      if (position.asset === 'stocks') summary.stocksValueCents += value.currentValueCents;
      else summary.fiisValueCents += value.currentValueCents;
      return summary;
    }, { investedCents: 0, currentValueCents: 0, stocksValueCents: 0, fiisValueCents: 0 });

    const resultCents = totals.currentValueCents - totals.investedCents;
    const returnPercent = totals.investedCents > 0 ? (resultCents / totals.investedCents) * 100 : 0;
    const currentTotal = totals.currentValueCents;
    const stocksShare = currentTotal > 0 ? (totals.stocksValueCents / currentTotal) * 100 : 0;
    const fiisShare = currentTotal > 0 ? (totals.fiisValueCents / currentTotal) * 100 : 0;

    $('totalInvested').textContent = formatMoney(totals.investedCents);
    $('currentValue').textContent = formatMoney(totals.currentValueCents);
    $('totalResult').textContent = formatSignedMoney(resultCents);
    $('totalResult').classList.toggle('is-negative', resultCents < 0);
    $('totalResult').classList.toggle('is-positive', resultCents > 0);
    $('totalReturn').textContent = `${formatSignedPercent(returnPercent)} sobre o capital investido`;
    $('totalReturn').classList.toggle('is-negative', resultCents < 0);
    $('totalReturn').classList.toggle('is-positive', resultCents > 0);
    $('positionCount').textContent = positions.length === 0
      ? 'Nenhuma posição cadastrada'
      : positions.length === 1
        ? '1 posição cadastrada'
        : `${formatNumber(positions.length)} posições cadastradas`;

    $('stocksValue').textContent = formatMoney(totals.stocksValueCents);
    $('fiisValue').textContent = formatMoney(totals.fiisValueCents);
    $('stocksShare').textContent = `${formatPercent(stocksShare)} da carteira`;
    $('fiisShare').textContent = `${formatPercent(fiisShare)} da carteira`;
    $('stocksMeter').style.width = `${stocksShare}%`;
    $('fiisMeter').style.width = `${fiisShare}%`;
  }

  function createCell(label, value, className = '') {
    const cell = document.createElement('td');
    cell.dataset.label = label;
    if (className) cell.className = className;
    cell.textContent = value;
    return cell;
  }

  function createAssetCell(position) {
    const cell = document.createElement('th');
    cell.scope = 'row';
    cell.dataset.label = 'Ativo';
    cell.className = 'holding-asset';

    const ticker = document.createElement('strong');
    ticker.textContent = position.ticker;
    const type = document.createElement('span');
    type.className = 'asset-tag';
    type.textContent = position.asset === 'fiis' ? 'FII' : 'Ação';
    cell.append(ticker, type);
    return cell;
  }

  function createActionCell(position) {
    const cell = document.createElement('td');
    cell.dataset.label = 'Ações';
    cell.className = 'holding-actions';

    const editButton = document.createElement('button');
    editButton.className = 'table-action';
    editButton.type = 'button';
    editButton.textContent = 'Editar';
    editButton.setAttribute('aria-label', `Editar ${position.ticker}`);
    editButton.addEventListener('click', () => beginEdit(position));

    const removeButton = document.createElement('button');
    removeButton.className = 'table-action table-action-danger';
    removeButton.type = 'button';
    removeButton.textContent = 'Remover';
    removeButton.setAttribute('aria-label', `Remover ${position.ticker}`);
    removeButton.addEventListener('click', () => removePosition(position));

    cell.append(editButton, removeButton);
    return cell;
  }

  function renderPositions() {
    const body = $('holdingsBody');
    const fragment = document.createDocumentFragment();
    $('emptyState').hidden = positions.length > 0;
    $('holdingsTableWrap').hidden = positions.length === 0;

    for (const position of positions) {
      const value = getPositionValues(position);
      const row = document.createElement('tr');
      row.className = 'holding-row';
      row.append(
        createAssetCell(position),
        createCell('Qtd.', formatQuantity(position.quantity)),
        createCell('Preço médio', formatMoney(position.averagePriceCents)),
        createCell('Preço atual', formatMoney(position.currentPriceCents)),
        createCell('Investido', formatMoney(value.investedCents)),
        createCell('Valor atual', formatMoney(value.currentValueCents)),
        createCell('Resultado', `${formatSignedMoney(value.resultCents)} (${formatSignedPercent(value.returnPercent)})`, value.resultCents < 0 ? 'is-negative' : 'is-positive'),
        createActionCell(position),
      );
      fragment.append(row);
    }

    body.replaceChildren(fragment);
    renderSummary();
    window.dispatchEvent(new CustomEvent('simulabolsa:positions-changed'));
  }

  function setFormMessage(message, isError = false) {
    $('formMessage').textContent = message;
    $('formMessage').classList.toggle('is-error', isError);
  }

  function resetForm() {
    $('positionForm').reset();
    $('positionId').value = '';
    editingId = null;
    $('position-form-title').textContent = 'Adicionar ativo';
    $('savePosition').textContent = 'Adicionar posição';
    $('cancelEdit').hidden = true;
    setFormMessage('');
  }

  function beginEdit(position) {
    editingId = position.id;
    $('positionId').value = position.id;
    $('ticker').value = position.ticker;
    $('assetType').value = position.asset;
    $('quantity').value = String(position.quantity);
    $('averagePrice').value = (position.averagePriceCents / 100).toFixed(2);
    $('currentPrice').value = (position.currentPriceCents / 100).toFixed(2);
    $('position-form-title').textContent = `Editar ${position.ticker}`;
    $('savePosition').textContent = 'Salvar alterações';
    $('cancelEdit').hidden = false;
    setFormMessage('');
    $('ticker').focus();
  }

  function readForm() {
    const quantity = Number($('quantity').value);
    return {
      id: editingId || createId(),
      ticker: $('ticker').value.trim().toUpperCase(),
      asset: $('assetType').value,
      quantity: Number.isFinite(quantity) ? Math.round(quantity * 10_000) / 10_000 : quantity,
      averagePriceCents: toCents($('averagePrice').value),
      currentPriceCents: toCents($('currentPrice').value),
      quoteUpdatedAt: null,
    };
  }

  function isValidPosition(position) {
    return Boolean(
      position.ticker
      && position.ticker.length <= 12
      && VALID_ASSETS.has(position.asset)
      && Number.isFinite(position.quantity)
      && position.quantity > 0
      && position.averagePriceCents > 0
      && position.currentPriceCents > 0
      && Number.isSafeInteger(Math.round(position.quantity * position.averagePriceCents))
      && Number.isSafeInteger(Math.round(position.quantity * position.currentPriceCents)),
    );
  }

  function addPosition(position) {
    const existing = positions.find((item) => item.ticker === position.ticker && item.asset === position.asset);
    if (!existing) {
      positions.push(position);
      return 'Posição adicionada.';
    }

    const combinedQuantity = existing.quantity + position.quantity;
    existing.averagePriceCents = Math.round(
      (existing.quantity * existing.averagePriceCents + position.quantity * position.averagePriceCents)
      / combinedQuantity,
    );
    existing.quantity = Math.round(combinedQuantity * 10_000) / 10_000;
    existing.currentPriceCents = position.currentPriceCents;
    existing.quoteUpdatedAt = null;
    return `${position.ticker} consolidado com preço médio ponderado.`;
  }

  function handleSubmit(event) {
    event.preventDefault();
    const position = readForm();
    if (!isValidPosition(position)) {
      setFormMessage('Preencha o ticker, a quantidade e os dois preços com valores válidos.', true);
      return;
    }

    if (editingId && positions.some((item) => (
      item.id !== editingId && item.ticker === position.ticker && item.asset === position.asset
    ))) {
      setFormMessage('Já existe uma posição desse ticker e tipo. Edite a posição existente ou cancele.', true);
      return;
    }

    let message;
    if (editingId) {
      positions = positions.map((item) => item.id === editingId ? position : item);
      message = 'Posição atualizada.';
    } else {
      message = addPosition(position);
    }
    savePositions();
    renderPositions();
    resetForm();
    showToast(message);
  }

  function removePosition(position) {
    if (!window.confirm(`Remover ${position.ticker} da carteira?`)) return;
    positions = positions.filter((item) => item.id !== position.id);
    if (editingId === position.id) resetForm();
    savePositions();
    renderPositions();
    showToast(`${position.ticker} removido.`);
  }

  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => toast.classList.remove('is-visible'), 2400);
  }

  window.SimulaBolsa = window.SimulaBolsa || {};
  window.SimulaBolsa.portfolio = Object.freeze({
    getPositions: () => positions.map((position) => ({ ...position })),
    getPositionValues,
    updateQuotes(quotes) {
      const byTicker = new Map(quotes.map((quote) => [quote.ticker, quote]));
      let changed = 0;
      positions = positions.map((position) => {
        const quote = byTicker.get(position.ticker);
        if (!quote) return position;
        changed += 1;
        return { ...position, currentPriceCents: quote.priceCents, quoteUpdatedAt: quote.marketTime };
      });
      if (changed === 0) return 0;
      savePositions();
      renderPositions();
      return changed;
    },
  });

  $('positionForm').addEventListener('submit', handleSubmit);
  $('cancelEdit').addEventListener('click', resetForm);
  $('year').textContent = new Date().getFullYear();
  renderPositions();
})();
