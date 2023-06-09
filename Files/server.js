process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('uncaughtException', (error) => 
{
  console.error('Uncaught exception:', error);
  gracefulShutdown();
});

const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const cookie = require('cookie');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');

const saltRounds = 10;

const app = express();

const isProduction = true;

const localDbConfig = 
{
  connectionLimit: 1,
  host: 'localhost',
  user: 'root',
  password: '1801',
  database: 'zombie_io',
};

const awsDbConfig = 
{
  connectionLimit: 1,
  host: 'cloud-computing-db-2.cqt22j2anxrg.us-east-1.rds.amazonaws.com',
  user: 'user',
  password: 'zombie',
  database: 'zombie_io',
};

const dbConfig = isProduction ? awsDbConfig : localDbConfig;
// const connection = mysql.createConnection(dbConfig);

// Configure the connection pool with your database details
const pool = mysql.createPool(dbConfig);

// connection.connect((err) => 
// {
//   if (err) 
//   {
//     console.error('Error connecting to the database:', err.stack);
//     return;
//   }
//   console.log('Connected to the database as ID', connection.threadId);
// });

const sessionStore = new MySQLStore(dbConfig);

const sessionMiddleware = session({
  key: 'your-session-key',
  secret: 'your-session-secret',
  resave: false,
  saveUninitialized: true,
  store: sessionStore, // Use the session store variable here
  cookie: { secure: false, maxAge: 3600000 }, // Customize the cookie settings as needed
});

app.use(cookieParser());
app.use(sessionMiddleware);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Routes served without the need of being logged in
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
  if (req.session.loggedIn && req.session.user) 
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
    if(user && isNaN(user)) // If the credentials are correct then set all the parameters in the request that identify the user as logged
    {
      req.session.loggedIn = true;
      req.session.user = user;
      res.sendStatus(200);
    } 
    else if(user == 1)
    { res.status(401).send('Invalid email or password'); } // Otherwise send back an error message
    
    else if(user == 2)
    { res.status(401).send('User already logged'); } // Otherwise send back an error message
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
  { res.status(500).send('Error while signing up'); }
});

// All the routes specified after this middleware are protected
app.use(checkLoggedIn);
app.use('/game', express.static('./Game/game.html')); 

const server = http.createServer(app);
server.listen(3000, () => {
  console.log('Server listening on port 3000');
});






                                                                            /* DATABASE MANAGEMENT */

/* Function used to login the user */
async function login(email, password) 
{
  console.log("Login attempt detected from " + email);

  return new Promise((resolve, reject) => 
  {
    // Check if the user exists
    let sql = 'SELECT email, password, username, isLogged, bestScore FROM users WHERE email = ?';
    pool.query(sql, [email], async (err, results) => 
    {
      if (err) 
      {
        console.error('Error during login:', err);
        reject(err);
      } 
      else 
      {
        if (results.length > 0 && results[0].isLogged == 1) // User was already logged, return 2
        { resolve(2); } 
        else if (results.length > 0) 
        {
          try // Compare the provided password with the stored hashed password
          {
            const match = await bcrypt.compare(password, results[0].password);
            if (match) // Passwords match, return the user's email and username
            {
              resolve({
                email: results[0].email,
                username: results[0].username,
                bestScore: results[0].bestScore
              });
              // Update the user status as logged in
              sql = 'UPDATE users SET isLogged = 1 WHERE email = ?';
              pool.query(sql, [email], async (err, results) => {
                if (err) {
                  console.error('Error during login:', err);
                  reject(err);
                }
              });
            } 
            else // Passwords don't match, return 1
            { resolve(1); }
          } 
          catch (err) 
          {
            console.error('Error during password comparison:', err);
            reject(err);
          }
        } 
        else // User not found, return 1
        { resolve(1); }
      }
    });
  });
}


/* Function used to logout the user */
async function logout(email, bestScore) 
{
  console.log("Logout attempt detected from " + email);
  updateScore(email, bestScore);

  // Update the Database
  return new Promise((resolve, reject) => {
    sql = 'UPDATE users SET isLogged = 0 WHERE email = ?';
    pool.query(sql, [email], async (err, results) => {
      if (err) {
        console.error('Error during logout:', err);
        reject(err);
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
      password VARCHAR(255) NOT NULL,
      isLogged TINYINT(1) NOT NULL,
      bestScore INT NOT NULL
    );
  `; // Create the table if does not exist

  pool.query(createTableSql, (err) => 
  {
    if (err) {
      console.error('Error during table creation:', err);
      reject(err);
    }
  });

  // Check if the user is already present in the DB
  return new Promise(async (resolve, reject) => 
  {
    let sql = 'SELECT * FROM users WHERE email = ?';
    pool.query(sql, [email], async (err, results) => 
    {
      if (err) 
      {
        console.error('Error during sign up:', err);
        reject(err);
      }

      if (results.length > 0) // The user is already signed up
      { resolve(false); } 
      else 
      {
        try // Hash the password
        {
          const hashedPassword = await bcrypt.hash(password, saltRounds);

          // Insert the user into the DB
          sql = 'INSERT INTO users (email, password, username, isLogged, bestScore) VALUES (?, ?, ?, ?, 0)';
          pool.query(sql, [email, hashedPassword, username, 0], (err, results) => {
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

/* Function used to update user's best score  */
async function updateScore(email, newScore) 
{
  // Update the Database
  return new Promise((resolve, reject) => 
  {
    sql = 'UPDATE users SET bestScore = ? WHERE email = ?';
    pool.query(sql, [newScore, email], async (err, results) => 
    {
      if (err) 
      {
        console.error('Error during the score update:', err);
        reject(err);
      }
    });
  });
}

/* Function used to get the world record  */
async function getWorldRecord() 
{
  return new Promise((resolve, reject) => 
  {
    sql = 'SELECT username, bestScore FROM users ORDER BY bestScore DESC LIMIT 1';
    pool.query(sql, (err, results) => 
    {
      if (err) 
      {
        console.error('Error during the score update:', err);
        reject(err);
      } 
      else 
      {
        worldRecord = {
          username: "None",
          bestScore: 0
        };
        if (results.length > 0) 
        {
          worldRecord = {
            username: results[0].username,
            bestScore: results[0].bestScore
          };
        }
        resolve(worldRecord);
      }
    });
  });
}


async function gracefulShutdown() 
{
  console.log('\n\nGracefully shutting down the server...');

  // Wait for a short time before closing the connections
  setTimeout(async () => 
  {
    // Create an array of promises that resolve when each connection is closed
    const closePromises = [];

    wss.clients.forEach((client) => 
    {
      if (client.readyState === WebSocket.OPEN) 
      {
        const closePromise = new Promise((resolve) => 
        {
          client.once('close', () => 
          { resolve(); });
          client.close();
        });
        closePromises.push(closePromise);
      }
    });

    // Wait for all connections to close
    await Promise.all(closePromises);

    // Close the WebSocket server
    wss.close((err) => 
    {
      if (err) 
      { console.error('Error closing WebSocket server:', err); } 
      else 
      { console.log('WebSocket server closed'); }
    });

    console.log('All users successfully logged out');

    try 
    {
      // Stop the server
      server.close(() => 
      {
        console.log('Server stopped');

        // Force the process to exit after a timeout regardless of the event loop state
        setTimeout(() => 
        {
          console.log('Forcing process exit');
          process.exit(0);
        }, 5000); // Wait for 5 seconds
      });
    } 
    catch (error) 
    {
      console.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }, 1000); // Wait for 1 second before starting the shutdown process
}

                                                                            /* GAME LOGIC */


/* Function used to get a session */
const getSessionFromRequest = async (req, sessionStore) => 
{
  const cookies = cookie.parse(req.headers.cookie || '');

  let sessionId = null;
  if ('your-session-key' in cookies)
  { sessionId = cookies['your-session-key']; } 

  if (sessionId != null) 
  {
    // Remove the "s:" prefix and the signature from the session ID
    const unsignedSessionId = sessionId.slice(2).split('.')[0];

    return new Promise((resolve, reject) => 
    {
      sessionStore.get(unsignedSessionId, (err, session) => 
      {
        if (err) 
        { reject(err); } 
        else 
        { resolve(session); }
      });
    });
  } 
  else 
  { resolve(null); }
};


const wss = new WebSocket.Server({ server }); // Web server socket

let players = [];
let zombies = [];
let bullets = [];

const numZombiesPerPlayer = 3;
const speed = 1;
const width = 3000; const height = 3000;
const playerSize = 10
const bulletSpeed = 3;
const maxZombies = 50;

let lastPlayerMovement = new Map();

// When the socket is opened
wss.on('connection', async (socket, req) => 
{
  const session = await getSessionFromRequest(req, sessionStore); // Get the session
  if(session == null)
  { socket.close(); }
  
  var player = null;
  console.log("Spawning player:" + session.user.username)
  
  // randomize the player's initial position
  let x_i = Math.floor(Math.random() * width);
  let y_i = Math.floor(Math.random() * height);
  player = { email: session.user.email, username: session.user.username, x: x_i, y: y_i, size: playerSize, color: '#0073ff', isDead: false, score: 0, bestScore: session.user.bestScore }; // Create the new player
  players.push(player); // Add it to the players' list

  const clientConfig = { width, height }; //Send the client configuration parameters
  socket.send(JSON.stringify({ type: 'clientConfig', clientConfig: clientConfig, email: player.email, bestScore: player.bestScore, worldRecord: await getWorldRecord() }));

  // When a new message is received through the socket
  socket.on('message', (message) => 
  {
    const data = JSON.parse(message);

    if(data.type === 'game')
    { 
      if(data.shot != null && !player.isDead) // If the player has shot and is alive
      {
        // Get the coordinates of the mouse
        let shotX = Math.floor(data.shot.mouseX); 
        let shotY = Math.floor(data.shot.mouseY);

        // Get the id of the bullet
        let id = 0;
        if (bullets.length > 0)
        { id = bullets[bullets.length - 1].id; }

        // Create the bullet and add it to the list
        let bullet = { id: id + 1, x: player.x, y: player.y, directionVector: getDirectionVector(player.x, player.y, shotX, shotY), owner: player.email, size: 4, color: 'black' };
        bullets.push(bullet);
      }
      lastPlayerMovement.set(player.email, data.movement); 
    }
    
    else if(data.type === 'respawn' && player.isDead)
    { 
      let newCoords = getRandomSpawnPosition(zombies, 200, width, height)
      player.x = newCoords.x
      player.y = newCoords.y
      player.isDead = false; 
      player.score = 0;
      socket.send(JSON.stringify({ type: 'respawned' }));
      global.gc();
      const bufferedAmount = socket.bufferedAmount;
      console.log(`Buffered data size: ${bufferedAmount} bytes   player ${player.username}`);
    }
  });

  
  // When the socket is closed
  socket.on('close', async () => 
  { 
    if(player != null)
    { 
      players = players.filter((p) => p.email !== player.email); // Remove the player from the list
      await logout(player.email, player.bestScore) // Logout the player
    }
  });
});


/* Function used to get the direction vector */
function getDirectionVector(x0, y0, x1, y1) 
{
  const dx = x1 - x0;
  const dy = y1 - y0;

  // Calculate the magnitude of the vector
  const magnitude = Math.sqrt(dx * dx + dy * dy);

  // Normalize the vector to have a magnitude of 1
  const directionX = dx / magnitude;
  const directionY = dy / magnitude;

  return { x: directionX, y: directionY };
}


/* Function used to check if two entities are colliding */
function isColliding(rect1, rect2) 
{
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
}

/* Function used to check if thw entities would collide if moved */
function wouldCollideWithOtherEntities(entities, currentEntity, newX, newY, size) 
{
  const testRect = { x: newX, y: newY, width: size, height: size };

  for (const entity of entities) 
  {
    if (entity === currentEntity) continue;

    const entityRect = { x: entity.x, y: entity.y, width: entity.size, height: entity.size };

    if (isColliding(testRect, entityRect)) 
    { return true; }
  }
  return false;
}

/* Function used to update the player position */
function playerMovement(movement, player) 
{
  if (movement == null) 
  { return; }

  // Get the player current coordinates
  let newX = player.x;  
  let newY = player.y; 

  // Check movement in x-axis
  if (movement.a) newX -= speed;
  if (movement.d) newX += speed;

  // Check bounding box in x-axis
  if (newX < 0) 
  { player.x = 0; } 
  else if (newX > (width - playerSize)) 
  { player.x = (width - playerSize); } 
  else if (!wouldCollideWithOtherEntities(players, player, newX, newY, player.size)) 
  { player.x = newX; }

  // Reset newX for y-axis movement check
  newX = player.x;

  // Check movement in y-axis
  if (movement.w) newY -= speed;
  if (movement.s) newY += speed;

  // Check bounding box in y-axis
  if (newY < 0) 
  { player.y = 0; } 
  else if (newY > (height - playerSize)) 
  { player.y = height - playerSize; } 
  else if (!wouldCollideWithOtherEntities(players, player, newX, newY, player.size)) 
  { player.y = newY; }  
  
  player.x = parseFloat(player.x.toFixed(1));
  player.y = parseFloat(player.y.toFixed(1));
}


/* Function used to check if the the zombie can be spawned in the coordinates */
function isInsideSafeCircle(players, x, y, safeRadius)
{
  for (const player of players) 
  {
    const distance = Math.sqrt(
      Math.pow(player.x - x, 2) + Math.pow(player.y - y, 2)
    );

    if (distance < safeRadius) 
    { return true; }
  }

  return false;
}


/* Get the coordinates to spawn the zombie randomly */
function getRandomSpawnPosition(players, safeRadius, worldWidth, worldHeight) 
{
  let spawnX, spawnY;

  do 
  {
    spawnX = Math.random() * worldWidth;
    spawnY = Math.random() * worldHeight;
  } while (isInsideSafeCircle(players, spawnX, spawnY, safeRadius));

  return {
    x: spawnX,
    y: spawnY,
  };
}


const bufferLimit = 10;

/* Function used to send the data to be rendered by the client */
function render(zombies, players, bullets)
{
  wss.clients.forEach((client) => 
  {
    if (client.readyState === WebSocket.OPEN && client.bufferedAmount <= bufferLimit)
    { 
      let str = JSON.stringify({type: 'renderData', players, zombies, bullets });
      client.send(str);
    }
  });
}


/* Function used to calculate the euclidian distance */
function distance(x1, y1, x2, y2) 
{ return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));}


/* Function used to find the closest player with respect to the zombie */
function findClosestPlayer(zombie, players) 
{
  let closestPlayer = null;
  let minDistance = Infinity;

  for (const player of players) 
  {
    if (player.isDead)
    { continue; }

    const dist = distance(zombie.x, zombie.y, player.x, player.y);

    if (dist < minDistance) 
    {
      minDistance = dist;
      closestPlayer = player;
    }
  }

  return closestPlayer;
}


/* Function used to move the zombie towards the closest player */
function moveZombieTowardsPlayer(zombie, zombies, speed) 
{
  const player = findClosestPlayer(zombie, players); // Find the closest player

  if(player == null)
  { return; }

  const dist = distance(zombie.x, zombie.y, player.x, player.y);
  const deltaX = (player.x - zombie.x) / dist;
  const deltaY = (player.y - zombie.y) / dist;

  const newX = zombie.x + deltaX * zombie.speed;
  const newY = zombie.y + deltaY * zombie.speed;

  // Check movement and collisions in x-axis
  if (!wouldCollideWithOtherEntities(zombies, zombie, newX, zombie.y, zombie.size)) 
  { zombie.x = newX; }

  // Check movement and collisions in y-axis
  if (!wouldCollideWithOtherEntities(zombies, zombie, zombie.x, newY, zombie.size)) 
  { zombie.y = newY; }

  zombie.x = parseFloat(zombie.x.toFixed(1));
  zombie.y = parseFloat(zombie.y.toFixed(1));
}


/* Function used to update all entities */
function gameLoop() 
{
  const fixedTimeStep = 1000 / 240; // Update the game 240 times per second
  let lastUpdateTime = performance.now();
  let accumulatedTime = 0;

  setInterval(() => 
  {
    const currentTime = performance.now();
    const deltaTime = currentTime - lastUpdateTime;
    lastUpdateTime = currentTime;
    accumulatedTime += deltaTime;

    // Player movement
    for(const player of players)
    {
      if(!player)
      { continue; }

      if (!player.isDead)
      { playerMovement(lastPlayerMovement.get(player.email), player); }
    }
    
    /* This function calculates the speed of the zombie based on his size (max size -> min speed) */
    function calculateZombieSpeed(size) 
    {    
      var minOutput = 0.7;
      var maxOutput = 0.3;
    
      var output = (size - 8) / (30 - 8) * (maxOutput - minOutput) + minOutput;
    
      return output;
    }

    /* This function calculates the life of the zombie based on his size (max size -> max life) */
    function calculateZombieLife(size) 
    { return Math.floor(size/3); }

    playersScore = 0;

    for (const player of players)
    { 
      if(!player)
      { continue; }
      playersScore += player.score; 
    }

    let numZombies = Math.min(numZombiesPerPlayer * players.length + Math.floor(playersScore / 50), maxZombies);

    for (let i = zombies.length; i < numZombies; i++)
    {
      zombieCoord = getRandomSpawnPosition(players, 200, width, height);
      let id = 0;
      if (zombies.length > 0)
      { id = zombies[zombies.length - 1].id + 1; }
      var random_size = Math.floor(Math.random() * (31 - 8)) + 8;
      zombies.push({id: id, x: zombieCoord.x, y: zombieCoord.y, size: random_size, color: '#006400', speed: calculateZombieSpeed(random_size), life: calculateZombieLife(random_size)});
    }

    // Update Zombies
    for (const zombie of zombies) 
    { moveZombieTowardsPlayer(zombie, zombies); }

    // Collision detection (zombies and players)
    for (const zombie of zombies) 
    {
      for(const player of players) 
      {
        if(!player)
        { continue; }
      
        const zombieRect = { x: zombie.x, y: zombie.y, width: zombie.size, height: zombie.size };
        const playerRect = { x: player.x, y: player.y, width: player.size, height: player.size };
        
        if (isColliding(zombieRect, playerRect)) // If the zombie and the player have collided, mark the player as dead
        { 
          player.isDead = true; 
          if (player.bestScore < player.score)
          { player.bestScore = player.score; }
        }
      }
    }

    // Update bullets
    for (const bullet of bullets)
    { 
      if (Math.abs(bullet.x) > width || Math.abs(bullet.y) > height) // Remove bullet
      { bullets = bullets.filter((obj) => obj.id != bullet.id); }
      
      bullet.x = bullet.x + (bullet.directionVector.x * bulletSpeed);
      bullet.y = bullet.y + (bullet.directionVector.y * bulletSpeed);

      bullet.x = parseFloat(bullet.x.toFixed(1));
      bullet.y = parseFloat(bullet.y.toFixed(1));
      
      // Check if the bullet has hitted a zombie
      for (const zombie of zombies) 
      {
        const zombieRect = { x: zombie.x, y: zombie.y, width: zombie.size, height: zombie.size };
        const bulletRect = { x: bullet.x, y: bullet.y, width: bullet.size, height: bullet.size };
        if(isColliding(zombieRect, bulletRect))
        {
          bullets = bullets.filter((obj) => obj.id !== bullet.id);
          zombies = zombies
            .map((obj) => 
              {
                if (obj.id == zombie.id) obj.life -= 1;
                
                if (obj.id == zombie.id && obj.life == 0) // Last hit
                { 
                  let player = players.find((obj) => obj.email === bullet.owner); 
                  player.score += Math.floor(zombie.size/3); // Update score
                }

                return obj;
              })
            .filter((obj) => obj.life > 0);
        }
      }
    }

    // Rendering
    while (accumulatedTime >= fixedTimeStep)
    {
      render(zombies, players, bullets);
      accumulatedTime -= fixedTimeStep;
    }
  }, fixedTimeStep);
}

gameLoop();