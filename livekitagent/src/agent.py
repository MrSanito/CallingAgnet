from __future__ import annotations

import asyncio
import logging
from dotenv import load_dotenv
import json
import os
from typing import Any

from livekit import rtc, api
from livekit.agents import (
    AgentSession,
    Agent,
    JobContext,
    function_tool,
    RunContext,
    get_job_context,
    cli,
    WorkerOptions,
    RoomInputOptions,
    llm,
)
from livekit.plugins import (google, noise_cancellation,  # noqa: F401
)
from livekit.plugins import google
from livekit.plugins import noise_cancellation


# load environment variables, this is optional, only used for local development
load_dotenv(dotenv_path=".env.local")
logger = logging.getLogger("outbound-caller")
logger.setLevel(logging.INFO)

outbound_trunk_id = os.getenv("SIP_OUTBOUND_TRUNK_ID")

class OutboundCaller(Agent):
    def __init__(
        self,
        *,
        name: str,
        appointment_time: str,
        dial_info: dict[str, Any],
    ):
        super().__init__(
            instructions=f"""
            You are a scheduling assistant for a dental practice. Your interface with user will be voice.
            You will be on a call with a patient who has an upcoming appointment. Your goal is to confirm the appointment details.
            As a customer service representative, you will be polite and professional at all times. Allow user to end the conversation.

            When the user would like to be transferred to a human agent, first confirm with them. upon confirmation, use the transfer_call tool.
            The customer's name is {name}. His appointment is on {appointment_time}.
            """
        )
        # keep reference to the participant for transfers
        self.participant: rtc.RemoteParticipant | None = None

        self.dial_info = dial_info

    def set_participant(self, participant: rtc.RemoteParticipant):
        self.participant = participant

    async def hangup(self):
        """Helper function to hang up the call by deleting the room"""

        job_ctx = get_job_context()
        await job_ctx.api.room.delete_room(
            api.DeleteRoomRequest(
                room=job_ctx.room.name,
            )
        )

    @function_tool()
    async def transfer_call(self, ctx: RunContext):
        """Transfer the call to a human agent, called after confirming with the user"""

        transfer_to = self.dial_info["transfer_to"]
        if not transfer_to:
            return "cannot transfer call"

        logger.info(f"transferring call to {transfer_to}")

        # let the message play fully before transferring
      
        job_ctx = get_job_context()
        try:
            await job_ctx.api.sip.transfer_sip_participant(
                api.TransferSIPParticipantRequest(
                    room_name=job_ctx.room.name,
                    participant_identity=self.participant.identity,
                    transfer_to=f"tel:{transfer_to}",
                )
            )

            logger.info(f"transferred call to {transfer_to}")
        except Exception as e:
            logger.error(f"error transferring call: {e}")
          
            await self.hangup()

    @function_tool()
    async def end_call(self, ctx: RunContext):
        """Called when the user wants to end the call"""
        logger.info(f"ending the call for {self.participant.identity}")

        # let the agent finish speaking
        current_speech = ctx.session.current_speech
        if current_speech:
            await current_speech.wait_for_playout()

        await self.hangup()

    @function_tool()
    async def look_up_availability(
        self,
        ctx: RunContext,
        date: str,
    ):
        """Called when the user asks about alternative appointment availability

        Args:
            date: The date of the appointment to check availability for
        """
        logger.info(
            f"looking up availability for {self.participant.identity} on {date}"
        )
        await asyncio.sleep(3)
        return {
            "available_times": ["1pm", "2pm", "3pm"],
        }

    @function_tool()
    async def confirm_appointment(
        self,
        ctx: RunContext,
        date: str,
        time: str,
    ):
        """Called when the user confirms their appointment on a specific date.
        Use this tool only when they are certain about the date and time.

        Args:
            date: The date of the appointment
            time: The time of the appointment
        """
        logger.info(
            f"confirming appointment for {self.participant.identity} on {date} at {time}"
        )
        return "reservation confirmed"

    @function_tool()
    async def detected_answering_machine(self, ctx: RunContext):
        """Called when the call reaches voicemail. Use this tool AFTER you hear the voicemail greeting"""
        logger.info(f"detected answering machine for {self.participant.identity}")
        await self.hangup()


async def entrypoint(ctx: JobContext):
    logger.info(f"connecting to room {ctx.room.name}")
    await ctx.connect()

    raw_metadata = ctx.job.metadata
    is_real_call = bool(raw_metadata)

    if is_real_call:
        dial_info = json.loads(raw_metadata)
        phone_number = dial_info["phone_number"]
        participant_identity = phone_number
    else:
        dial_info = {"phone_number": "test-user", "transfer_to": None}

    agent = OutboundCaller(
        name="Jayden",
        appointment_time="next Tuesday at 3pm",
        dial_info=dial_info,
    )

    initial_ctx = llm.ChatContext().append(
        role="system",
        text=agent.instructions
    ).append(
        role="user",
        text="Hi! The call has connected. Please start by saying your greeting immediately."
    )

    session = AgentSession(
        llm=google.beta.realtime.RealtimeModel(
            model="gemini-2.5-flash-native-audio-preview-12-2025",
            voice="Puck",
            temperature=0.8,
        ),
        chat_ctx=initial_ctx,
    )

    await session.start(
        agent=agent,
        room=ctx.room,
        room_input_options=RoomInputOptions(
            noise_cancellation=noise_cancellation.BVCTelephony(),
        ),
    )

    if is_real_call:
        # real phone call — dial via SIP
        try:
            await ctx.api.sip.create_sip_participant(
                api.CreateSIPParticipantRequest(
                    room_name=ctx.room.name,
                    sip_trunk_id=outbound_trunk_id,
                    sip_call_to=phone_number,
                    participant_identity=participant_identity,
                    wait_until_answered=True,
                )
            )
            participant = await ctx.wait_for_participant(identity=participant_identity)
        except api.TwirpError as e:
            logger.error(
                f"error creating SIP participant: {e.message}, "
                f"SIP status: {e.metadata.get('sip_status_code')} "
                f"{e.metadata.get('sip_status')}"
            )
            ctx.shutdown()
            return
    else:
        # playground / local test — wait for browser participant
        participant = await ctx.wait_for_participant()

    logger.info(f"participant joined: {participant.identity}")
    agent.set_participant(participant)

    # We use chat_ctx instead of session.say() to trigger the opening greeting for Gemini Realtime


    # Gemini Live speaks automatically from instructions, so no manual trigger is needed


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name="rentopus-agent",
        )
    )
