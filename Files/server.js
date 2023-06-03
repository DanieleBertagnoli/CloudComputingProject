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
    // Check if the user exists
    let sql = 'SELECT email, password, username, isLogged FROM users WHERE email = ?';
    connection.query(sql, [email], async (err, results) => 
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
              resolve({ email: results[0].email, username: results[0].username }); 
              // Update the user status as logged in
              sql = 'UPDATE users SET isLogged = 1 WHERE email = ?';
              connection.query(sql, [email], async (err, results) => 
              {
                if (err) 
                {
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


async function logout(email)
{
  console.log("Logout attempt detected from " + email);

  return new Promise((resolve, reject) => 
  {
    sql = 'UPDATE users SET isLogged = 0 WHERE email = ?';
    connection.query(sql, [email], async (err, results) => 
    {
      if (err) 
      {
        console.error('Error during login:', err);
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
        isLogged TINYINT(1) NOT NULL
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
          sql = 'INSERT INTO users (email, password, username, isLogged) VALUES (?, ?, ?, ?)';
          connection.query(sql, [email, hashedPassword, username, 0], (err, results) => {
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


const getSessionFromRequest = async (req, sessionStore) => 
{
  const cookies = cookie.parse(req.headers.cookie || '');
  const sessionId = cookies['connect.sid'];

  if (sessionId) 
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
  { return null; }
};


const wss = new WebSocket.Server({ server });

let players = [];
let zombies = [];
let bullets = [];

const numZombiesPerPlayer = 1;
const speed = 1;
const width = 800; const height = 600;
const playerSize = 10
const bulletSpeed = 3;

let lastPlayerMovement = new Map();

wss.on('connection', async (socket, req) => 
{
  const session = await getSessionFromRequest(req, sessionStore);

  var player = null;
  console.log("Spawning player:" + session.user.username)
  player = { email: session.user.email, username: session.user.username, x: 0, y: 0, size: playerSize, color: 'red', isDead: false};
  players.push(player);

  const clientConfig = { width, height };
  socket.send(JSON.stringify({ type: 'clientConfig', clientConfig }));

  socket.on('message', (message) => 
  {
    const data = JSON.parse(message);

    if(data.type === 'game')
    { 
      if(data.shot != null)
      {
        let shotX = Math.floor(data.shot.mouseX);
        let shotY = Math.floor(data.shot.mouseY);

        let id = 0;
        if (bullets.length > 0)
        { id = bullets[bullets.length - 1].id; }

        let bullet = { id: id + 1, x: player.x, y: player.y, directionVector: getDirectionVector(player.x, player.y, shotX, shotY), owner: player.email, size: 4, color: 'blue' };
        bullets.push(bullet);
      }
      lastPlayerMovement.set(player.email, data.movement); 
    }
  });

  socket.on('close', () => 
  { 
    if(player != null)
    { 
      players = players.filter((p) => p.email !== player.email); 
      logout(player.email)
    }

    if (players.length == 0)
    { process.exit(0); }
  });
});


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


function isColliding(rect1, rect2) 
{
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
}

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

function playerMovement(movement, player) 
{
  if (movement == null) return;

  // const { movement } = JSON.parse(message);
  let newX = player.x;
  let newY = player.y;

  // Check movement in x-axis
  if (movement.ArrowLeft) newX -= speed;
  if (movement.ArrowRight) newX += speed;

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
  if (movement.ArrowUp) newY -= speed;
  if (movement.ArrowDown) newY += speed;

  // Check bounding box in y-axis
  if (newY < 0) 
  { player.y = 0; } 
  else if (newY > (height - playerSize)) 
  { player.y = (height - playerSize); } 
  else if (!wouldCollideWithOtherEntities(players, player, newX, newY, player.size)) 
  { player.y = newY; }  
}

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

function render(zombies, players, bullets)
{
  wss.clients.forEach((client) => 
  {
    if (client.readyState === WebSocket.OPEN)
    { client.send(JSON.stringify({type: 'renderData', players, zombies, bullets })); }
  });
}

function distance(x1, y1, x2, y2) 
{ return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));}

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

function moveZombieTowardsPlayer(zombie, zombies, speed) 
{
  const player = findClosestPlayer(zombie, players);

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
}

function gameLoop() 
{
  const fixedTimeStep = 1000 / 240; // Update the game 60 times per second
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
      if (!player.isDead)
      { playerMovement(lastPlayerMovement.get(player.email), player); }
    }

    //Spawn new zombies if a new player connects
    if(zombies.length < numZombiesPerPlayer * players.length)
    {
      zombieCoord = getRandomSpawnPosition(players, 3, width, height);
      let id = 0;
      if (zombies.length > 0)
      { id = zombies[zombies.length - 1].id; }
      zombies.push({id: id, x: zombieCoord.x, y: zombieCoord.y, size: 10, color: 'green', speed: Math.random() * (0.7 - 0.1) + 0.1});
    }

    //Remove zombies if a player disconnects.
    if(zombies.length > numZombiesPerPlayer * players.length)
    { zombies.pop(); }

    //Update Zombies
    for (const zombie of zombies) 
    { moveZombieTowardsPlayer(zombie, zombies); }

    // Collision detection (zombies and players)
    for (const zombie of zombies) 
    {
      for(const player of players) 
      {
        const zombieRect = { x: zombie.x, y: zombie.y, width: zombie.size, height: zombie.size };
        const playerRect = { x: player.x, y: player.y, width: player.size, height: player.size };
        
        if (isColliding(zombieRect, playerRect)) 
        {
          player.isDead = true;
          // console.log("FUCKING EATEN ALIVE! AAAAAAAAAAAAAAAAAAAAAAH! IT HURTS. OH GOD THEY ARE RIPPING MY BALLS OUT WITH THEIR MOUDLY MOUTHS. OH YEAH I LIKE THIS SHIT!! KEEP GOING YEAH!");
        }
      }
    }

    // Update bullets
    for (const bullet of bullets)
    { 
      if (bullet.x > width || bullet.y > height) // Remove bullet
      { bullets = bullets.filter((obj) => obj.id !== bullet.id); }
      
      bullet.x = bullet.x + (bullet.directionVector.x * bulletSpeed);
      bullet.y = bullet.y + (bullet.directionVector.y * bulletSpeed);
      
      for (const zombie of zombies)
      {
        const zombieRect = { x: zombie.x, y: zombie.y, width: zombie.size, height: zombie.size };
        const bulletRect = { x: bullet.x, y: bullet.y, width: bullet.size, height: bullet.size };
        if(isColliding(zombieRect, bulletRect))
        {
          bullets = bullets.filter((obj) => obj.id !== bullet.id);
          zombies = zombies.filter((obj) => obj.id !== zombie.id);
        }
      }
    }


    while (accumulatedTime >= fixedTimeStep)
    {
      //Render Stuff

      render(zombies, players, bullets);
      accumulatedTime -= fixedTimeStep;
      //updateBullets();
    }
  }, fixedTimeStep);
}

gameLoop();