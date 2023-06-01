const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const player = 
{
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 10,
    color: 'red',
};

const enemies = [];

const socket = new WebSocket('ws://localhost:3000'); // Usa l'indirizzo del tuo server

socket.addEventListener('open', () => 
{
    console.log('Connesso al server');
});

socket.addEventListener('message', (message) => 
{
    const data = JSON.parse(message.data);
    if (data.player) 
    {
        player.x = data.player.x;
        player.y = data.player.y;
    }

    if (data.enemies) 
    {
        enemies.length = 0;
        data.enemies.forEach(enemy => 
        {
            enemies.push(enemy);
        });
    }
});

function draw() 
{
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();
    ctx.closePath();

    enemies.forEach(enemy => 
    {
        ctx.beginPath();
        ctx.rect(enemy.x, enemy.y, enemy.width, enemy.height);
        ctx.fillStyle = 'green';
        ctx.fill();
        ctx.closePath();
    });

    requestAnimationFrame(draw);
}

draw();

document.addEventListener('keydown', (event) => 
{
    socket.send(JSON.stringify({ key: event.key }));
});