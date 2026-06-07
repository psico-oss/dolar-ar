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
      console.log('Status:', res.statusCode, '| Encoding:', res.headers['content-encoding']);

      let stream = res;
      const enc  = res.headers['content-encoding'];
      if (enc === 'gzip')    stream = res.pipe(zlib.createGunzip());
      if (enc === 'deflate') stream = res.pipe(zlib.createInflate());

      let data = '';
      stream.on('data', chunk => data += chunk);
      stream.on('end', () => {
        console.log('Body length:', data.length, '| Preview:', data.substring(0, 200));
        resolve({ status: res.statusCode, body: data });
      });
      stream.on('error', reject);
    });
    req.on('error', (e) => { console.log('Error:', e.message); reject(e); });
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  const query = event.queryStringParameters?.q || '';
  if (!query || query.length < 2) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Query too short' }) };
  }

  try {
    const url = 'https://steamspy.com/api.php?request=search&term=' + encodeURIComponent(query);
    const { status, body } = await httpsGet(url);

    if (status !== 200) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'SteamSpy returned ' + status }) };
    }

    try {
      JSON.parse(body);
      return { statusCode: 200, headers, body };
    } catch (e) {
      console.log('Parse error:', e.message, '| Body:', body.substring(0, 300));
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Invalid JSON', preview: body.substring(0, 200) }) };
    }

  } catch (e) {
    console.log('Handler error:', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
