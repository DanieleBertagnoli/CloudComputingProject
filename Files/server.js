const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

const server = http.createServer((req, res) => {
    if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fs.readFileSync('login.html'));
    } else if (req.url === '/style.css') {
        res.writeHead(200, { 'Content-Type': 'text/css' });
        res.end(fs.readFileSync('style.css'));
    } else if (req.url === '/client.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(fs.readFileSync('client.js'));
    } else {
        res.writeHead(404);
        res.end();
    }
});

const wss = new WebSocket.Server({ server });

let players = [];

const speed = 4;

wss.on('connection', (socket) => {
  const player = { id: Date.now(), x: 0, y: 0, size: 10, color: 'red' };
  players.push(player);

  socket.on('message', (message) => {
    const { movement } = JSON.parse(message);

    if (movement.ArrowUp) player.y -= speed;
    if (movement.ArrowDown) player.y += speed;
    if (movement.ArrowLeft) player.x -= speed;
    if (movement.ArrowRight) player.x += speed;

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(players));
      }
    });
  });

  socket.on('close', () => {
    players = players.filter((p) => p.id !== player.id);
  });
});

server.listen(3000, () => {
    console.log('Server listening on port 3000');
});