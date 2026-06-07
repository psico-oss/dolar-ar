const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'es-AR,es;q=0.9',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Body preview:', data.substring(0, 300));
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', (e) => {
      console.log('Request error:', e.message);
      reject(e);
    });
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('Timeout after 8s'));
    });
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  const query = event.queryStringParameters?.q || '';
  console.log('Query:', query);

  if (!query || query.length < 2) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Query too short' }) };
  }

  try {
    const url = 'https://steamspy.com/api.php?request=search&term=' + encodeURIComponent(query);
    console.log('Fetching:', url);
    const { status, body } = await httpsGet(url);

    if (status !== 200) {
      console.log('Non-200 status:', status);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'SteamSpy returned ' + status }) };
    }

    // Try parsing
    try {
      const parsed = JSON.parse(body);
      console.log('Parsed OK, keys:', Object.keys(parsed).length);
      return { statusCode: 200, headers, body };
    } catch (parseErr) {
      console.log('JSON parse error:', parseErr.message);
      console.log('Raw body:', body.substring(0, 500));
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Invalid JSON from SteamSpy', preview: body.substring(0, 200) }) };
    }

  } catch (e) {
    console.log('Caught error:', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
