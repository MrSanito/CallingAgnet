import asyncio
import traceback
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from videosdk.agents import Agent, AgentSession, Pipeline, JobContext, RoomOptions, WorkerJob, Options
from videosdk.plugins.google import GeminiRealtime, GeminiLiveConfig
from google.genai.types import (
    RealtimeInputConfig,
    AutomaticActivityDetection,
    StartSensitivity,
    EndSensitivity,
)
from dotenv import load_dotenv

load_dotenv()

AGENT_ID = os.getenv("AGENT_ID")
GEMINI_MODEL = "gemini-3.1-flash-live-preview"
GEMINI_VOICE = "Puck"
REPORTS_DIR = Path("feedback_reports")
REPORTS_DIR.mkdir(exist_ok=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", handlers=[logging.StreamHandler()])
logger = logging.getLogger(__name__)

class MyVoiceAgent(Agent):
    def __init__(self, customer_name: str = "", phone: str = "", room_id: str = "unknown"):
        self.customer_name = customer_name
        self.phone = phone
        self.room_id = room_id

        instructions = "You are a helpful call router for Rentopus. Say hello and immediately wait while the call is transferred."
        
        super().__init__(
            instructions=instructions,
        )
        self.set_thinking_audio(volume=0.9)

    async def on_enter(self) -> None:
        try:
            await asyncio.wait_for(
                self.play_background_audio(override_thinking=True, looping=True),
                timeout=5.0
            )
        except Exception as e:
            logger.warning(f"[on_enter] Background audio failed: {e}")

        # Wait for SIP audio stream to stabilize after ICE completes
        await asyncio.sleep(1.5)

        # Single hardcoded greeting
        greeting_name = self.customer_name if self.customer_name else "Sir/Madam"
        greeting = f"Namaste {greeting_name}! Main Rentopus se bol rahi hoon. Ek second hold kijiye, main aapko hamare executive se connect kar rahi hoon."

        # Say greeting
        for attempt in range(3):
            try:
                logger.info(f"[on_enter] Saying greeting attempt {attempt + 1}")
                await self.session.say(greeting)
                logger.info("[on_enter] Greeting sent ✓")
                break
            except Exception as e:
                logger.error(f"[on_enter] Greeting attempt {attempt + 1} failed: {e}")
                if attempt < 2:
                    await asyncio.sleep(1.0)
                    
        # IMMEDIATELY TRANSFER THE CALL
        # TODO: Change this to your exact transfer number
        transfer_to = "+917600763090"  
        
        try:
            logger.info(f"[on_enter] Executing warm transfer to {transfer_to}")
            await self.session.call_transfer(transfer_to)
            logger.info("[on_enter] Transfer initiated.")
        except Exception as e:
            logger.error(f"[on_enter] Transfer failed: {e}")

    async def on_exit(self) -> None:
        logger.info("====================== on_exit ========================")
        try:
            await self.stop_background_audio()
        except Exception:
            pass

async def start_session(context: JobContext):
    meta = getattr(context, "metadata", {}) or {}
    customer_name = meta.get("customerName", "")
    phone = meta.get("phone", "")
    
    room_id = "unknown"
    if hasattr(context, "room") and context.room:
        room_id = context.room.name
    elif hasattr(context, "room_id"):
        room_id = context.room_id
    elif "roomId" in meta:
        room_id = meta["roomId"]

    agent = MyVoiceAgent(
        customer_name=customer_name,
        phone=phone,
        room_id=room_id
    )
    
    model = GeminiRealtime(
        model=GEMINI_MODEL,
        api_key=os.getenv("GOOGLE_API_KEY"),
        config=GeminiLiveConfig(
            voice=GEMINI_VOICE,
            response_modalities=["AUDIO"],
            temperature=0.7,
            realtime_input_config=RealtimeInputConfig(
                automatic_activity_detection=AutomaticActivityDetection(
                    start_of_speech_sensitivity=StartSensitivity.START_SENSITIVITY_HIGH,
                    end_of_speech_sensitivity=EndSensitivity.END_SENSITIVITY_HIGH,
                    prefix_padding_ms=10,
                    silence_duration_ms=400,
                )
            )
        )
    )

    pipeline = Pipeline(llm=model)
    session = AgentSession(
        agent=agent,
        pipeline=pipeline
    )

    await session.start(wait_for_participant=True, run_until_shutdown=True)
    logger.info("[Session Start] Agent session started — waiting for shutdown signal")

def make_context() -> JobContext:
    room_options = RoomOptions(
        name="Gemini Realtime Agent",
        playground=True,
        recording=True,
        background_audio=True,
    )
    return JobContext(room_options=room_options)

def validate_env() -> None:
    errors = []
    if not os.getenv("GOOGLE_API_KEY"):
        errors.append("GOOGLE_API_KEY is missing.")
    if errors:
        for err in errors:
            logger.critical(err)
        sys.exit(1)
    logger.info("Environment variables validated ✓")

if __name__ == "__main__":
    try:
        validate_env()
        options = Options(
            agent_id=AGENT_ID,
            register=True,
            initialize_timeout=60.0,
        )
        job = WorkerJob(
            entrypoint=start_session,
            jobctx=make_context,
            options=options,
        )
        job.start()
    except KeyboardInterrupt:
        logger.info("Interrupted — shutting down...")
    except Exception:
        logger.critical("Fatal startup error:")
        traceback.print_exc()
        sys.exit(1)