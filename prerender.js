const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = 7788;

const PAGES = [
  { url: '/',                              file: 'index.html' },
  { url: '/env/',                          file: 'env/index.html' },
  { url: '/environmental-management/',     file: 'environmental-management/index.html' },
  { url: '/guides/cities-waste.html',      file: 'guides/cities-waste.html' },
  { url: '/guides/history-when.html',      file: 'guides/history-when.html' },
  { url: '/guides/',                       file: 'guides/index.html' },
  { url: '/guides/price.html',             file: 'guides/price.html' },
  { url: '/guides/soil-survey-cost.html',  file: 'guides/soil-survey-cost.html' },
  { url: '/guides/soil-testing.html',      file: 'guides/soil-testing.html' },
  { url: '/guides/timeline.html',          file: 'guides/timeline.html' },
  { url: '/guides/urban-renewal.html',     file: 'guides/urban-renewal.html' },
  { url: '/guides/waste-calculation.html', file: 'guides/waste-calculation.html' },
  { url: '/guides/waste-quantities.html',  file: 'guides/waste-quantities.html' },
  { url: '/guides/when-to-consult.html',   file: 'guides/when-to-consult.html' },
  { url: '/history/',                      file: 'history/index.html' },
  { url: '/solar/',                        file: 'solar/index.html' },
  { url: '/waste/',                        file: 'waste/index.html' },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.json': 'application/json',
  '.xml':  'application/xml',
  '.txt':  'text/plain',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let urlPath = req.url.split('?')[0];
      // Trailing slash → index.html
      if (urlPath.endsWith('/')) urlPath += 'index.html';
      const filePath = path.join(ROOT, urlPath);
      const ext = path.extname(filePath).toLowerCase();
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`Server listening on http://127.0.0.1:${PORT}`);
      resolve(server);
    });
  });
}

async function renderPage(browser, page) {
  const tab = await browser.newPage();
  await tab.setViewport({ width: 1280, height: 900 });

  // Suppress console noise from the page
  tab.on('pageerror', () => {});
  tab.on('console', () => {});

  const url = `http://127.0.0.1:${PORT}${page.url}`;
  await tab.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

  // Wait for React to render (3 seconds)
  await new Promise(r => setTimeout(r, 3000));

  // Get the full rendered HTML
  const html = await tab.content();
  await tab.close();
  return html;
}

(async () => {
  const server = await startServer();
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let success = 0;
  let failed  = 0;

  for (const page of PAGES) {
    const filePath = path.join(ROOT, page.file);
    try {
      process.stdout.write(`Rendering ${page.url} ... `);
      const html = await renderPage(browser, page);
      fs.writeFileSync(filePath, html, 'utf8');
      console.log('✓');
      success++;
    } catch (err) {
      console.error(`✗  ERROR: ${err.message}`);
      failed++;
    }
  }

  await browser.close();
  server.close();

  console.log(`\nDone: ${success} succeeded, ${failed} failed.`);
  if (failed > 0) process.exit(1);
})();
