import asyncio
import requests
import websockets
import json
import time
import random

from websockets import WebSocketClientProtocol
class CustomWebSocketClientProtocol(WebSocketClientProtocol):
    async def ping(self, data: bytes = None) -> None:
        print("Received a ping frame.")
        # Call the original ping method to handle the ping frame properly
        await super().ping(data)

async def game_websocket(ws_uri, session_cookies):
    headers = {'Cookie': session_cookies}
    async with websockets.connect(ws_uri, extra_headers=headers, klass=CustomWebSocketClientProtocol) as websocket:
        print("WebSocket connection established.")
        try:
            
            # Keep the WebSocket connection running until interrupted
            cycle = 0
            dead_cycle = 0
            while True:

                if (cycle == 4):
                    shot = { 'mouseX': random.randint(0, 1300), 'mouseY': random.randint(0, 800) }
                    cycle = 0
                else:
                    shot = None
                
                
                
                movement = { 'w': random.choice([True, False]), 'a': random.choice([True, False]), 's': random.choice([True, False]), 'd': random.choice([True, False]) }
                data = { 'type': 'game', 'movement': movement, 'shot': shot }
                if (dead_cycle == 300):
                    dead_cycle = 0
                    data = {'type': 'respawn'}

                # Convert the dictionary to a JSON string
                data_json = json.dumps(data)

                # Send the JSON string using the WebSocket connection
                await websocket.send(data_json)
                response = await websocket.recv()
            
                cycle += 1
                dead_cycle += 1
                time.sleep(1/60)

        except asyncio.CancelledError:
            print("WebSocket connection closed.")



async def add_players(num_players):
    for p in range(num_players):
        #link = 'http://game-load-balancer-365151679.us-east-1.elb.amazonaws.com/signup'
        link = 'http://localhost:3000/signup'
        email = f'test_player_{p}@gmail.com'
        password = '123'
        username = f'test_player_{p}'
        payload = {'email': email, 'password': password, 'username': username}
        r = requests.post(link, data=payload)
        print(r.text)

        with requests.Session() as session:
            # Login and persist cookies in the session object
            #link = 'http://game-load-balancer-365151679.us-east-1.elb.amazonaws.com/login'
            link = 'http://localhost:3000/login'
            r = session.post(link, data=payload)
            print(r.text)

            # Extract connect.sid from the session cookies
            session_cookie = session.cookies.get('your-session-key')
            session_cookies = f'your-session-key={session_cookie}'

            #ws_uri = "ws://game-load-balancer-365151679.us-east-1.elb.amazonaws.com"
            ws_uri = 'ws://localhost:3000'

            # Add the WebSocket task to the list
            websocket_tasks.append(game_websocket(ws_uri, session_cookies))

        # Wait for 60 seconds before adding the next player
        await asyncio.sleep(60)

num_players = 15
websocket_tasks = []

# Start all WebSocket tasks concurrently using asyncio.gather
loop = asyncio.get_event_loop()

# Start the add_players task
add_players_task = loop.create_task(add_players(num_players))

try:
    loop.run_until_complete(asyncio.gather(add_players_task, *websocket_tasks))
except KeyboardInterrupt:
    # Stop the WebSocket connections when the script is interrupted
    print("Stopping WebSocket connections...")
    add_players_task.cancel()
    for websocket_task in websocket_tasks:
        websocket_task.cancel()
        loop.run_until_complete(websocket_task)
    loop.close()