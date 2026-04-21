const http = require('http');
const net = require('net');

function pickTarget(req) {
  if (req.url && req.url.startsWith('/api/')) {
    return { host: '127.0.0.1', port: 3001 };
  }
  return { host: '127.0.0.1', port: 5173 };
}

const server = http.createServer((req, res) => {
  const target = pickTarget(req);
  const proxy = http.request(
    {
      hostname: target.host,
      port: target.port,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `${target.host}:${target.port}`,
      },
    },
    (upstream) => {
      res.writeHead(upstream.statusCode || 502, upstream.headers);
      upstream.pipe(res);
    },
  );

  proxy.on('error', (err) => {
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end(`Preview bridge waiting for upstream: ${err.message}`);
  });

  req.pipe(proxy);
});

server.on('upgrade', (req, socket, head) => {
  const target = pickTarget(req);
  const upstream = net.connect(target.port, target.host, () => {
    upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`);
    for (const [key, value] of Object.entries(req.headers)) {
      upstream.write(`${key}: ${Array.isArray(value) ? value.join(', ') : value}\r\n`);
    }
    upstream.write('\r\n');
    if (head && head.length) {
      upstream.write(head);
    }
    socket.pipe(upstream);
    upstream.pipe(socket);
  });

  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
});

server.listen(5000, '0.0.0.0', () => {
  console.log('Preview bridge listening on 5000 -> 5173/http + ws, /api -> 3001');
});
