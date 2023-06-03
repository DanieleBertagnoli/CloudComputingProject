const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const socket = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`);
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
    // requestAnimationFrame(gameLoop);
    gameLoop();
  }
  else
  {
    const players = data.players;
    const zombies = data.zombies;
    render(players, zombies);
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

function gameLoop() {
  const fixedTimeStep = 1000 / 60; // Update the game 60 times per second
  let lastUpdateTime = performance.now();
  let accumulatedTime = 0;

  setInterval(() => {
    const currentTime = performance.now();
    const deltaTime = currentTime - lastUpdateTime;
    lastUpdateTime = currentTime;
    accumulatedTime += deltaTime;

    // Player movement
    // Spawn zombies
    // Collision detection (zombies and players)
    // Rendering

    while (accumulatedTime >= fixedTimeStep) {
      socket.send(JSON.stringify({ type: 'game', movement }));
      accumulatedTime -= fixedTimeStep;
      //updateBullets();
    }
  }, fixedTimeStep);
}

function render(players, zombies) 
{
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const player of players) 
  {
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.size, player.size);

    // Add player ID above the player character
    ctx.font = '14px Arial';
    ctx.fillStyle = 'black';
    ctx.fillText(player.username, player.x, player.y - 5);
  }

  for (const zombie of zombies) 
  {
    ctx.fillStyle = zombie.color;
    ctx.fillRect(zombie.x, zombie.y, zombie.size, zombie.size);
  }
}