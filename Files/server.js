const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => 
{
  const filePath = getFilePath(req.url);
  const contentType = getContentType(filePath);

  if (fs.existsSync(filePath)) 
  {
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(fs.readFileSync(filePath));
  } 
  else 
  {
    res.writeHead(404);
    res.end();
  }
});

function getFilePath(url) 
{
  if (url === '/') 
  { return './Login_Signup/login.html'; } 
  
  else if (url === '/jquery.js') 
  { return '../node_modules/jquery/dist/jquery.min.js'; } 
  
  else if (url === '/bootstrap.js') 
  { return '../node_modules/bootstrap/dist/js/bootstrap.bundle.min.js'; } 
  
  else if (url === '/bootstrap.css') 
  { return '../node_modules/bootstrap/dist/css/bootstrap.min.css'; }
  
  else 
  { return '.' + url; }
}

function getContentType(filePath) 
{
  const ext = path.extname(filePath);

  switch (ext) 
  {
    case '.html':
      return 'text/html';
    case '.css':
      return 'text/css';
    case '.js':
      return 'application/javascript';
    default:
      return 'application/octet-stream';
  }
}



/* GAME LOGIC */

const wss = new WebSocket.Server({ server });

let players = [];

const speed = 4;
const width = 800; const height = 600;
const playerSize = 10

wss.on('connection', (socket) => 
{
  const player = { id: Date.now(), x: 0, y: 0, size: playerSize, color: 'red' };
  players.push(player);

  //Setup all the things we need.
  const clientConfig = { width, height };
  socket.send(JSON.stringify({ type: 'clientConfig', clientConfig }));

  socket.on('message', (message) => 
  {
    const data = JSON.parse(message);

    if(data.type === 'login') 
    { 
      const { email, password } = data.payload;
      login(email, password) 
    }

    if(data.type === 'signup')
    { 
      const { email, password } = data.payload;
      signup(email, password) 
    }

    if(data.type === 'game')
    { gameLogic(message, player); }
  });

  socket.on('close', () => 
  { players = players.filter((p) => p.id !== player.id); });
});

server.listen(3000, () => {
    console.log('Server listening on port 3000');
});

function gameLogic(message, player) 
{
  const { movement } = JSON.parse(message);
  let newX = player.x;
  let newY = player.y;
  
  if (movement.ArrowUp) newY -= speed;
  if (movement.ArrowDown) newY += speed;
  if (movement.ArrowLeft) newX -= speed;
  if (movement.ArrowRight) newX += speed;
  /* Bounding Boxes */
  
  // X-axis
  if (newX < 0)
  { player.x = 0; }
  else if (newX > (width - playerSize))
  { player.x = (width - playerSize); }
  //Y-axis
  else if (newY < 0)
  { player.y = 0; }
  else if (newY > (height - playerSize))
  { player.y = (height - playerSize); }
  
  else 
  { player.x = newX; player.y = newY; }
  wss.clients.forEach((client) => 
  {
    if (client.readyState === WebSocket.OPEN)
    { client.send(JSON.stringify({type: 'renderData', players })); }
  });
}



/* DATABASE MANAGEMENT */

const isProduction = false;

const localDbConfig = 
{
  host: 'localhost',
  user: 'root',
  password: '1801',
  database: 'zombie_io',
};

const awsDbConfig = 
{
  host: process.env.AWS_DB_HOST,
  user: process.env.AWS_DB_USER,
  password: process.env.AWS_DB_PASSWORD,
  database: process.env.AWS_DB_NAME,
};

const dbConfig = isProduction ? awsDbConfig : localDbConfig;
const mysql = require('mysql2');
const { sign } = require('crypto');

const connection = mysql.createConnection(dbConfig);
connection.connect((err) => 
{
  if (err) 
  {
    console.error('Error connecting to the database:', err.stack);
    return;
  }
  console.log('Connected to the database as ID', connection.threadId);
});


async function login(email, password) 
{
  return new Promise((resolve, reject) => 
  {
    const sql = 'SELECT * FROM users WHERE email = ? AND password = ?';
    connection.query(sql, [email, password], (err, results) => 
    {
      if (err) 
      { reject(err); } 
      else 
      { resolve(results[0]); }
    });
  });
}

async function signup(email, password) 
{
  return new Promise((resolve, reject) => 
  {
    const sql = 'INSERT INTO users SET (email, password) VALUES (?, ?)';
    connection.query(sql, [email, password], (err, results) => 
    {
      if (err) 
      { reject(err); } 
      else 
      { resolve(results[0]); }
    });
  });
}
