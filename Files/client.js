const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const socket = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`);

const movement = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
};

socket.addEventListener('message', (event) => {
  const players = JSON.parse(event.data);
  draw(players);
});

document.addEventListener('keydown', (event) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
    movement[event.key] = true;
    socket.send(JSON.stringify({ movement }));
  }
});

document.addEventListener('keyup', (event) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
    movement[event.key] = false;
    socket.send(JSON.stringify({ movement }));
  }
});

function draw(players) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const player of players) {
      ctx.fillStyle = player.color;
      ctx.fillRect(player.x, player.y, player.size, player.size);
  
      // Add player ID above the player character
      ctx.font = '14px Arial';
      ctx.fillStyle = 'black';
      ctx.fillText(player.id, player.x, player.y - 5);
    }
  }