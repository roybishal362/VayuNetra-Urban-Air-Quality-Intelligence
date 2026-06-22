"""Check the LLM gateway. With a GROQ_API_KEY set it makes a real call; else shows fallback."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.agents.llm import llm


def main() -> None:
    print(f"provider={llm.provider!r}  enabled={llm.enabled}  model={llm.model_name if llm.enabled else '-'}")
    if not llm.enabled:
        print("No key set -> deterministic templates active (advisories in en+hi, briefs templated).")
        return
    out = llm.generate("You are VayuNetra's assistant.",
                       "In one short sentence, confirm you are online and name the model family you are.")
    print("text  ->", out)
    j = llm.generate_json("You output strict JSON.",
                          'Return a JSON object: {"status":"ok","languages":["en","hi","kn","ta"]}')
    print("json  ->", j)


if __name__ == "__main__":
    main()
