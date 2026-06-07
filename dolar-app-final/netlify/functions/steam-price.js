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

  const appid = (event.queryStringParameters?.appid || '').trim();
  console.log('AppID requested:', appid);

  if (!appid || !/^\d+$/.test(appid)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid appid' }) };
  }

  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=AR&l=spanish`;
    const { status, body } = await httpsGet(url);

    if (status !== 200) throw new Error('Steam returned ' + status);

    try {
      JSON.parse(body); // validate
      return { statusCode: 200, headers, body };
    } catch (e) {
      console.log('JSON parse error:', e.message);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Invalid JSON from Steam' }) };
    }

  } catch (e) {
    console.log('Handler error:', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
