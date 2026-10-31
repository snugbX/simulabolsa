import { writeFile } from 'node:fs/promises';

const rawUrl = process.env.BRAPI_PROXY_URL?.trim() ?? '';
let quotesApiUrl = '';

if (rawUrl) {
  const parsedUrl = new URL(rawUrl);
  if (parsedUrl.protocol !== 'https:') {
    throw new Error('BRAPI_PROXY_URL precisa usar HTTPS.');
  }
  quotesApiUrl = parsedUrl.origin;
}

const config = `window.SimulaBolsaConfig = Object.freeze(${JSON.stringify({ quotesApiUrl })});\n`;
await writeFile(new URL('../public/assets/js/config.js', import.meta.url), config, 'utf8');
console.log(quotesApiUrl ? 'Proxy de cotações configurado.' : 'Proxy de cotações ainda não configurado; o site manterá a consulta pública de demonstração.');
