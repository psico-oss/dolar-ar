const https = require('https');
const zlib  = require('zlib');

function httpsGet(url, extraHeaders) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
        'Connection': 'keep-alive',
        ...extraHeaders,
      }
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return httpsGet(res.headers.location, extraHeaders).then(resolve).catch(reject);
      }

      let stream = res;
      const enc = res.headers['content-encoding'];
      if (enc === 'gzip')    stream = res.pipe(zlib.createGunzip());
      if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
      if (enc === 'br')      stream = res.pipe(zlib.createBrotliDecompress());

      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        console.log('URL:', url);
        console.log('Status:', res.statusCode, '| Enc:', enc, '| Len:', body.length);
        console.log('Preview:', body.substring(0, 300));
        resolve({ status: res.statusCode, body });
      });
      stream.on('error', reject);
    });

    req.on('error', (e) => { console.log('Req error:', e.message); reject(e); });
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  const query = (event.queryStringParameters?.q || '').trim();
  if (!query || query.length < 2) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Query too short' }) };
  }

  // Try Steam's storeapi search endpoint
  try {
    const url = 'https://store.steampowered.com/search/suggest?term=' +
      encodeURIComponent(query) +
      '&l=spanish&cc=AR&realm=1&use_store_query=1&category1=998&ndl=1&origin=https://store.steampowered.com';

    const { status, body } = await httpsGet(url, {
      'Origin': 'https://store.steampowered.com',
      'Referer': 'https://store.steampowered.com/',
    });

    if (status !== 200 || !body) throw new Error('Steam suggest failed: ' + status);

    // Steam returns HTML snippets — parse app IDs and names from it
    const results = {};
    const regex = /data-ds-appid="(\d+)"[^>]*>[\s\S]*?<span class="match_name">([^<]+)<\/span>/g;
    let match;
    let count = 0;
    while ((match = regex.exec(body)) !== null && count < 10) {
      const appid = match[1];
      const name  = match[2].trim();
      results[appid] = { name, appid };
      count++;
    }

    // If regex found nothing, try alternate pattern
    if (count === 0) {
      const re2 = /href="https:\/\/store\.steampowered\.com\/app\/(\d+)\/[^"]*"[^>]*>[\s\S]{0,500}?class="[^"]*match_name[^"]*">([^<]+)</g;
      while ((match = re2.exec(body)) !== null && count < 10) {
        results[match[1]] = { name: match[2].trim(), appid: match[1] };
        count++;
      }
    }

    console.log('Found results:', count);

    if (count > 0) {
      return { statusCode: 200, headers, body: JSON.stringify(results) };
    }

    // Fallback: return empty object (no results)
    return { statusCode: 200, headers, body: JSON.stringify({}) };

  } catch (e) {
    console.log('Error:', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
