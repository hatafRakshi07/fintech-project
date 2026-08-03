import http from 'http';

function checkUrl(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data.slice(0, 200) });
        }
      });
    }).on('error', (err) => resolve({ error: err.message }));
  });
}

async function test() {
  console.log("Checking API server at http://localhost:5001/api/daily-diary/loans?status=ACTIVE ...");
  const res1 = await checkUrl("http://localhost:5001/api/daily-diary/loans?status=ACTIVE");
  console.log("Direct API (5001) Response:", JSON.stringify(res1, null, 2));

  console.log("Checking Collector Proxy at http://localhost:5002/api/daily-diary/loans?status=ACTIVE ...");
  const res2 = await checkUrl("http://localhost:5002/api/daily-diary/loans?status=ACTIVE");
  console.log("Collector Proxy (5002) Response:", JSON.stringify(res2, null, 2));
}

test();
