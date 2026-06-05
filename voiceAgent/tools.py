"""
Rentopus AI Sales Voice Assistant — AgentTools
VideoSDK Real-Time Voice Agent

Architecture: Step-based KB fetch model.
All tools are @function_tool async methods on AgentTools class.
KB is loaded once at module level — never reloaded per call.
"""

import asyncio
import json
import logging
import os
import time
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

from videosdk.agents import function_tool

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
#  KB LOADER — once at module startup
# ─────────────────────────────────────────────

_default_kb = str(Path(__file__).parent / "knowledge_base.json")
_KB = json.loads(Path(os.getenv("KB_PATH", _default_kb)).read_text(encoding="utf-8"))
_KB.pop("_meta", None)  # strip meta block


# ─────────────────────────────────────────────
#  CORE SEARCH — keyword match, phase filter
# ─────────────────────────────────────────────

def _search(query: str, phase: str = None, top_k: int = 2) -> str:
    """
    Search KB by keyword score.
    Optional phase filter narrows to relevant section only — lean context window.
    Returns top_k results as a compact string.
    """
    q = query.lower()
    results = []

    for topic, data in _KB.items():
        # Phase filter — only fetch what this step needs
        if phase and data.get("phase") not in (phase, "meta"):
            continue
        score = sum(1 for kw in data["keywords"] if kw in q)
        if score > 0:
            results.append((score, data["content"]))

    results.sort(reverse=True)
    top = results[:top_k]

    if not top:
        return (
            "Specific context not found for this query. "
            "Use general knowledge about rental business pain points. "
            "Do not hallucinate features or pricing."
        )

    return "\n---\n".join(c for _, c in top)


# ─────────────────────────────────────────────
#  AGENT TOOLS CLASS
# ─────────────────────────────────────────────

class AgentTools:

    # ══════════════════════════════════════════
    #  ORIGINAL TOOLS — unchanged
    # ══════════════════════════════════════════

    @function_tool
    async def end_call(self, message: str) -> dict:
        """Call ko tab end/disconnect karein jab customer phone rakhne ko bole, conversation khatam ho jaye, ya goodbye bole.
            message: Call end karne se pehle jo aakhri message bolna hai. Yeh bilkul natural aur situation ke hisaab se personalized hona chahiye. Generic message mat use karein. In scenarios ke hisaab se message dein:
            - Normal call close (sare sawal khatam, trial setup done) -> "Aapka bahut samay le liya — shukriya itni achhi baat karne ke liye. Take care, bye-bye!"
            - Galat number / wrong person -> "Oh, I am so sorry about that! Main apne records update kar deta hoon taaki aapko dobara pareshani na ho. Goodbye."
            - Customer abhi busy hai aur baad mein call karne ko bola -> "Bilkul samajh sakta hoon — kya main baad mein call kar sakta hoon aapko?"
            - Software mein interest nahi hai / relevant nahi hai -> "Koi baat nahi — aapka samay dene ke liye shukriya. Agar kabhi zaroorat pade toh hum hamesha available hain. Shukriya, bye-bye!"
        """
        logger.info(f"[AgentTools] end_call triggered. Message to say: '{message}'")
        asyncio.create_task(self._announce_and_hangup(message=message))
        return {"status": "ending_call"}


    @function_tool
    async def transfer_to_human(self, reason: str) -> str:
        """Transfer this call directly to a human agent.
        
        Args:
            reason: Why the transfer is needed.
        """
        logger.info(f"[AgentTools] transfer_to_human (Cold Transfer) triggered. Reason: '{reason}'")
        logger.info(f"self object innvocationo view : {self}")
        token = os.getenv("VIDEOSDK_AUTH_TOKEN", "")
        transfer_to = "+916351906090"
        
        try:
            result = await self.session.call_transfer(transfer_to)
            # User specifically requested logging the exact response:
            if hasattr(result, '__dict__'):
                logger.info(f"[AgentTools] call_transfer execution result: {vars(result)} {result}")
            else:
                logger.info(f"[AgentTools] call_transfer execution result: {result} {result}")
                
            return "Transferring you now. I will disconnect from my end."
        except Exception as e:
            logger.error(f"[AgentTools] call_transfer threw an exception: {e}", exc_info=True)
            return "I'm sorry, transfer failed. I'll arrange a callback for you."

    async def _announce_and_hangup(self, message: str = "") -> None:
        if not self.session:
            logger.warning("[AgentTools] _announce_and_hangup called but self.session is None.")
            return
        logger.info("[AgentTools] Interrupting current session and preparing to hang up.")
        self.session.interrupt()
        await asyncio.sleep(0.5)
        handle = await self.session.say(message, interruptible=False)
        await handle
        await asyncio.sleep(0.5)
        logger.info("[AgentTools] Executing hangup...")
        await self.hangup()
        logger.info("[AgentTools] Hangup executed successfully.")

    # ══════════════════════════════════════════
    #  STEP 1 — INTRO FRAMEWORK
    # ══════════════════════════════════════════

    @function_tool
    async def get_intro_framework(self) -> dict:
        """Call this FIRST when the conversation starts.
        Returns how to introduce as Yash from Rentopus, what to say in the first 20 seconds,
        and how to build trust before any pitch.
        Call once per conversation at the very beginning.
        """
        logger.info("[AgentTools] get_intro_framework triggered.")
        data = _search("start opening greet introduce first begin", phase="intro", top_k=1)
        return {
            "data": data,
            "step": "intro",
            "instruction": "Use this framework for your first 20 seconds. Do NOT pitch yet.",
        }

    # ══════════════════════════════════════════
    #  STEP 2 — DISCOVERY QUESTIONS
    # ══════════════════════════════════════════

    # @function_tool
    async def get_discovery_questions(self, context_so_far: str = "") -> dict:

        """Call this at the START of the discovery phase to get the question bank and discovery flow.
        Use it to decide which single question to ask next based on what the customer has already shared.
        Never ask all questions — pick the single most relevant unanswered one.

        context_so_far: Brief summary of what customer has already shared
        (business type, current tools, pain mentioned).
        Example: 'Clothing rental, uses WhatsApp, mentioned booking confusion'.
        Leave empty if nothing is known yet.
        """
        logger.info(f"[AgentTools] get_discovery_questions triggered. Context: '{context_so_far}'")
        
        start_time = time.perf_counter()
        data = _search("discovery questions ask understand flow sequence", phase="discovery", top_k=2)
        end_time = time.perf_counter()
        
        logger.info(f"[AgentTools] _search took {end_time - start_time:.4f} seconds to execute in get_discovery_questions.")
        
        return {
            "data": data,
            "step": "discovery",
            "context_received": context_so_far or "none",
            "instruction": "Pick ONE question from the bank that hasn't been answered yet. Never stack questions.",
        }

    # ══════════════════════════════════════════
    #  STEP 3 — PAIN → SOLUTION MAPPING
    # ══════════════════════════════════════════

    @function_tool
    async def search_pain_solution(self, pain_described: str) -> dict:
        """Call this when the customer describes a problem, challenge, or operational pain point.
        Returns the relevant pain → solution → outcome mapping to connect their pain to
        the right Rentopus feature naturally.
        Do NOT list features — connect pain to outcome only, in 2-3 spoken lines.

        pain_described: What the customer described as their problem.
        Example: 'double booking happens', 'inventory confusion',
        'manually sending WhatsApp reminders', 'payment tracking is hard'.
        """
        logger.info(f"[AgentTools] search_pain_solution triggered. Pain: '{pain_described}'")
        data = _search(pain_described, phase="pain_solution", top_k=2)
        return {
            "data": data,
            "step": "pain_solution",
            "pain_input": pain_described,
            "instruction": "Pain first. Feature second. Outcome third. 2-3 spoken lines only. Ask a follow-up after.",
        }

    # ══════════════════════════════════════════
    #  STEP 4 — PRODUCT INFO
    # ══════════════════════════════════════════

    @function_tool
    async def search_product_info(self, query: str) -> dict:
        """Call this when the customer asks about: what Rentopus does, pricing, platform/devices,
        security, setup time, which businesses use it, or any specific product question.
        Returns accurate product facts only — never answer product questions from memory.

        query: What the customer asked about.
        Example: 'kitna charge hai', 'mobile pe kaam karta hai',
        'data safe hai', 'kaun kaun use karta hai', 'setup kitne din mein'.
        """
        logger.info(f"[AgentTools] search_product_info triggered. Query: '{query}'")
        data = _search(query, phase="product", top_k=2)
        return {
            "data": data,
            "step": "product_info",
            "query_received": query,
            "instruction": (
                "Answer directly and confidently. 2-3 lines. "
                "Then reconnect to discovery: 'Just curious — how are you managing X currently?'"
            ),
        }

    # ══════════════════════════════════════════
    #  STEP 4B — GENERAL KB SEARCH
    # ══════════════════════════════════════════

    @function_tool
    async def search_knowledge_base(self, query: str) -> dict:
        """Call this when the customer asks a question not clearly covered by search_product_info,
        search_pain_solution, or any other step-specific tool.
        Searches across ALL phases of the knowledge base — product, FAQ, company background,
        industries served, billing customization, multi-user setup, export, and meta rules.
        Use as a general fallback before answering from memory.

        Triggers include:
        - FAQ questions: 'kya data export kar sakte hain', 'regional language billing supported hai',
          'kitne staff ek saath login kar sakte hain', 'low internet pe kaam karta hai'.
        - Company background: 'company kab se hai', 'kaun banaya', 'Surat mein hai', 'WhiteCore kya hai'.
        - Industry fit questions: 'kya furniture rental ke liye bhi kaam karta hai', 'event rental support hota hai'.
        - Anything else the customer asks that requires a factual KB answer.

        query: The customer's question in their own words.
        Example: 'kya data download kar sakte hain', 'kitne saal se chal raha hai Rentopus',
        'ek se zyada log use kar sakte hain', 'bill Hindi mein bana sakte hain'.
        """
        logger.info(f"[AgentTools] search_knowledge_base triggered. Query: '{query}'")
        data = _search(query, phase=None, top_k=2)
        return {
            "data": data,
            "step": "kb_search",
            "query_received": query,
            "instruction": (
                "Answer from KB data only — never from memory. "
                "Keep response concise and confident. 2-3 lines. "
                "Reconnect to the conversation naturally after answering."
            ),
        }

    # ══════════════════════════════════════════
    #  STEP 5 — OBJECTION HANDLING
    # ══════════════════════════════════════════

    @function_tool
    async def handle_objection(self, objection: str) -> dict:
        """Call this when the customer raises any objection or resistance.
        Examples: 'already have software', 'too expensive / mehenga hai',
        'send on WhatsApp / details bhejo', 'need to think / sochna hai',
        'not interested', 'busy hoon'.
        Returns the objection framework: Understand → Clarify → Reframe → Respond → Guide.

        objection: Exactly what the customer said or the type of resistance shown.
        """
        logger.info(f"[AgentTools] handle_objection triggered. Objection: '{objection}'")
        data = _search(objection, phase="objections", top_k=1)
        return {
            "data": data,
            "step": "objection",
            "objection_received": objection,
            "instruction": (
                "Follow: Understand → Clarify → Reframe → Respond → Guide. "
                "Never argue. Max 2 pushes then back off gracefully."
            ),
        }

    # ══════════════════════════════════════════
    #  STEP 6 — CLOSING ACTION
    # ══════════════════════════════════════════

    @function_tool
    async def get_closing_action(
        self,
        intent_level: str,
        pain_identified: bool = False,
        conversation_duration: str = "under_1min",
    ) -> dict:
        """Call this when enough context exists to guide the customer toward a next step.
        Returns the right closing action based on lead quality and intent.
        Priority order: P1=Demo, P2=Trial, P3=Human Handoff, P4=Callback.

        intent_level: Assessed intent — 'low' (curious/casual), 'medium' (interested), 'high' (ready to act).
        pain_identified: True if a clear operational pain has been identified during discovery.
        conversation_duration: Approximate duration — 'under_1min', '1_to_2min', 'over_2_5min'.
        """
        logger.info(
            f"[AgentTools] get_closing_action triggered. "
            f"Intent: {intent_level}, Pain: {pain_identified}, Duration: {conversation_duration}"
        )
        data = _search("outcome goal priority next step success closing", phase="closing", top_k=3)

        # Recommend closing action based on signals
        if conversation_duration == "over_2_5min" and intent_level == "high":
            recommended = "human_handoff"
        elif intent_level == "high" and pain_identified:
            recommended = "trial"
        else:
            recommended = "demo"

        return {
            "data": data,
            "step": "closing",
            "intent": intent_level,
            "pain_found": pain_identified,
            "duration": conversation_duration,
            "recommended_action": recommended,
            "instruction": (
                "Guide toward recommended_action. Confident, warm, zero pressure. "
                "Customer must always know what happens next."
            ),
        }

    # ══════════════════════════════════════════
    #  ACTION — SEND WHATSAPP DEMO
    # ══════════════════════════════════════════

    @function_tool
    async def send_whatsapp_demo(self, phone_number: str, customer_name: str = "") -> dict:
        """Send the Rentopus product demo video to the customer on WhatsApp.
        Call when: customer asks for details, says 'send on WhatsApp / details bhejo',
        or demo is the right closing action.
        IMPORTANT: Always continue light discovery after sending — never end the call immediately after.

        phone_number: Customer WhatsApp number. Confirm with customer first if not already known.
        customer_name: Customer name if known (optional).
        """
        logger.info(
            f"[AgentTools] send_whatsapp_demo triggered. "
            f"Phone input: '{phone_number}', Name input: '{customer_name}'"
        )

        # 1. Resolve customer name and phone number
        name = customer_name or getattr(self, "customer_name", "") or "Customer"
        raw_phone = phone_number or getattr(self, "phone", "")
        
        # 2. Normalize phone to 10-digit number
        clean_phone = "".join(c for c in raw_phone if c.isdigit())
        if len(clean_phone) > 10 and (clean_phone.startswith("91") or clean_phone.startswith("0")):
            clean_phone = clean_phone[-10:]
            
        logger.info(f"[AgentTools] Normalizing phone for WhatsApp -> Name: '{name}', Phone: '{clean_phone}'")

        # 3. Load token from environment or use default fallback
        token = os.getenv("OMINIFLOW_WHATSAPP_TOKEN", "8uBG4cGIKBaAVfZsbQSEUkORq1iEq385o5tAhTqV4a623127")

        # 4. Construct payload
        payload = {
            "token": token,
            "phone": clean_phone,
            "template_name": "call_summary_followup_customer",
            "template_language": "en_US",
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {
                            "type": "text",
                            "text": name
                        },
                        {
                            "type": "text",
                            "text": "*Please share your brand details for trial setup.*"
                        }
                    ]
                }
            ]
        }

        # 5. Call API asynchronously via urllib inside thread pool
        import urllib.request
        import urllib.error

        url = "https://whatsapp.ominiflow.com/api/wpbox/sendtemplatemessage"

        def do_request():
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            try:
                with urllib.request.urlopen(req, timeout=15) as response:
                    res_data = response.read().decode("utf-8")
                    logger.info(f"[AgentTools] Ominiflow API response: {res_data}")
                    return json.loads(res_data)
            except urllib.error.HTTPError as he:
                err_content = he.read().decode("utf-8")
                logger.error(f"[AgentTools] Ominiflow HTTPError {he.code}: {err_content}")
                return {"error": f"HTTPError {he.code}", "details": err_content}
            except Exception as ex:
                logger.error(f"[AgentTools] Ominiflow Request failed: {ex}")
                return {"error": str(ex)}

        api_result = await asyncio.to_thread(do_request)

        return {
            "status": "demo_sent",
            "phone_number": clean_phone,
            "customer_name": name,
            "api_result": api_result,
            "next_action": (
                "Continue light discovery — ask: "
                "'By the way, how are you currently managing bookings?'"
            ),
        }

    # ══════════════════════════════════════════
    #  ACTION — SCHEDULE CALLBACK
    # ══════════════════════════════════════════

    @function_tool
    async def schedule_callback(
        self,
        preferred_time: str,
        customer_name: str = "",
        notes: str = "",
    ) -> dict:
        """Schedule a specific callback time when the customer is busy or timing is bad.
        Always get a SPECIFIC time — never accept a vague 'later'.
        Ask: 'What works better — later today or tomorrow?' before calling this.
        After confirming the time with the customer → call end_call.

        preferred_time: Specific slot confirmed by customer. Example: 'Today 5PM', 'Tomorrow 10AM', 'Kal subah 11 baje'.
        customer_name: Customer name if known (optional).
        notes: Brief context about the conversation to pass to the callback agent (optional).
        """
        logger.info(
            f"[AgentTools] schedule_callback triggered. "
            f"Time: '{preferred_time}', Name: '{customer_name}'"
        )
        return {
            "status": "callback_scheduled",
            "preferred_time": preferred_time,
            "customer_name": customer_name,
            "notes": notes,
            "next_action": "Confirm time with customer then call end_call.",
        }