from videosdk.agents import Agent, AgentSession, Pipeline, JobContext, RoomOptions, WorkerJob,function_tool
from videosdk.plugins.google import GeminiRealtime, GeminiLiveConfig
import logging
from instructions import AGENT_FAREWELL, SYSTEM_PROMPT, AGENT_GREETING
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", handlers=[logging.StreamHandler()])
from pathlib import Path
import logging

import asyncio
import traceback
import logging
import os
import sys
import csv
import uuid
from datetime import datetime
from pathlib import Path
from videosdk.agents import Agent, AgentSession, Pipeline, JobContext, RoomOptions, WorkerJob, Options, MCPServerHTTP
from videosdk.plugins.google import GeminiRealtime, GeminiLiveConfig
from videosdk.plugins.google.live_api import ThinkingConfig
from dotenv import load_dotenv
from tools import AgentTools
from google.genai.types import (
    RealtimeInputConfig,
    AutomaticActivityDetection,
    StartSensitivity,
    EndSensitivity,
)

load_dotenv()


LANGUAGES = {
    "hinglish": {
        "greeting":      AGENT_GREETING,
        "farewell":      AGENT_FAREWELL,
        "instructions":  SYSTEM_PROMPT,
    }
}


DEFAULT_LANGUAGE = "hinglish"

AGENT_ID        = os.getenv("AGENT_ID")
GEMINI_MODEL = "gemini-3.1-flash-live-preview"
GEMINI_VOICE    = "Puck"          # casual, youthful — fits Hinglish/delivery context
MAX_PROCESSES   = 10
REPORTS_DIR     = Path("feedback_reports")
REPORTS_DIR.mkdir(exist_ok=True)

logger = logging.getLogger(__name__)



def get_all_transcripts(history) -> str:
    conversation = ""

    for msg in history:
        role = msg.get("role", "").lower()
        content = msg.get("content", "")

        if isinstance(content, list):
            text_blocks = [
                c if isinstance(c, str) else "[Image/Other]"
                for c in content
            ]
            content = " ".join(text_blocks)

        if role == "user":
            conversation += f"User: {content}\n"
        elif role in ("assistant", "agent"):
            conversation += f"Agent: {content}\n"

    return conversation

class MyVoiceAgent(Agent, AgentTools):
    def __init__(self, language: str = DEFAULT_LANGUAGE, customer_name: str = "", phone: str = "", room_id: str = "unknown"):
        lang = LANGUAGES.get(language, LANGUAGES[DEFAULT_LANGUAGE])
        self.language = language
        self.lang_cfg = lang
        self.customer_name = customer_name
        self.phone = phone
        self.room_id = room_id

        instructions = lang["instructions"]
        if customer_name or phone:
            info_block = "\n\n## Customer Details for this Call:\n"
            if customer_name:
                info_block += f"- Name: {customer_name}\n"
            if phone:
                info_block += f"- Phone: {phone}\n"
            instructions += info_block

        super().__init__(
            instructions=instructions,
        )

        self.set_thinking_audio(volume=0.9)

        # Accumulate token usage across all turns
        self._total_usage = {
            "total_tokens": 0,
            "input_tokens": 0,
            "output_tokens": 0,
            "input_audio_tokens": 0,
            "output_audio_tokens": 0,
            "input_text_tokens": 0,
            "output_text_tokens": 0,
            "thoughts_tokens": 0,
        }
        self._per_turn_usages = []   # raw per-turn usage list
        self._event_emitter = None
        try:
            from videosdk.agents.event_bus import global_event_emitter
            self._event_emitter = global_event_emitter
            global_event_emitter.on("realtime_usage", self._on_usage)
        except Exception as e:
            logger.warning(f"[Usage] Could not subscribe to realtime_usage event: {e}")

    def _on_usage(self, usage: dict):
        """Accumulate per-turn token usage into session total."""
        self._per_turn_usages.append(dict(usage))   # store raw per-turn snapshot
        for key in self._total_usage:
            self._total_usage[key] += usage.get(key, 0)
        logger.info(
            f"[TURN USAGE] in={usage.get('input_tokens')} "
            f"(audio={usage.get('input_audio_tokens')}) | "
            f"out={usage.get('output_tokens')} "
            f"(audio={usage.get('output_audio_tokens')}) | "
            f"total={usage.get('total_tokens')}"
        )

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

        # Retry greeting up to 3 times in case session isn't ready
        for attempt in range(3):
            try:
                greeting = self.lang_cfg["greeting"]

                logger.info(f"[on_enter] Saying greeting attempt {attempt + 1}")
                await self.session.say(greeting)
                logger.info("[on_enter] Greeting sent ✓")
                break
            except Exception as e:
                logger.error(f"[on_enter] Greeting attempt {attempt + 1} failed: {e}")
                if attempt < 2:
                    await asyncio.sleep(1.0)

        # if self.customer_name:
        #     greeting = f"Namaste {self.customer_name} ji! Main Rentopus ki तरफ से बोल रहा हूँ — क्या आपके पास एक दो मिनट हैं?"
        # else:
    
    async def on_exit(self) -> None:
        # ✅ MUST be first — remove this agent's listener to prevent ghost 
        logger.info("====================== on_exit ========================")
        try:
            if self._event_emitter:
                if hasattr(self._event_emitter, 'off'):
                    self._event_emitter.off("realtime_usage", self._on_usage)
                elif hasattr(self._event_emitter, 'remove_listener'):
                    self._event_emitter.remove_listener("realtime_usage", self._on_usage)
                logger.info("[on_exit] Unsubscribed realtime_usage listener")
        except Exception as e:
            logger.warning(f"[on_exit] Could not remove usage listener: {e}")        # Stop background audio (non-fatal if it fails)
        try:
            await self.stop_background_audio()
        except Exception:
            pass

        # Say farewell (non-fatal if it fails)
        try:
            await self.session.say(self.lang_cfg["farewell"])
        except Exception:
            pass

        try:
            conversation = get_all_transcripts(self.session.get_context_history())
            logger.info("=" * 25 + " CONVERSATION ON_EXIT " + "=" * 25)
            logger.info(conversation)
            logger.info("=" * 50)

            # Call the webhook API to submit the transcript
            webhook_url = "http://rentopusbackend.solobuildai.com/api/v1/webhooks/transcript"
            logger.info(f"[SESSION USAGE] {self._total_usage}")
            logger.info(f"[SESSION TURNS] {len(self._per_turn_usages)} turns tracked")
            payload = {
                # Identifiers
                "serviceRoomId": self.room_id,
                "phone": self.phone,
                "clientNumber": self.phone,
                # Conversation
                "transcript": conversation,
                "contextHistory": self.session.get_context_history(),
                # Token Usage
                "usage": {
                    "totals": self._total_usage,
                    "perTurn": self._per_turn_usages,
                    "turnCount": len(self._per_turn_usages),
                },
                # Call Metadata
                "agentLanguage": self.language,
                "customerName": self.customer_name,
            }
            logger.info(f"Sending transcript to webhook: {webhook_url} for room: {self.room_id} and phone: {self.phone}")
            
            import json
            import urllib.request
            
            def send_webhook():
                req = urllib.request.Request(
                    webhook_url,
                    data=json.dumps(payload).encode('utf-8'),
                    headers={'Content-Type': 'application/json'},
                    method='POST'
                )
                try:
                    with urllib.request.urlopen(req, timeout=30) as response:
                        res_data = response.read().decode('utf-8')
                        logger.info(f"Webhook response: {res_data}")
                except Exception as ex:
                    logger.error(f"Failed to trigger webhook: {ex}")
            
            # Run in a thread pool to avoid blocking the asyncio event loop
            await asyncio.to_thread(send_webhook)

        except Exception as e:
            logger.error(f"Error during on_exit: {e}")
            import traceback
            traceback.print_exc()
    
 
async def start_session(context: JobContext):
    meta = getattr(context, "metadata", {}) or {}
    logger.info(f"[Session Start] Raw metadata from JobContext: {meta}")

    language = meta.get("language", DEFAULT_LANGUAGE)
    customer_name = meta.get("customerName", "")
    phone = meta.get("phone", "")
    logger.info(f"[Session Start] Extracted details -> Name: '{customer_name}', Phone: '{phone}', Language: '{language}'")

    # Extract room name from JobContext
    room_id = "unknown"
    if hasattr(context, "room") and context.room:
        room_id = context.room.name
    elif hasattr(context, "room_id"):
        room_id = context.room_id
    elif "roomId" in meta:
        room_id = meta["roomId"]

    agent = MyVoiceAgent(
        language=language,
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
            # realtime_input_config=RealtimeInputConfig(
            #     automatic_activity_detection=AutomaticActivityDetection(
            #         start_of_speech_sensitivity=StartSensitivity.START_SENSITIVITY_HIGH,
            #         end_of_speech_sensitivity=EndSensitivity.END_SENSITIVITY_HIGH,
            #         prefix_padding_ms=10,
            #         silence_duration_ms=400,
            #     )
            # )
        )
    )

    pipeline = Pipeline(llm=model)
    session = AgentSession(
        agent=agent,
        pipeline=pipeline
    )

    await session.start(wait_for_participant=True, run_until_shutdown=True)
    logger.info("[Session Start] Agent session started — waiting for shutdown signal")

    # ── Manual lifecycle: connect → wait with timeout → start ──
    # PARTICIPANT_TIMEOUT = 45  # seconds to wait for recipient to pick up

    # # Connect the agent to the room first
    # await context.connect()
    # logger.info(f"[Session Start] Connected to room: {room_id}")

    # # Wait for the recipient to join (with timeout)
    # try:
    #     participant_id = await asyncio.wait_for(
    #         context.wait_for_participant(),
    #         timeout=PARTICIPANT_TIMEOUT
    #     )
    #     logger.info(f"[Session Start] Participant joined: {participant_id}")
    # except asyncio.TimeoutError:
    #     logger.warning(f"[Session Start] ⏰ No participant joined within {PARTICIPANT_TIMEOUT}s — marking as no_answer")

    #     # Notify backend that call was not answered
    #     import json
    #     import urllib.request
    #     webhook_url = "https://8d17-2409-40c1-400a-e745-d41c-1e1f-ec5b-871d.ngrok-free.app/api/v1/webhooks/transcript"
    #     no_answer_payload = {
    #         "serviceRoomId": room_id,
    #         "phone": phone,
    #         "clientNumber": phone,
    #         "noAnswer": True,
    #         "reason": f"no_participant_within_{PARTICIPANT_TIMEOUT}s",
    #         "customerName": customer_name,
    #         "agentLanguage": language,
    #     }
    #     try:
    #         req = urllib.request.Request(
    #             webhook_url,
    #             data=json.dumps(no_answer_payload).encode('utf-8'),
    #             headers={'Content-Type': 'application/json'},
    #             method='POST'
    #         )
    #         with urllib.request.urlopen(req, timeout=30) as response:
    #             logger.info(f"[No Answer] Webhook response: {response.read().decode('utf-8')}")
    #     except Exception as ex:
    #         logger.error(f"[No Answer] Failed to send no_answer webhook: {ex}")

    #     # Shutdown the context cleanly
    #     try:
    #         await context.shutdown()
    #     except Exception:
    #         pass
    #     return

    # # Participant joined — start the agent session normally
    # await session.start()
    # logger.info("[Session Start] Agent session started — waiting for shutdown signal")

    # # Keep running until session ends
    # shutdown_event = asyncio.Event()

    # def on_session_end(reason: str):
    #     logger.info(f"[Session] Session ended: {reason}")
    #     shutdown_event.set()

    # if context.room:
    #     context.room.setup_session_end_callback(on_session_end)

    # MAX_SESSION_DURATION = 600  # 10 minute safety cap
    # try:
    #     await asyncio.wait_for(shutdown_event.wait(), timeout=MAX_SESSION_DURATION)
    # except asyncio.TimeoutError:
    #     logger.warning(f"[Session] ⏰ Session exceeded {MAX_SESSION_DURATION}s safety cap — forcing shutdown")
    # except KeyboardInterrupt:
    #     pass
    # finally:
    #     try:
    #         await session.close()
    #     except Exception as e:
    #         logger.error(f"[Session] Error closing session: {e}")
    #     try:
    #         await context.shutdown()
    #     except Exception as e:
    #         logger.error(f"[Session] Error in ctx.shutdown: {e}")

def make_context() -> JobContext:
    room_options = RoomOptions(
        # room_id="<room_id>", # Replace it with your actual room_id
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

    has_token = bool(os.getenv("VIDEOSDK_AUTH_TOKEN"))
    has_keys  = bool(os.getenv("VIDEOSDK_API_KEY") and os.getenv("VIDEOSDK_SECRET_KEY"))
    if not (has_token or has_keys):
        errors.append(
            "Either VIDEOSDK_AUTH_TOKEN or both VIDEOSDK_API_KEY + VIDEOSDK_SECRET_KEY must be set."
        )

    if errors:
        for err in errors:
            logger.critical(err)
        sys.exit(1)

    logger.info("Environment variables validated ✓")


if __name__ == "__main__":
    try:
        validate_env()

        logger.info(f"Starting Rentopus Sales Agent | id={AGENT_ID} | model={GEMINI_MODEL}")
        logger.info(f"Default language : {DEFAULT_LANGUAGE.upper()}")
        logger.info(f"Reports directory: {REPORTS_DIR.resolve()}")

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