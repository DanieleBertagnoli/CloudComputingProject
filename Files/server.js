const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const cookie = require('cookie');
const bcrypt = require('bcrypt');
const saltRounds = 10;

const app = express();

// Configure express-session middleware
const sessionStore = new session.MemoryStore(); // Create a separate variable for the session store

const sessionMiddleware = session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  store: sessionStore, // Use the session store variable here
  cookie: { secure: false, maxAge: 3600000 }, // Customize the cookie settings as needed
});

app.use(sessionMiddleware);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/* ROUTES SERVED WITHOUT THE NEED OF BEING LOGGED */

app.use('/jquery.js', express.static('../node_modules/jquery/dist/jquery.min.js'));
app.use('/bootstrap.js', express.static('../node_modules/bootstrap/dist/js/bootstrap.bundle.min.js'));
app.use('/bootstrap.css', express.static('../node_modules/bootstrap/dist/css/bootstrap.min.css'));
app.use('/jquery.min.js.map', express.static('../node_modules/jquery/dist/jquery.min.js.map'));
app.use('/bootstrap.bundle.min.js.map', express.static('../node_modules/bootstrap/dist/js/bootstrap.bundle.min.js.map'));
app.use('/bootstrap.min.css.map', express.static('../node_modules/bootstrap/dist/css/bootstrap.min.css.map'));
app.get('/Game/game.html', (req, res) => { res.redirect('/game'); });
app.use(express.static('.'));

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, './Login_Signup/login.html')); }); // Defalut route

/* Function used to implement a middleware that checks whether the user is logged or not */
function checkLoggedIn(req, res, next) 
{
  if (req.session.loggedIn) 
  { next(); } 
  else 
  { res.redirect('/'); } // Redirect to login page if not logged in
}

/* Function called when the route /login is required */
app.post('/login', async (req, res) => 
{
  try 
  {
    const user = await login(req.body.email, req.body.password); // Get values from the request and call login function
    if(user) // If the credentials are correct then set all the parameters in the request that identify the user as logged
    {
      req.session.loggedIn = true;
      req.session.user = user;
      res.sendStatus(200);
    } 
    else 
    { res.status(401).send('Invalid email or password'); } // Otherwise send back an error message
  } 
  catch (error) 
  { res.status(500).send('Error while logging in'); }
});

/* Function called when the route /login is required */
app.post('/signup', async (req, res) => 
{
  try 
  {
    const newUser = await signup(req.body.email, req.body.password, req.body.username);  // Get values from the request and call signup function
    if(!newUser) // If the user is already present in the DB
    { res.status(401).send('User is already signed up'); } // Send back an error message
    else 
    { res.sendStatus(200); }
  } 
  catch (error) 
  { console.log(error); res.status(500).send('Error while signing up'); }
});

/* All the routes specified after this middleware are protected */
app.use(checkLoggedIn);
app.use('/game', express.static('./Game/game.html')); 

const server = http.createServer(app);
server.listen(3000, () => {
  console.log('Server listening on port 3000');
});






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
  console.log("Login attempt detected from " + email);
  
  return new Promise((resolve, reject) => 
  {
    // Select the hashed password from the database
    const sql = 'SELECT email, password, username FROM users WHERE email = ?';
    connection.query(sql, [email], async (err, results) => {
      if (err) 
      {
        console.error('Error during login:', err);
        reject(err);
      } 
      else 
      {
        if (results.length > 0) 
        {
          try // Compare the provided password with the stored hashed password
          {
            const match = await bcrypt.compare(password, results[0].password);
            if (match) // Passwords match, return the user's email and username
            { resolve({ email: results[0].email, username: results[0].username }); } 
            else // Passwords don't match, return null
            { resolve(null); }
          } 
          catch (err) 
          {
            console.error('Error during password comparison:', err);
            reject(err);
          }
        } 
        else // User not found, return null
        { resolve(null); }
      }
    });
  });
}

/* Function used to add the user to the DataBase */
async function signup(email, password, username) 
{
  const createTableSql = `
      CREATE TABLE IF NOT EXISTS users (
        email VARCHAR(255) NOT NULL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL
      );
    `; // Create the table if does not exists

  connection.query(createTableSql, (err) => 
  {
    if (err) 
    {
      console.error('Error during table creation:', err);
      reject(err);
    }
  });

  // Check if the user is already present in the DB
  return new Promise(async (resolve, reject) => 
  {
    let sql = 'SELECT * FROM users WHERE email = ?';
    connection.query(sql, [email], async (err, results) => 
    {
      if (err) 
      {
        console.error('Error during sign up:', err);
        reject(err);
      }

      if (results.length > 0) 
      {
        // The user is already signed up
        resolve(false);
      } 
      else 
      {
        // Hash the password
        try 
        {
          const hashedPassword = await bcrypt.hash(password, saltRounds);

          // Insert the user into the DB
          sql = 'INSERT INTO users (email, password, username) VALUES (?, ?, ?)';
          connection.query(sql, [email, hashedPassword, username], (err, results) => {
            if (err) 
            {
              console.error('Error during sign up:', err);
              reject(err);
            } 
            else 
            { resolve(true); }
          });
        } 
        catch (err) 
        {
          console.error('Error during password hashing:', err);
          reject(err);
        }
      }
    });
  });
}





                                                                            /* GAME LOGIC */


const getSessionFromRequest = async (req, sessionStore) => {
  const cookies = cookie.parse(req.headers.cookie || '');
  const sessionId = cookies['connect.sid'];

  if (sessionId) {
    // Remove the "s:" prefix and the signature from the session ID
    const unsignedSessionId = sessionId.slice(2).split('.')[0];

    return new Promise((resolve, reject) => {
      sessionStore.get(unsignedSessionId, (err, session) => {
        if (err) {
          reject(err);
        } else {
          resolve(session);
        }
      });
    });
  } else {
    return null;
  }
};


const wss = new WebSocket.Server({ server });

let players = [];
let zombies = [];

const speed = 1;
const width = 800; const height = 600;
const playerSize = 10

let lastPlayerMovement = new Map();

wss.on('connection', async (socket, req) => 
{
  const session = await getSessionFromRequest(req, sessionStore);

  var player = null;
  console.log("Spawning player:" + session.user.username)
  player = { email: session.user.email, username: session.user.username, x: 0, y: 0, size: playerSize, color: 'red',   gun: { x: 0, y: 0, size: 5, color: 'black' }, bullets: [] };
  players.push(player);

  const clientConfig = { width, height };
  socket.send(JSON.stringify({ type: 'clientConfig', clientConfig }));

  socket.on('message', (message) => 
  {
    const data = JSON.parse(message);

    if(data.type === 'game')
    {
      lastPlayerMovement.set(player.email, message);
    }
  });
  // socket.on('contextmenu', (event) => {
  //   event.preventDefault();

  //   const rect = canvas.getBoundingClientRect();
  //   const mouseX = event.clientX - rect.left;
  //   const mouseY = event.clientY - rect.top;

  //   const contextMenuMessage = {
  //     type: 'contextMenu',
  //     mouseX: mouseX,
  //     mouseY: mouseY
  //   };

  //   socket.send(JSON.stringify(contextMenuMessage));
  // });

  socket.on('close', () => 
  { 
    if(player != null)
    { players = players.filter((p) => p.email !== player.email); }

    if (players.length == 0)
    {
      process.exit(0);
    }
  });
});


// function updateBullets() {
//   for (const player of players) {
//     for (const bullet of player.bullets) {
//       bullet.x += bullet.direction.x * speed;
//       bullet.y += bullet.direction.y * speed;

//       // verify the collisions of the bullet with other players or obstacles
//       // to implement based on your game rules
//     }
//   }
// }

function playerMovement(message, player) 
{
  // console.log("PRINTING", message);
  if (message == null)
    return;

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

  // wss.clients.forEach((client) => 
  // {
  //   if (client.readyState === WebSocket.OPEN)
  //   { 
  //     client.send(JSON.stringify({type: 'renderData', players })); 
  //   }
  // });
}

function isInsideSafeCircle(players, x, y, safeRadius) {
  for (const player of players) {
    const distance = Math.sqrt(
      Math.pow(player.x - x, 2) + Math.pow(player.y - y, 2)
    );

    if (distance < safeRadius) {
      return true;
    }
  }

  return false;
}

function getRandomSpawnPosition(players, safeRadius, worldWidth, worldHeight) {
  let spawnX, spawnY;

  do {
    spawnX = Math.random() * worldWidth;
    spawnY = Math.random() * worldHeight;
  } while (isInsideSafeCircle(players, spawnX, spawnY, safeRadius));

  return {
    x: spawnX,
    y: spawnY,
  };
}

function render(zombies, players)
{
  wss.clients.forEach((client) => 
  {
    if (client.readyState === WebSocket.OPEN)
    { 
      client.send(JSON.stringify({type: 'renderData', players, zombies })); 
    }
  });
}

function distance(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

function findClosestPlayer(zombie, players) {
  let closestPlayer = null;
  let minDistance = Infinity;

  for (const player of players) {
    const dist = distance(zombie.x, zombie.y, player.x, player.y);

    if (dist < minDistance) {
      minDistance = dist;
      closestPlayer = player;
    }
  }

  return closestPlayer;
}

function moveZombieTowardsPlayer(zombie, player, speed) {
  const dist = distance(zombie.x, zombie.y, player.x, player.y);
  const deltaX = (player.x - zombie.x) / dist;
  const deltaY = (player.y - zombie.y) / dist;

  zombie.x += deltaX * zombie.speed;
  zombie.y += deltaY * zombie.speed;
}

function gameLoop() {
  const fixedTimeStep = 1000 / 240; // Update the game 60 times per second
  let lastUpdateTime = performance.now();
  let accumulatedTime = 0;

  setInterval(() => {
    const currentTime = performance.now();
    const deltaTime = currentTime - lastUpdateTime;
    lastUpdateTime = currentTime;
    accumulatedTime += deltaTime;

    // Player movement
    for(const player of players)
    {
      playerMovement(lastPlayerMovement.get(player.email), player);
    }

    //Spawn new zombies if a new player connects
    if(zombies.length < 20 * players.length)
    {
      zombieCoord = getRandomSpawnPosition(players, 3, width, height);
      zombies.push({x: zombieCoord.x, y: zombieCoord.y, size: 10, color: 'green', speed: Math.random() * (0.7 - 0.1) + 0.1});
    }

    //Remove zombies if a player disconnects.
    if(zombies.length > 20 * players.length)
    {
      zombies.pop();
    }

    //Update Zombies
    for (const zombie of zombies) {
      const closestPlayer = findClosestPlayer(zombie, players);
      moveZombieTowardsPlayer(zombie, closestPlayer);
    }

    // Collision detection (zombies and players)
       // a zombie have to be identified by x and y 

    while (accumulatedTime >= fixedTimeStep) {
      //Render Stuff

      render(zombies, players);
      accumulatedTime -= fixedTimeStep;
      //updateBullets();
    }
  }, fixedTimeStep);
}

gameLoop();