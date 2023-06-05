const visibleCanvas = document.getElementById('gameCanvas');
const visibleCtx = visibleCanvas.getContext('2d');
visibleCanvas.width = window.innerWidth - 200; // or any desired width
visibleCanvas.height = window.innerHeight - 200; // or any desired height

const backgroundImage = new Image();
backgroundImage.src = '/Game/canvas-background.jpg';

const socket = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`);
const movement = {
  w: false, // Up
  a: false, // Left
  s: false, // Down
  d: false, // Right
};


let shot = null;
let email = null;
let currentPlayer = null;
let oldScore = 0;
let bestScore = 0;
let worldRecord = 0;

let originalWidth = 0;
let originalHeight = 0;

const camera = {
  x: 0,
  y: 0,
};

socket.addEventListener('message', (event) => 
{
  const data = JSON.parse(event.data);

  if(data.type === 'clientConfig') 
  {
    const { width, height } = data.clientConfig;
    email = data.email;
    bestScore = data.bestScore;
    $('#bestScore').html('Best score: ' + bestScore);

    worldRecord = data.worldRecord;
    $('#worldRecord').html('World record: ' + worldRecord.bestScore + ' by: ' + worldRecord.username);
    
    originalWidth = width;
    originalHeight = height;

    gameLoop();
  }
  else if (data.type === 'respawned')
  { $('#overlay').hide(); }
  else
  {
    const players = data.players;
    const zombies = data.zombies;
    const bullets = data.bullets
    render(players, zombies, bullets);
  }
});


document.addEventListener('keydown', (event) => {
  if (['w', 'a', 's', 'd'].includes(event.key.toLowerCase())) {
    movement[event.key.toLowerCase()] = true;
  }
});

document.addEventListener('keyup', (event) => {
  if (['w', 'a', 's', 'd'].includes(event.key.toLowerCase())) {
    movement[event.key.toLowerCase()] = false;
  }
});

// Add an event listener for mousedown events
visibleCanvas.addEventListener('mousedown', (event) => 
{
  const rect = visibleCanvas.getBoundingClientRect();
  let mouseX = event.clientX - rect.left;
  let mouseY = event.clientY - rect.top;

  // Calculate the translation applied to the visible canvas
  const translationX = Math.max(0, Math.min(camera.x, originalWidth - visibleCanvas.width));
  const translationY = Math.max(0, Math.min(camera.y, originalHeight - visibleCanvas.height));

  // Account for the camera's position and the applied translation
  mouseX += translationX;
  mouseY += translationY;

  shot = { mouseX: mouseX, mouseY: mouseY };
});


function gameLoop() 
{
  const fixedTimeStep = 1000 / 60; // Update the game 60 times per second
  let lastUpdateTime = performance.now();
  let accumulatedTime = 0;

  setInterval(() => 
  {
    const currentTime = performance.now();
    const deltaTime = currentTime - lastUpdateTime;
    lastUpdateTime = currentTime;
    accumulatedTime += deltaTime;

    socket.send(JSON.stringify({ type: 'game', movement: movement, shot: shot }));
    shot = null;

    while (accumulatedTime >= fixedTimeStep) 
    {
      accumulatedTime -= fixedTimeStep;
    }
  }, fixedTimeStep);
}

function render(players, zombies, bullets) 
{
  if (currentPlayer) 
  {
    camera.x = currentPlayer.x - visibleCanvas.width / 2;
    camera.y = currentPlayer.y - visibleCanvas.height / 2;
  }

  // Clear canvas
  visibleCtx.clearRect(0, 0, visibleCanvas.width, visibleCanvas.height);

  // Save context state
  visibleCtx.save();

  // Translate canvas to camera position
  visibleCtx.translate(
    -Math.max(0, Math.min(camera.x, originalWidth - visibleCanvas.width)),
    -Math.max(0, Math.min(camera.y, originalHeight - visibleCanvas.height))
  );

  // Draw the background image at the translated position
  visibleCtx.drawImage(backgroundImage, 0, 0, originalWidth, originalHeight);

  for (const player of players) 
  {
    if (player.email == email)
    { currentPlayer = player; }

    visibleCtx.fillStyle = player.color;
    visibleCtx.fillRect(player.x, player.y, player.size, player.size);

    // Add player ID above the player character
    visibleCtx.font = '14px Arial';
    visibleCtx.fillStyle = 'black';
    visibleCtx.fillText(player.username, player.x, player.y - 5);

    if (player.isDead) 
    {
      // Draw a black cross over the dead player
      const crossSize = player.size + 1;
      visibleCtx.beginPath();
      visibleCtx.strokeStyle = 'black';
      visibleCtx.lineWidth = 3;
      visibleCtx.moveTo(player.x, player.y);
      visibleCtx.lineTo(player.x + crossSize, player.y + crossSize);
      visibleCtx.moveTo(player.x + crossSize, player.y);
      visibleCtx.lineTo(player.x, player.y + crossSize);
      visibleCtx.stroke();
    }
  }

  for (const zombie of zombies) 
  {
    visibleCtx.fillStyle = zombie.color;
    visibleCtx.fillRect(zombie.x, zombie.y, zombie.size, zombie.size);

    // Draw the life bar background 
    const lifeBarWidth = zombie.size;
    const lifeBarHeight = 5;
    const lifeBarOffset = 5;
    visibleCtx.fillStyle = 'red';
    visibleCtx.fillRect(zombie.x, zombie.y - lifeBarHeight - lifeBarOffset, lifeBarWidth, lifeBarHeight);

    // Draw the life bar fill
    const lifePercentage = zombie.life / Math.floor(zombie.size / 3);
    const lifeBarFillWidth = lifePercentage * lifeBarWidth;
    visibleCtx.fillStyle = 'green';
    visibleCtx.fillRect(zombie.x, zombie.y - lifeBarHeight - lifeBarOffset, lifeBarFillWidth, lifeBarHeight);
  }

  // Render bullets
  for (const bullet of bullets) 
  {
    visibleCtx.fillStyle = bullet.color;
    visibleCtx.beginPath();
    visibleCtx.arc(bullet.x, bullet.y, bullet.size, 0, 2 * Math.PI);
    visibleCtx.fill();
  }

  // Restore context state to initial
  visibleCtx.restore();

  if (currentPlayer.isDead) // Client player is dead
  { 
    if (bestScore < currentPlayer.score) // Update the best score locally
    { 
      bestScore = currentPlayer.score; 
      $('#bestScore').html('Best score: ' + bestScore);
    }
    $('#overlay').show(); 
  }

  $('#score').html('Score: ' + currentPlayer.score);
  if (oldScore != currentPlayer.score) // Update score
  {
    animateScoreIncrement(oldScore, currentPlayer.score); 
    oldScore = currentPlayer.score;
  }
}

$(function() 
{
  // Add an event listener for the respawn button
  $('#respawnBtn').on('click', function() 
  { socket.send(JSON.stringify({ type: 'respawn' })); });
});

function animateScoreIncrement(oldScore, newScore) 
{
  const increment = newScore - oldScore;
  
  let incrementElement = null;
  if (increment > 0)
  {
    incrementElement = $('<div>')
    .css({
      position: 'absolute',
      fontSize: '1.2em',
      color: 'green',
      opacity: 1,
    })
    .text(`+${increment}`);
  }
  else 
  {
    incrementElement = $('<div>')
    .css({
      position: 'absolute',
      fontSize: '1.2em',
      color: 'red',
      opacity: 1,
    })
    .text(`${increment}`);
  }

  const scorePosition = $('#score').position();

  incrementElement.css({
    top: scorePosition.top - 15,
    left: scorePosition.left,
  });

  $('.score-wrapper').append(incrementElement);

  incrementElement.animate(
    {
      top: '-=30px',
      opacity: 0,
    },
    1000,
    function () 
    { incrementElement.remove(); }
  );
}