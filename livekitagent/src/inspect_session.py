from livekit.agents.voice.agent_session import AgentSession

print("AgentSession methods:")
for m in dir(AgentSession):
    if not m.startswith("_"):
        print(m)
