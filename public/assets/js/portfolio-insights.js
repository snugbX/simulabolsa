(() => {
  const {
    formatMoney,
    formatNumber,
    formatQuantity,
    formatSignedMoney,
    toCents,
  } = window.SimulaBolsa.formatters;
  const portfolio = window.SimulaBolsa.portfolio;
  const quoteProvider = window.SimulaBolsa.quotes;
  const STORAGE_KEY = 'simulabolsa.dividends.v1';
  const VALID_ASSETS = new Set(['stocks', 'fiis']);
  const ASSET_LABELS = { stocks: 'Ação', fiis: 'FII' };
  const KIND_LABELS = {
    fiiIncome: 'Rendimento de FII',
    amortization: 'Amortização',
    dividend: 'Dividendo',
    jcp: 'JCP',
    other: 'Outro',
  };
  const KIND_OPTIONS = {
    fiis: [
      ['fiiIncome', KIND_LABELS.fiiIncome],
      ['amortization', KIND_LABELS.amortization],
      ['other', KIND_LABELS.other],
    ],
    stocks: [
      ['dividend', KIND_LABELS.dividend],
      ['jcp', KIND_LABELS.jcp],
      ['other', KIND_LABELS.other],
    ],
  };
  const $ = (id) => document.getElementById(id);
  let storage = getStorage();
  let quoteRetryUntil = 0;
  let quoteRetryTimer = 0;
  let storageDataUnreadable = false;
  let dividends = loadDividends();
  let editingDividendId = null;

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

  function isValidDateString(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }

  function normalizeDividend(value) {
    if (!value || typeof value !== 'object') return null;
    const ticker = typeof value.ticker === 'string' ? value.ticker.trim().toUpperCase() : '';
    const asset = value.asset;
    const kind = value.kind;
    const amountCents = Number(value.amountCents);
    const date = value.date;
    const validKind = KIND_OPTIONS[asset]?.some(([key]) => key === kind);

    if (
      !ticker
      || ticker.length > 12
      || !VALID_ASSETS.has(asset)
      || !validKind
      || !isValidDateString(date)
      || !Number.isSafeInteger(amountCents)
      || amountCents <= 0
    ) return null;

    return {
      id: typeof value.id === 'string' && value.id ? value.id : createId(),
      ticker,
      asset,
      kind,
      date,
      amountCents,
    };
  }

  function loadDividends() {
    if (!storage) return [];
    try {
      const saved = storage.getItem(STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) throw new TypeError('Formato de proventos inválido.');
      return parsed.map(normalizeDividend).filter(Boolean);
    } catch {
      storageDataUnreadable = true;
      $('storageBadge').textContent = 'Dados não lidos';
      $('storageMessage').textContent = 'Não foi possível ler os proventos salvos. Os dados anteriores foram preservados e novos registros ficarão nesta sessão.';
      $('storageMessage').classList.add('is-warning');
      return [];
    }
  }

  function saveDividends() {
    if (!storage) {
      setStorageWarning('O armazenamento local está indisponível. Os proventos ficam apenas enquanto esta página estiver aberta.');
      return;
    }
    if (storageDataUnreadable) {
      setStorageWarning('Os proventos antigos não puderam ser lidos e foram preservados. Os novos registros ficam apenas enquanto esta página estiver aberta.');
      return;
    }
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(dividends));
    } catch {
      setStorageWarning('Não foi possível salvar os proventos. Verifique o espaço disponível neste navegador.');
    }
  }

  function setStorageWarning(message) {
    $('storageBadge').textContent = 'Armazenamento limitado';
    $('storageMessage').textContent = message;
    $('storageMessage').classList.add('is-warning');
  }

  function todayISO() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDate(value) {
    if (!isValidDateString(value)) return value || '—';
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day));
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'horário indisponível';
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  }

  function sumCents(items, select = (item) => item.amountCents) {
    return items.reduce((sum, item) => sum + select(item), 0);
  }

  function createCell(label, value, className = '') {
    const cell = document.createElement('td');
    cell.dataset.label = label;
    if (className) cell.className = className;
    cell.textContent = value;
    return cell;
  }

  function resultClass(value) {
    return value < 0 ? 'is-negative' : value > 0 ? 'is-positive' : '';
  }

  function setDividendMessage(message, isError = false) {
    $('dividendFormMessage').textContent = message;
    $('dividendFormMessage').classList.toggle('is-error', isError);
  }

  function syncKindOptions(preferredKind = $('dividendKind').value) {
    const asset = $('dividendAsset').value;
    const options = KIND_OPTIONS[asset] || KIND_OPTIONS.fiis;
    const fragment = document.createDocumentFragment();
    for (const [value, label] of options) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      fragment.append(option);
    }
    $('dividendKind').replaceChildren(fragment);
    $('dividendKind').value = options.some(([value]) => value === preferredKind) ? preferredKind : options[0][0];
  }

  function readDividendForm() {
    return normalizeDividend({
      id: editingDividendId || createId(),
      ticker: $('dividendTicker').value,
      asset: $('dividendAsset').value,
      kind: $('dividendKind').value,
      date: $('dividendDate').value,
      amountCents: toCents($('dividendAmount').value),
    });
  }

  function resetDividendForm() {
    $('dividendForm').reset();
    $('dividendId').value = '';
    $('dividendDate').value = todayISO();
    editingDividendId = null;
    syncKindOptions();
    $('income-title').textContent = 'Registrar recebimento';
    $('saveDividend').textContent = 'Registrar provento';
    $('cancelDividendEdit').hidden = true;
    setDividendMessage('');
  }

  function setEditingDividend(dividend) {
    editingDividendId = dividend.id;
    $('dividendId').value = dividend.id;
    $('dividendTicker').value = dividend.ticker;
    $('dividendAsset').value = dividend.asset;
    syncKindOptions(dividend.kind);
    $('dividendDate').value = dividend.date;
    $('dividendAmount').value = (dividend.amountCents / 100).toFixed(2);
    $('income-title').textContent = `Editar recebimento de ${dividend.ticker}`;
    $('saveDividend').textContent = 'Salvar alterações';
    $('cancelDividendEdit').hidden = false;
    setDividendMessage('');
    $('dividendTicker').focus();
  }

  function handleDividendSubmit(event) {
    event.preventDefault();
    const dividend = readDividendForm();
    if (!dividend) {
      setDividendMessage('Preencha o ticker, a data e um valor recebido válido.', true);
      return;
    }

    if (editingDividendId) {
      dividends = dividends.map((item) => item.id === editingDividendId ? dividend : item);
      showToast(`Provento de ${dividend.ticker} atualizado.`);
    } else {
      dividends.push(dividend);
      showToast(`Provento de ${dividend.ticker} registrado.`);
    }

    saveDividends();
    resetDividendForm();
    renderDividendHistory();
    renderReport();
  }

  function removeDividend(dividend) {
    if (!window.confirm(`Remover o recebimento de ${dividend.ticker} em ${formatDate(dividend.date)}?`)) return;
    dividends = dividends.filter((item) => item.id !== dividend.id);
    if (editingDividendId === dividend.id) resetDividendForm();
    saveDividends();
    renderDividendHistory();
    renderReport();
    showToast(`Registro de ${dividend.ticker} removido.`);
  }

  function createAssetCell(asset, ticker) {
    const cell = document.createElement('th');
    cell.scope = 'row';
    cell.dataset.label = 'Ativo';
    cell.className = 'holding-asset';
    const symbol = document.createElement('strong');
    symbol.textContent = ticker;
    const type = document.createElement('span');
    type.className = 'asset-tag';
    type.textContent = ASSET_LABELS[asset] || asset;
    cell.append(symbol, type);
    return cell;
  }

  function createDividendActionsCell(dividend) {
    const cell = document.createElement('td');
    cell.dataset.label = 'Ações';
    cell.className = 'holding-actions';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'table-action';
    edit.textContent = 'Editar';
    edit.setAttribute('aria-label', `Editar provento de ${dividend.ticker}`);
    edit.addEventListener('click', () => setEditingDividend(dividend));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'table-action table-action-danger';
    remove.textContent = 'Remover';
    remove.setAttribute('aria-label', `Remover provento de ${dividend.ticker}`);
    remove.addEventListener('click', () => removeDividend(dividend));
    cell.append(edit, remove);
    return cell;
  }

  function renderDividendHistory() {
    const sorted = [...dividends].sort((a, b) => b.date.localeCompare(a.date) || a.ticker.localeCompare(b.ticker));
    const body = $('dividendBody');
    const fragment = document.createDocumentFragment();
    $('dividendEmpty').hidden = sorted.length > 0;
    $('dividendTableWrap').hidden = sorted.length === 0;
    $('dividendCount').textContent = sorted.length === 0
      ? 'Nenhum lançamento'
      : sorted.length === 1
        ? '1 lançamento'
        : `${formatNumber(sorted.length)} lançamentos`;

    for (const dividend of sorted) {
      const row = document.createElement('tr');
      row.append(
        createCell('Pagamento', formatDate(dividend.date)),
        createAssetCell(dividend.asset, dividend.ticker),
        createCell('Tipo', KIND_LABELS[dividend.kind]),
        createCell('Valor recebido', formatMoney(dividend.amountCents), 'is-positive'),
        createDividendActionsCell(dividend),
      );
      fragment.append(row);
    }
    body.replaceChildren(fragment);
  }

  function readReportFilter() {
    const start = $('reportStart').value;
    const end = $('reportEnd').value;
    if ((start && !isValidDateString(start)) || (end && !isValidDateString(end))) {
      return { valid: false, message: 'Informe datas válidas para filtrar o relatório.', filtered: [] };
    }
    if (start && end && start > end) {
      return { valid: false, message: 'A data inicial precisa ser anterior à data final.', filtered: [] };
    }
    return {
      valid: true,
      message: '',
      filtered: dividends.filter((item) => (!start || item.date >= start) && (!end || item.date <= end)),
    };
  }

  function renderAssetReport(filtered) {
    const grouped = new Map();
    for (const position of portfolio.getPositions()) {
      const key = `${position.asset}:${position.ticker}`;
      grouped.set(key, { ticker: position.ticker, asset: position.asset, position, incomeCents: 0 });
    }
    for (const dividend of filtered) {
      const key = `${dividend.asset}:${dividend.ticker}`;
      const row = grouped.get(key) || { ticker: dividend.ticker, asset: dividend.asset, position: null, incomeCents: 0 };
      row.incomeCents += dividend.amountCents;
      grouped.set(key, row);
    }

    const items = [...grouped.values()].sort((a, b) => (
      b.incomeCents - a.incomeCents || a.ticker.localeCompare(b.ticker)
    ));
    const body = $('reportAssetsBody');
    const fragment = document.createDocumentFragment();
    $('reportAssetsEmpty').hidden = items.length > 0;
    $('reportAssetsWrap').hidden = items.length === 0;

    for (const item of items) {
      const position = item.position;
      const value = position ? portfolio.getPositionValues(position) : null;
      const row = document.createElement('tr');
      row.append(
        createAssetCell(item.asset, item.ticker),
        createCell('Qtd.', position ? formatQuantity(position.quantity) : '—'),
        createCell('Investido', value ? formatMoney(value.investedCents) : '—'),
        createCell('Valor atual', value ? formatMoney(value.currentValueCents) : '—'),
        createCell('P/L em aberto', value ? formatSignedMoney(value.resultCents) : '—', value ? resultClass(value.resultCents) : ''),
        createCell('Proventos', formatMoney(item.incomeCents), item.incomeCents > 0 ? 'is-positive' : ''),
      );
      fragment.append(row);
    }
    body.replaceChildren(fragment);
  }

  function renderMonthlyReport(filtered) {
    const grouped = new Map();
    for (const dividend of filtered) {
      const month = dividend.date.slice(0, 7);
      const summary = grouped.get(month) || { count: 0, amountCents: 0 };
      summary.count += 1;
      summary.amountCents += dividend.amountCents;
      grouped.set(month, summary);
    }
    const months = [...grouped.entries()].sort(([a], [b]) => b.localeCompare(a));
    const body = $('monthlyIncomeBody');
    const fragment = document.createDocumentFragment();
    $('monthlyIncomeEmpty').hidden = months.length > 0;
    $('monthlyIncomeWrap').hidden = months.length === 0;

    for (const [month, summary] of months) {
      const [year, monthNumber] = month.split('-').map(Number);
      const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
        .format(new Date(year, monthNumber - 1, 1));
      const row = document.createElement('tr');
      row.append(
        createCell('Mês', label),
        createCell('Pagamentos', formatNumber(summary.count)),
        createCell('Total recebido', formatMoney(summary.amountCents), 'is-positive'),
      );
      fragment.append(row);
    }
    body.replaceChildren(fragment);
  }

  function renderReport() {
    const filter = readReportFilter();
    const openResultCents = sumCents(portfolio.getPositions(), (position) => (
      portfolio.getPositionValues(position).resultCents
    ));
    const periodIncomeCents = sumCents(filter.filtered);
    const lifetimeIncomeCents = sumCents(dividends);

    $('reportOpenResult').textContent = formatSignedMoney(openResultCents);
    $('reportOpenResult').className = resultClass(openResultCents);
    $('reportPeriodIncome').textContent = formatMoney(periodIncomeCents);
    $('reportLifetimeIncome').textContent = formatMoney(lifetimeIncomeCents);
    $('reportPeriodCount').textContent = filter.filtered.length === 0
      ? 'Nenhum lançamento no filtro'
      : filter.filtered.length === 1
        ? '1 recebimento registrado'
        : `${formatNumber(filter.filtered.length)} recebimentos registrados`;
    $('reportStatus').textContent = filter.message;
    $('reportStatus').classList.toggle('is-error', !filter.valid);
    renderAssetReport(filter.filtered);
    renderMonthlyReport(filter.filtered);
  }

  function escapeCsv(value) {
    let safe = String(value ?? '');
    if (/^[=+@-]/.test(safe)) safe = `'${safe}`;
    return `"${safe.replace(/"/g, '""')}"`;
  }

  function exportDividends() {
    const filter = readReportFilter();
    if (!filter.valid) {
      $('reportStatus').textContent = filter.message;
      $('reportStatus').classList.add('is-error');
      return;
    }
    if (filter.filtered.length === 0) {
      $('reportStatus').textContent = 'Não há proventos no período selecionado para exportar.';
      $('reportStatus').classList.remove('is-error');
      return;
    }

    const lines = [
      ['Data de pagamento', 'Ticker', 'Tipo de ativo', 'Provento', 'Valor recebido (R$)'],
      ...[...filter.filtered]
        .sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker))
        .map((item) => [
          item.date,
          item.ticker,
          ASSET_LABELS[item.asset],
          KIND_LABELS[item.kind],
          (item.amountCents / 100).toFixed(2),
        ]),
    ];
    const csv = `\ufeff${lines.map((line) => line.map(escapeCsv).join(';')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `simulabolsa-proventos-${todayISO()}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('reportStatus').textContent = `${formatNumber(filter.filtered.length)} proventos exportados.`;
    $('reportStatus').classList.remove('is-error');
  }

  function setQuoteStatus(message, state = '') {
    $('quoteStatus').textContent = message;
    $('quoteStatus').classList.toggle('is-error', state === 'error');
    $('quoteStatus').classList.toggle('is-success', state === 'success');
  }

  function renderSavedQuoteStatus() {
    const timestamps = portfolio.getPositions()
      .map((position) => position.quoteUpdatedAt)
      .filter((value) => Number.isFinite(Date.parse(value || '')))
      .sort((a, b) => Date.parse(a) - Date.parse(b));
    if (timestamps.length > 0) {
      setQuoteStatus(`Último horário informado pela fonte: ${formatDateTime(timestamps[timestamps.length - 1])}. Os preços são salvos junto com a carteira.`);
    } else {
      setQuoteStatus('Os preços atuais continuam editáveis manualmente.');
    }
  }

  function retryDelayMs(value) {
    if (value) {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
      const date = Date.parse(value);
      if (Number.isFinite(date)) return Math.max(0, date - Date.now());
    }
    return 60_000;
  }

  function startQuoteCooldown(delayMs) {
    const button = $('refreshQuotes');
    quoteRetryUntil = Date.now() + delayMs;
    button.disabled = true;

    const updateStatus = () => {
      const secondsLeft = Math.max(0, Math.ceil((quoteRetryUntil - Date.now()) / 1000));
      if (secondsLeft === 0) {
        window.clearInterval(quoteRetryTimer);
        quoteRetryTimer = 0;
        quoteRetryUntil = 0;
        button.disabled = false;
        setQuoteStatus('Já é possível tentar atualizar as cotações novamente.');
        return;
      }
      setQuoteStatus(`Limite da brapi atingido. Aguarde ${formatNumber(secondsLeft)} s antes de tentar novamente.`, 'error');
    };

    window.clearInterval(quoteRetryTimer);
    updateStatus();
    quoteRetryTimer = window.setInterval(updateStatus, 1000);
  }

  async function refreshQuotes() {
    const button = $('refreshQuotes');
    const positions = portfolio.getPositions();
    const tickers = [...new Set(positions.map((position) => position.ticker))];
    if (tickers.length === 0) {
      setQuoteStatus('Cadastre uma posição antes de atualizar as cotações.', 'error');
      return;
    }
    if (Date.now() < quoteRetryUntil) {
      setQuoteStatus(`Aguarde ${formatNumber(Math.ceil((quoteRetryUntil - Date.now()) / 1000))} s antes de consultar novamente.`, 'error');
      return;
    }

    button.disabled = true;
    button.textContent = 'Consultando…';
    setQuoteStatus(`Consultando ${formatNumber(tickers.length)} ${tickers.length === 1 ? 'ativo' : 'ativos'} em lote…`);
    try {
      const result = await quoteProvider.fetchQuotes(tickers);
      const updated = portfolio.updateQuotes(result.updates);
      const timestamps = result.updates
        .map((quote) => quote.marketTime)
        .filter((value) => Number.isFinite(Date.parse(value || '')))
        .sort((a, b) => Date.parse(a) - Date.parse(b));
      const messages = [];
      if (updated > 0) messages.push(`${formatNumber(updated)} ${updated === 1 ? 'cotação atualizada' : 'cotações atualizadas'}`);
      if (timestamps.length > 0) messages.push(`horário informado pela fonte: ${formatDateTime(timestamps[timestamps.length - 1])}`);
      if (result.missing.length > 0) messages.push(`sem preço válido para: ${result.missing.join(', ')}`);
      if (result.notQueried.length > 0) messages.push(`aguardando configuração do proxy seguro para: ${result.notQueried.join(', ')}`);
      if (messages.length === 0) messages.push('A brapi não retornou preços válidos para os ativos informados');
      setQuoteStatus(`${messages.join('. ')}.`, result.missing.length === 0 && result.notQueried.length === 0 && updated > 0 ? 'success' : 'error');
    } catch (error) {
      if (error.partialUpdates?.length) portfolio.updateQuotes(error.partialUpdates);
      if (error.status === 429) {
        startQuoteCooldown(retryDelayMs(error.retryAfter));
      } else {
        setQuoteStatus(error.message || 'Não foi possível atualizar as cotações.', 'error');
      }
    } finally {
      button.textContent = 'Atualizar cotações';
      if (Date.now() >= quoteRetryUntil) button.disabled = false;
    }
  }

  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => toast.classList.remove('is-visible'), 2400);
  }

  $('dividendForm').addEventListener('submit', handleDividendSubmit);
  $('dividendAsset').addEventListener('change', () => syncKindOptions());
  $('cancelDividendEdit').addEventListener('click', resetDividendForm);
  $('reportStart').addEventListener('input', renderReport);
  $('reportEnd').addEventListener('input', renderReport);
  $('exportDividends').addEventListener('click', exportDividends);
  $('refreshQuotes').addEventListener('click', refreshQuotes);
  window.addEventListener('simulabolsa:positions-changed', () => {
    renderReport();
    renderSavedQuoteStatus();
  });
  $('year').textContent = new Date().getFullYear();

  const currentDate = todayISO();
  $('dividendDate').value = currentDate;
  $('reportStart').value = `${new Date().getFullYear()}-01-01`;
  $('reportEnd').value = currentDate;
  syncKindOptions();
  renderDividendHistory();
  renderReport();
  renderSavedQuoteStatus();
})();
