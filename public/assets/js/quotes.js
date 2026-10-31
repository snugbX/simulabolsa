(() => {
  const API_ENDPOINT = 'https://brapi.dev/api/v2/stocks/quote';
  const MAX_SYMBOLS_PER_REQUEST = 20;
  const PUBLIC_DEMO_TICKERS = new Set(['PETR4', 'VALE3', 'MGLU3', 'ITUB4']);

  function makeRequestError(status, message, retryAfter = '') {
    const error = new Error(message);
    error.status = status;
    error.retryAfter = retryAfter;
    return error;
  }

  function statusMessage(status, body) {
    if (status === 401) return 'A brapi recusou a chave BRAPI_TOKEN configurada no servidor.';
    if (status === 403) return 'O plano da brapi não permite consultar um ou mais ativos.';
    if (status === 404) return 'A brapi não encontrou cotações para os tickers informados.';
    if (status === 429) return 'Limite de consultas da brapi atingido.';
    if (status === 503 && body?.code === 'BRAPI_TOKEN_NOT_CONFIGURED') {
      return 'O servidor de cotações ainda não tem BRAPI_TOKEN configurado.';
    }
    if (status >= 500) return 'O serviço de cotações está indisponível. Tente novamente mais tarde.';
    return typeof body?.message === 'string' && body.message
      ? body.message
      : 'Não foi possível consultar as cotações.';
  }

  async function requestBatch(symbols, proxyUrl) {
    const url = proxyUrl
      ? new URL('/api/quotes', proxyUrl)
      : new URL(API_ENDPOINT);
    url.searchParams.set('symbols', symbols.join(','));

    let response;
    try {
      response = await fetch(url, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
    } catch {
      throw makeRequestError(0, 'Não foi possível acessar o serviço de cotações. Verifique sua conexão.');
    }

    let body;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) {
      throw makeRequestError(
        response.status,
        statusMessage(response.status, body),
        response.headers.get('Retry-After') || '',
      );
    }

    return body;
  }

  function normalizeResponse(body, requestedSymbols) {
    const results = Array.isArray(body?.results) ? body.results : [];
    const requested = new Set(requestedSymbols);
    const updates = [];
    const received = new Set();
    const invalid = new Set();

    for (const result of results) {
      const ticker = String(result?.requestedSymbol || result?.symbol || '').trim().toUpperCase();
      if (!requested.has(ticker)) continue;

      const quote = result?.data || result;
      const price = quote?.regularMarketPrice;
      if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
        invalid.add(ticker);
        continue;
      }

      const priceCents = Math.round(price * 100);
      if (!Number.isSafeInteger(priceCents)) {
        invalid.add(ticker);
        continue;
      }

      const marketTime = typeof quote.regularMarketTime === 'string'
        && Number.isFinite(Date.parse(quote.regularMarketTime))
        ? quote.regularMarketTime
        : typeof body.requestedAt === 'string' && Number.isFinite(Date.parse(body.requestedAt))
          ? body.requestedAt
          : null;

      updates.push({ ticker, priceCents, marketTime });
      received.add(ticker);
    }

    return {
      updates,
      missing: requestedSymbols.filter((ticker) => !received.has(ticker) || invalid.has(ticker)),
    };
  }

  async function fetchQuotes(tickers) {
    const symbols = [...new Set(tickers.map((ticker) => String(ticker || '').trim().toUpperCase()))];
    if (symbols.length === 0 || symbols.some((ticker) => !/^[A-Z0-9][A-Z0-9.-]{0,11}$/.test(ticker))) {
      throw new TypeError('Informe tickers válidos para consultar.');
    }

    const proxyUrl = String(window.SimulaBolsaConfig?.quotesApiUrl || '').trim().replace(/\/+$/, '');
    let symbolsToFetch = symbols;
    let missing = [];
    let notQueried = [];

    if (!proxyUrl) {
      symbolsToFetch = symbols.filter((ticker) => PUBLIC_DEMO_TICKERS.has(ticker));
      notQueried = symbols.filter((ticker) => !PUBLIC_DEMO_TICKERS.has(ticker));
      if (symbolsToFetch.length === 0) {
        throw makeRequestError(503, 'O proxy seguro ainda não foi configurado. Os outros ativos dependem do servidor de cotações.');
      }
    }

    const updates = [];
    for (let index = 0; index < symbolsToFetch.length; index += MAX_SYMBOLS_PER_REQUEST) {
      const batch = symbolsToFetch.slice(index, index + MAX_SYMBOLS_PER_REQUEST);
      try {
        const body = await requestBatch(batch, proxyUrl);
        const normalized = normalizeResponse(body, batch);
        updates.push(...normalized.updates);
        missing.push(...normalized.missing);
      } catch (error) {
        error.partialUpdates = updates;
        throw error;
      }
    }

    return { updates, missing: [...new Set(missing)], notQueried };
  }

  window.SimulaBolsa = window.SimulaBolsa || {};
  window.SimulaBolsa.quotes = Object.freeze({ fetchQuotes });
})();
