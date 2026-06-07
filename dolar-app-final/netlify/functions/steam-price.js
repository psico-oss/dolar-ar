const https = require('https');
const zlib  = require('zlib');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept':          'application/json',
        'Accept-Encoding': 'gzip, deflate',
      }
    }, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        return httpsGet(res.headers.location).then(resolve).catch(reject);
      }

      let stream = res;
      const enc  = res.headers['content-encoding'];
      if (enc === 'gzip')    stream = res.pipe(zlib.createGunzip());
      if (enc === 'deflate') stream = res.pipe(zlib.createInflate());

      let data = '';
      stream.on('data', chunk => data += chunk);
      stream.on('end', () => resolve({ status: res.statusCode, body: data }));
      stream.on('error', reject);
    });
    req.on('error', (e) => { console.log('Error:', e.message); reject(e); });
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  const appid = event.queryStringParameters?.appid || '';
  if (!appid || !/^\d+$/.test(appid)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid appid' }) };
  }

  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=AR&l=spanish`;
    const { status, body } = await httpsGet(url);

    if (status !== 200) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Steam returned ' + status }) };
    }

    try {
      JSON.parse(body);
      return { statusCode: 200, headers, body };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Invalid JSON from Steam' }) };
    }

  } catch (e) {
    console.log('Handler error:', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
