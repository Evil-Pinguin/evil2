#!/usr/bin/env node
/**
 * Локальная раздача статики для превью (без зависимостей).
 * Отдаёт файлы с Cache-Control: no-store, чтобы правки были видны сразу.
 *   node serve.js [port]
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = Number(process.argv[2] || process.env.PORT || 5173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8'
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let file = decodeURIComponent(url.pathname);
  if (file === '/' || file === '') file = '/index.html';

  const abs = path.join(root, path.normalize(file));
  if (!abs.startsWith(root)) { res.writeHead(403).end('Forbidden'); return; }

  fs.readFile(abs, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404</h1><p>' + file + '</p><p><a href="/">На главную</a></p>');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(abs).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store, must-revalidate'
    });
    res.end(buf);
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`D01T01 тренажёр → http://0.0.0.0:${port}`);
});
