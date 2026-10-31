(() => {
  const endpoint = 'https://brapi.dev/api/quote/';

  async function fetchQuote(ticker, token = '') {
    const symbol = String(ticker || '').trim().toUpperCase();
    if (!/^[A-Z0-9.-]{1,12}$/.test(symbol)) {
      throw new TypeError('Ticker inválido.');
    }

    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    let response;
    try {
      response = await fetch(`${endpoint}${encodeURIComponent(symbol)}`, {
        headers,
        cache: 'no-store',
      });
    } catch {
      throw new Error('Não foi possível acessar a brapi. Verifique sua conexão e tente novamente.');
    }

    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const error = new Error(response.status === 401 || response.status === 403
        ? 'A brapi recusou a consulta. Confira o token e o acesso do seu plano.'
        : response.status === 429
          ? 'Limite de consultas da brapi atingido. Tente novamente após a renovação do limite.'
          : 'A brapi não conseguiu retornar esta cotação. Confira o ticker e tente mais tarde.');
      error.status = response.status;
      throw error;
    }

    const quotes = Array.isArray(data?.results) ? data.results : [];
    const quote = quotes.find((item) => String(item.symbol || '').toUpperCase() === symbol);
    const price = Number(quote?.regularMarketPrice);
    const priceCents = Math.round(price * 100);

    if (!quote || !Number.isFinite(price) || price <= 0 || !Number.isSafeInteger(priceCents)) {
      throw new Error(`A brapi não retornou um preço válido para ${symbol}.`);
    }

    return {
      symbol,
      priceCents,
      marketTime: typeof quote.regularMarketTime === 'string' && quote.regularMarketTime
        ? quote.regularMarketTime
        : typeof data.requestedAt === 'string' && data.requestedAt
          ? data.requestedAt
          : new Date().toISOString(),
    };
  }

  window.SimulaBolsa = window.SimulaBolsa || {};
  window.SimulaBolsa.quotes = Object.freeze({ fetchQuote });
})();
