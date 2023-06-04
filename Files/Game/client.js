const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

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
    
    canvas.width = width;
    canvas.height = height;
    const backgroundImage = new Image(); // Create a new Image object
    backgroundImage.src = '/Game/canvas-background.jpg'; // Set the image's src attribute to the path of the image file

    backgroundImage.onload = function () 
    { 
      ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height); 
      gameLoop();
    }; // Set the image's onload function to draw the image on the canvas
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
canvas.addEventListener('mousedown', (event) => 
{
  const rect = canvas.getBoundingClientRect();
  let mouseX = event.clientX - rect.left;
  let mouseY = event.clientY - rect.top;

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
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const player of players) 
  {
    if (player.email == email)
    { currentPlayer = player; }

    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.size, player.size);

    // Add player ID above the player character
    ctx.font = '14px Arial';
    ctx.fillStyle = 'black';
    ctx.fillText(player.username, player.x, player.y - 5);

    if (player.isDead) 
    {
      // Draw a black cross over the dead player
      const crossSize = player.size + 1;
      ctx.beginPath();
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 3;
      ctx.moveTo(player.x, player.y);
      ctx.lineTo(player.x + crossSize, player.y + crossSize);
      ctx.moveTo(player.x + crossSize, player.y);
      ctx.lineTo(player.x, player.y + crossSize);
      ctx.stroke();
    }
  }

  for (const zombie of zombies) 
  {
    ctx.fillStyle = zombie.color;
    ctx.fillRect(zombie.x, zombie.y, zombie.size, zombie.size);

    // Draw the life bar background 
    const lifeBarWidth = zombie.size;
    const lifeBarHeight = 5;
    const lifeBarOffset = 5;
    ctx.fillStyle = 'red';
    ctx.fillRect(zombie.x, zombie.y - lifeBarHeight - lifeBarOffset, lifeBarWidth, lifeBarHeight);

    // Draw the life bar fill
    const lifePercentage = zombie.life / Math.floor(zombie.size / 3);
    const lifeBarFillWidth = lifePercentage * lifeBarWidth;
    ctx.fillStyle = 'green';
    ctx.fillRect(zombie.x, zombie.y - lifeBarHeight - lifeBarOffset, lifeBarFillWidth, lifeBarHeight);
  }

  // Render bullets
  for (const bullet of bullets) 
  {
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.size, 0, 2 * Math.PI);
    ctx.fill();
  }

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