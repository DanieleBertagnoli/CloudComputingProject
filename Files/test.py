import asyncio
import requests
import websockets
import json
import time
import random
import http

from websockets import WebSocketClientProtocol
from websockets import WebSocketClientProtocol

socket_list = []

class CustomWebSocketClientProtocol(WebSocketClientProtocol):

    async def ping(self, data: bytes = None) -> None:
        print("Received a ping frame.")
        await super().ping(data)

    async def keepalive_ping(self):
        """
        Override the keepalive_ping method to disable the ping/pong mechanism.
        """
        pass


async def game_websocket(ws_uri, session_cookies, queue):
    headers = {'Cookie': session_cookies}
    async with websockets.connect(ws_uri, extra_headers=headers, klass=CustomWebSocketClientProtocol) as websocket:
        print("WebSocket connection established.")
        socket_list.append(websocket)

        try:
            while True:
                # Wait for a message from the control_players task
                data = await queue.get()

                # Convert the dictionary to a JSON string
                data_json = json.dumps(data)

                # Send the JSON string using the WebSocket connection
                await websocket.send(data_json)
                response = await websocket.recv()

        except asyncio.CancelledError:
            print("WebSocket connection closed.")

async def spawn_player(p, player_queues):
             
    link = 'http://game-load-balancer-365151679.us-east-1.elb.amazonaws.com/signup'
    #link = 'http://localhost:3000/signup'
    email = f'daniele_{p}@gmail.com'
    password = '123'
    username = f'daniele_{p}'
    payload = {'email': email, 'password': password, 'username': username}
    r = requests.post(link, data=payload)
    print(r.text)

    with requests.Session() as session:
        # Login and persist cookies in the session object
        link = 'http://game-load-balancer-365151679.us-east-1.elb.amazonaws.com/login'
        #link = 'http://localhost:3000/login'
        r = session.post(link, data=payload)
        print(r.text)

        # Extract connect.sid from the session cookies
        #session_cookie = session.cookies.get('your-session-key')
        #session_cookies = f'your-session-key={session_cookie}'
        session_cookies = session.cookies

        ws_uri = "ws://game-load-balancer-365151679.us-east-1.elb.amazonaws.com"
        #ws_uri = 'ws://localhost:3000'

    # Add the player_queue to the player_queues list
    player_queue = asyncio.Queue()
    player_queues.append(player_queue)

    # Create and return the player_task
    player_task = game_websocket(ws_uri, session_cookies, player_queue)
    websocket_tasks.append(player_task)

    print("CONNECTING PLAYER {0}".format(p))
    asyncio.create_task(player_task)  # Create the task without awaiting it


async def control_players(player_queues):
    dead_cycle = 0
    shot_cycle = 0
    while True:

        if (shot_cycle == 20):
            shot = {
                'mouseX': random.randint(0, 1300),
                'mouseY': random.randint(0, 800)
            }
            shot_cycle = 0
        else:
            shot = None

        # Create a message with random movement and shot
        data = {
            'type': 'game',
            'movement': {
                'w': random.choice([True, False]),
                'a': random.choice([True, False]),
                's': random.choice([True, False]),
                'd': random.choice([True, False])
            },
            'shot': shot
        }

        if (dead_cycle == 60):
            dead_cycle = 0
            data = {'type': 'respawn'}

        # Put the message in the player_queue
        for player_queue in player_queues:
            await player_queue.put(data)

        dead_cycle += 1
        shot_cycle += 1 

        # Control players at a desired rate
        await asyncio.sleep(1/60)


async def manage_players(num_players, player_queues):
    for p in range(num_players):
        await spawn_player(p, player_queues)
        await asyncio.sleep(1)
    
    print("ALL PLAYERS HAVE BEEN SPAWNED, PRESS ANY KEY TO END")
    input()

    for p in range(num_players):
        await socket_list[p].close()
        await asyncio.sleep(1)

    print("ALL PLAYERS HAVE BEEN DISCONNECTED")

num_players = 20
websocket_tasks = []
player_queues = []

# Create the event loop
loop = asyncio.get_event_loop()

# Start the spawn_players and control_players tasks
spawn_players_task = loop.create_task(manage_players(num_players, player_queues))
control_players_task = loop.create_task(control_players(player_queues))

try:
    loop.run_until_complete(asyncio.gather(spawn_players_task, control_players_task, *websocket_tasks))
except KeyboardInterrupt:
    # Stop the WebSocket connections when the script is interrupted
    print("Stopping WebSocket connections...")
    spawn_players_task.cancel()
    control_players_task.cancel()
    for websocket_task in websocket_tasks:
        websocket_task.cancel()
        loop.run_until_complete(websocket_task)
    loop.close()