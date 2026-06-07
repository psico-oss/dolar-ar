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
      stream.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
      stream.on('error', reject);
    });
    req.on('error', reject);
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
 
  try {
    const url = 'https://store.steampowered.com/search/results/?term=' +
      encodeURIComponent(query) +
      '&cc=AR&l=spanish&category1=998&json=1&count=10';
 
    const { status, body } = await httpsGet(url);
    if (status !== 200) throw new Error('Steam returned ' + status);
 
    const data = JSON.parse(body);
    const items = data?.items || [];
 
    const results = {};
    items.slice(0, 8).forEach(item => {
      if (!item.name || !item.logo) return;
      // appid lives inside the logo URL:
      // https://.../steam/apps/1245620/capsule_sm_120.jpg
      const match = item.logo.match(/\/apps\/(\d+)\//);
      if (!match) return;
      const appid = match[1];
      results[appid] = { appid, name: item.name, logo: item.logo };
    });
 
    console.log('Results found:', Object.keys(results).length, Object.values(results).map(r => r.name).join(', '));
    return { statusCode: 200, headers, body: JSON.stringify(results) };
 
  } catch (e) {
    console.log('Error:', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
