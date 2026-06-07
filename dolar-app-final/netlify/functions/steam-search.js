const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/html, */*',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
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
    if (status !== 200) throw new Error('SteamSpy returned ' + status);
    // Validate JSON
    JSON.parse(body);
    return { statusCode: 200, headers, body };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
