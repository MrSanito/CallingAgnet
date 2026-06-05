import asyncio
import json
import os
from dotenv import load_dotenv
from livekit import api

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

LIVEKIT_URL = os.getenv("LIVEKIT_URL")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")

PHONE_NUMBER = "+916353778872"
TRANSFER_TO  = None              

async def main():
    room_name = f"outbound-{int(__import__('time').time())}"

    async with api.LiveKitAPI(
        url=LIVEKIT_URL,
        api_key=LIVEKIT_API_KEY,
        api_secret=LIVEKIT_API_SECRET,
    ) as lk:

        # 1. create room
        room = await lk.room.create_room(
            api.CreateRoomRequest(name=room_name)
        )
        print(f"✅ Room created: {room.name}")

        # 2. dispatch agent
        dispatch = await lk.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(
                room=room_name,
                agent_name="rentopus-agent",
                metadata=json.dumps({
                    "phone_number": PHONE_NUMBER,
                    "transfer_to": TRANSFER_TO,
                }),
            )
        )
        print(f"✅ Agent dispatched: {dispatch.id}")
        print(f"📞 Calling {PHONE_NUMBER} ...")

if __name__ == "__main__":
    asyncio.run(main())
