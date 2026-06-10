from multiprocessing import sharedctypes
import sys
import logging
from pathlib import Path
import asyncio
import traceback
import os
from pathlib import Path
from videosdk.agents import Agent, AgentSession, Pipeline, JobContext, RoomOptions, WorkerJob,Options,function_tool,EOUConfig, ExecutorType
from videosdk.agents.plugins import DeepgramSTT, GoogleLLM, CartesiaTTS, SileroVAD
from videosdk.agents.inference import Turn
 
from instructions import AGENT_FAREWELL, SYSTEM_PROMPT, AGENT_GREETING
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", handlers=[logging.StreamHandler()])
from dotenv import load_dotenv

load_dotenv(override=True)

LANGUAGES = {
    "hinglish": {
        "greeting":      AGENT_GREETING,
        "farewell":      AGENT_FAREWELL,
        "instructions":  SYSTEM_PROMPT,
    }
}


DEFAULT_LANGUAGE = "hinglish"

AGENT_ID        = os.getenv("AGENT_ID")
MAX_PROCESSES   = 3
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

class MyVoiceAgent(Agent):
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
            logger.info(f"instructions: {instructions}")

        super().__init__(
            instructions=instructions,
        )

        # self.set_thinking_audio(volume=0.9)

      
    async def on_enter(self) -> None:
        # Agent will wait for the user to speak first instead of saying the greeting
        try:
                logger.info(f"[on_enter] Saying greeting attempt")
                await self.session.say(AGENT_GREETING)
                logger.info("[on_enter] Greeting sent")
                                
                await self.play_background_audio(
                        volume=0.10,
                        looping=True,
                    )
        except Exception as e:
            logger.error(f"Error during on_enter: {e}")
            import traceback
            traceback.print_exc()

    async def on_exit(self) -> None:      
        try:
            await self.stop_background_audio()
        except Exception:
            pass

    
        try:
            conversation = get_all_transcripts(self.session.get_context_history())
            logger.info("=" * 25 + " CONVERSATION ON_EXIT " + "=" * 25)
            logger.info(conversation)
            logger.info("=" * 50)

            # Call the webhook API to submit the transcript
            webhook_url = "http://rentopusbackend.solobuildai.com/api/v1/webhooks/transcript"
            payload = {
                # Identifiers
                "serviceRoomId": self.room_id,
                "phone": self.phone,
                "clientNumber": self.phone,
                # Conversation
                "transcript": conversation,
                "contextHistory": self.session.get_context_history(),
               
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


    pipeline = Pipeline(
        stt=DeepgramSTT(language="hi"),
        llm=GoogleLLM(model="gemini-2.5-flash"),
        tts=CartesiaTTS(sample_rate=8000,model="sonic-3.5",language="hi", voice_id="4877b818-c7fe-4c89-b1cf-eadf8e23da72"),
        turn_detector=Turn.namo(language="hi", base_url="https://us002.inference-gateway.videosdk.live"),
        vad=SileroVAD(),
        eou_config=EOUConfig(
            mode="DEFAULT",
            min_max_speech_wait_timeout=[0.3, 0.5],
        ),
    )
    session = AgentSession(
        agent=agent,
        pipeline=pipeline
    )

    await session.start(wait_for_participant=True, run_until_shutdown=True)
    logger.info("[Session Start] Agent session started — waiting for shutdown signal")


def make_context() -> JobContext:
    room_options = RoomOptions(
        # room_id="<room_id>", # Replace it with your actual room_id
        name="Voice Agent",
        playground=True,
        # recording=True,
        # background_audio=True,
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
        logger.info(f"Starting Rentopus Sales Agent | id={AGENT_ID} |")
        logger.info(f"Default language : {DEFAULT_LANGUAGE.upper()}")
        logger.info(f"Reports directory: {REPORTS_DIR.resolve()}")

        options = Options(
            agent_id=AGENT_ID,
            register=True,
            executor_type=ExecutorType.THREAD
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