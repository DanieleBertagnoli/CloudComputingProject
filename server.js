const http = require('http');
const WebSocket = require('ws');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const player = 
{
    x: 400,
    y: 300,
};

const enemies = [
    // Aggiungi i tuoi nemici qui, ad esempio:
    // { x: 100, y: 100, width: 20, height: 20 },
    { x: 100, y: 100, width: 20, height: 20 }
];

wss.on('connection', (socket) => 
{
    console.log('Client connesso');

    socket.on('message', (message) => 
    {
        const data = JSON.parse(message);
        if (data.key) 
        {
            // Aggiorna la posizione del giocatore in base al tasto premuto
            // Aggiorna anche la posizione dei nemici

            socket.send(JSON.stringify({ player, enemies }));
        }
    });

    socket.on('close', () => 
    {
        console.log('Client disconnesso');
    });
});

server.listen(3000, () => 
{
    console.log('Server in ascolto sulla porta 3000');
});