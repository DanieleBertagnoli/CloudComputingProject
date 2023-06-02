const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const socket = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`);

const playerEmail = sessionStorage.getItem('email');
const playerUsername = sessionStorage.getItem('username');
socket.onopen = () => 
{ socket.send(JSON.stringify({ type: 'playerInfo', email: playerEmail, username: playerUsername })); };

const movement = 
{
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
};

socket.addEventListener('message', (event) => 
{
  const data = JSON.parse(event.data);

  if(data.type === 'clientConfig') 
  {
    const { width, height } = data.clientConfig;
    canvas.width = width;
    canvas.height = height;
  }
  else
  {
    const players = data.players
    draw(players);
  }
});

document.addEventListener('keydown', (event) => 
{
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) 
  {
    movement[event.key] = true;
  }
});

document.addEventListener('keyup', (event) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) 
  {
    movement[event.key] = false;
  }
});

// Send movement updates every 100 milliseconds (10 times per second)
const movementUpdateInterval = 7;
setInterval(() => {
  socket.send(JSON.stringify({ type: 'game', movement }));
}, movementUpdateInterval);

function draw(players) 
{
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const player of players) {
      ctx.fillStyle = player.color;
      ctx.fillRect(player.x, player.y, player.size, player.size);
  
      // Add player ID above the player character
      ctx.font = '14px Arial';
      ctx.fillStyle = 'black';
      ctx.fillText(player.username, player.x, player.y - 5);
    }
  }