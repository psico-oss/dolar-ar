const https = require('https');
const zlib  = require('zlib');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = https.request({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, */*',
        'Accept-Encoding': 'gzip, deflate',
        'Referer': 'https://store.steampowered.com/',
      }
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return httpsGet(res.headers.location).then(resolve).catch(reject);
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
        console.log('Status:', res.statusCode, '| Enc:', enc, '| Len:', body.length);
        resolve({ status: res.statusCode, body });
      });
      stream.on('error', reject);
    });
    req.on('error', (e) => { console.log('Error:', e.message); reject(e); });
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  const appid = (event.queryStringParameters?.appid || '').trim();
  console.log('AppID:', appid);

  if (!appid || !/^\d+$/.test(appid)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid appid' }) };
  }

  try {
    // Fetch in USD so we get the real USD price for our calculations
    const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=US&l=english&filters=price_overview,name,header_image,is_free`;
    const { status, body } = await httpsGet(url);

    if (status !== 200) throw new Error('Steam returned ' + status);

    const parsed = JSON.parse(body);
    const data   = parsed[appid]?.data;

    if (!parsed[appid]?.success || !data) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: false }) };
    }

    // Build clean response with USD price
    const price = data.price_overview;
    const result = {
      success: true,
      appid,
      name: data.name,
      header_image: data.header_image,
      is_free: data.is_free,
      price_usd: price ? {
        final:            price.final / 100,       // USD
        initial:          price.initial / 100,     // USD before discount
        discount_percent: price.discount_percent,
        currency:         'USD',
      } : null,
    };

    console.log('Game:', result.name, '| Price USD:', result.price_usd?.final);
    return { statusCode: 200, headers, body: JSON.stringify(result) };

  } catch (e) {
    console.log('Error:', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
