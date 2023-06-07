import asyncio
import requests
import websockets
import json
import time

async def game_websocket(ws_uri, session_cookies):
    headers = {'Cookie': session_cookies}
    async with websockets.connect(ws_uri, extra_headers=headers) as websocket:
        print("WebSocket connection established.")
        try:
            
            # Keep the WebSocket connection running until interrupted
            cycle = 0
            dead_cycle = 0
            while True:

                if (cycle == 6):
                    shot = { 'mouseX': 0, 'mouseY': 0 }
                    cycle = 0
                else:
                    shot = None
                
                
                movement = { 'w': True, 'a': False, 's': False, 'd': False }
                data = { 'type': 'game', 'movement': movement, shot: shot }

                if (dead_cycle == 300):
                    dead_cycle = 0
                    data = {}

                # Convert the dictionary to a JSON string
                data_json = json.dumps(data)

                # Send the JSON string using the WebSocket connection
                await websocket.send(data_json)
                response = await websocket.recv()
            
                cycle += 1
                time.sleep(1/60)

        except asyncio.CancelledError:
            print("WebSocket connection closed.")

num_players = 1

for p in range(num_players):
    link = 'http://game-load-balancer-365151679.us-east-1.elb.amazonaws.com/signup'
    email = f'test_player_{p}@gmail.com'
    password = '123'
    username = f'test_player_{p}'
    payload = {'email': email, 'password': password, 'username': username}
    r = requests.post(link, data=payload)
    print(r.text)

    with requests.Session() as session:
        # Login and persist cookies in the session object
        link = 'http://game-load-balancer-365151679.us-east-1.elb.amazonaws.com/login'
        r = session.post(link, data=payload)
        print(r.text)

        # Extract connect.sid from the session cookies
        session_cookie = session.cookies.get('connect.sid')
        session_cookies = f'connect.sid={session_cookie}'

        # Replace this with the WebSocket URI used by your client.js
        ws_uri = "ws://game-load-balancer-365151679.us-east-1.elb.amazonaws.com"

        # Start WebSocket communication
        loop = asyncio.get_event_loop()
        websocket_task = loop.create_task(game_websocket(ws_uri, session_cookies))

        try:
            loop.run_until_complete(websocket_task)
        except KeyboardInterrupt:
            # Stop the WebSocket connection when the script is interrupted
            print("Stopping WebSocket connection...")
            websocket_task.cancel()
            loop.run_until_complete(websocket_task)
            loop.close()