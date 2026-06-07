const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    }, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        return httpsGet(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
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
    if (status !== 200) throw new Error('Steam returned ' + status);
    JSON.parse(body); // validate
    return { statusCode: 200, headers, body };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
