const WebSocket = require('ws');

const numberOfFakePlayers = 100;
const serverUrl = 'ws://3000'; // Replace with your server address and port

function getRandomMovement() {
  return {
    ArrowUp: Math.random() < 0.5,
    ArrowDown: Math.random() < 0.5,
    ArrowLeft: Math.random() < 0.5,
    ArrowRight: Math.random() < 0.5,
  };
}

function startFakePlayer() {
  const socket = new WebSocket(serverUrl);

  socket.addEventListener('open', () => {
    setInterval(() => {
      const movement = getRandomMovement();
      socket.send(JSON.stringify({ movement }));
    }, 100);
  });

  socket.addEventListener('close', () => {
    setTimeout(() => startFakePlayer(), 5000);
  });
}

for (let i = 0; i < numberOfFakePlayers; i++) {
  startFakePlayer();
}