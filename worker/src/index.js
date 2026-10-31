const BRAPI_QUOTE_ENDPOINT = 'https://brapi.dev/api/v2/stocks/quote';
const MAX_SYMBOLS = 20;
const ALLOWED_ORIGINS = new Set([
  'https://snugbx.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
]);

function createHeaders(origin) {
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Expose-Headers': 'Retry-After',
  });

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }

  return headers;
}

function jsonResponse(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers });
}

function errorResponse(origin, status, code, message, extraHeaders = {}) {
  const headers = createHeaders(origin);
  for (const [name, value] of Object.entries(extraHeaders)) {
    if (value) headers.set(name, value);
  }
  return jsonResponse({ error: true, code, message }, status, headers);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return errorResponse(origin, 403, 'ORIGIN_NOT_ALLOWED', 'Origem não autorizada.');
    }

    if (url.pathname !== '/api/quotes') {
      return errorResponse(origin, 404, 'NOT_FOUND', 'Rota não encontrada.');
    }

    if (request.method === 'OPTIONS') {
      if (!origin) {
        return errorResponse(origin, 400, 'ORIGIN_REQUIRED', 'Origem ausente.');
      }
      return new Response(null, { status: 204, headers: createHeaders(origin) });
    }

    if (request.method !== 'GET') {
      const headers = createHeaders(origin);
      headers.set('Allow', 'GET, OPTIONS');
      return jsonResponse({ error: true, code: 'METHOD_NOT_ALLOWED', message: 'Use GET.' }, 405, headers);
    }

    const rawSymbols = url.searchParams.get('symbols') || '';
    const symbols = [...new Set(rawSymbols.split(',').map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))];
    if (symbols.length === 0 || symbols.some((symbol) => !/^[A-Z0-9][A-Z0-9.-]{0,11}$/.test(symbol))) {
      return errorResponse(origin, 400, 'INVALID_SYMBOLS', 'Informe tickers válidos no parâmetro symbols.');
    }
    if (symbols.length > MAX_SYMBOLS) {
      return errorResponse(origin, 400, 'TOO_MANY_SYMBOLS', `Envie até ${MAX_SYMBOLS} tickers por chamada.`);
    }

    const token = typeof env?.BRAPI_TOKEN === 'string' ? env.BRAPI_TOKEN.trim() : '';
    if (!token) {
      return errorResponse(origin, 503, 'BRAPI_TOKEN_NOT_CONFIGURED', 'O serviço de cotações ainda não tem a chave BRAPI_TOKEN configurada.');
    }

    if (env.QUOTE_RATE_LIMITER) {
      const clientKey = request.headers.get('CF-Connecting-IP') || 'unknown-client';
      let permitted;
      try {
        ({ success: permitted } = await env.QUOTE_RATE_LIMITER.limit({ key: clientKey }));
      } catch {
        return errorResponse(origin, 503, 'RATE_LIMITER_UNAVAILABLE', 'O serviço de proteção de consultas está indisponível.');
      }
      if (!permitted) {
        return errorResponse(origin, 429, 'WORKER_RATE_LIMITED', 'Limite de consultas atingido. Tente novamente em 60 segundos.', { 'Retry-After': '60' });
      }
    }

    const endpoint = new URL(BRAPI_QUOTE_ENDPOINT);
    endpoint.searchParams.set('symbols', symbols.join(','));

    let upstream;
    try {
      upstream = await fetch(endpoint, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });
    } catch {
      return errorResponse(origin, 502, 'BRAPI_UNAVAILABLE', 'Não foi possível acessar a brapi agora.');
    }

    const headers = createHeaders(origin);
    if (upstream.status === 429) {
      const retryAfter = upstream.headers.get('Retry-After');
      if (retryAfter) headers.set('Retry-After', retryAfter);
    }

    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers,
    });
  },
};
