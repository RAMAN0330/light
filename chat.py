from openai import OpenAI
from pathlib import Path


def load_api_key(path=Path(__file__).with_name(".env")):
  for line in path.read_text().splitlines():
    key, _, value = line.partition("=")
    if key == "OPENREUTER_KEY":
      return value.strip().strip('"').strip("'")


client = OpenAI(
  base_url="https://openrouter.ai/api/v1",
  api_key=load_api_key(),
)


def consume_stream(stream):
  content = ""
  reasoning_details = []
  for chunk in stream:
    delta = chunk.choices[0].delta
    if delta.content:
      print(delta.content, end="", flush=True)
      content += delta.content
    if details := getattr(delta, "reasoning_details", None):
      reasoning_details.extend(details)
  return content, reasoning_details


def main():
  # First API call with reasoning
  response = client.chat.completions.create(
    model="nvidia/nemotron-3.5-lightning:free",
    messages=[
            {
              "role": "user",
              "content": "How many r's are in the word 'strawberry'?"
            }
          ],
    extra_body={"reasoning": {"enabled": True}},
    stream=True,
  )

  content, reasoning_details = consume_stream(response)

  # Preserve the assistant message with reasoning_details
  messages = [
    {"role": "user", "content": "How many r's are in the word 'strawberry'?"},
    {
      "role": "assistant",
      "content": content,
      "reasoning_details": reasoning_details,
    },
    {"role": "user", "content": "Are you sure? Think carefully."}
  ]

  # Second API call - model continues reasoning from where it left off
  response2 = client.chat.completions.create(
    model="nvidia/nemotron-3.5-lightning:free",
    messages=messages,
    extra_body={"reasoning": {"enabled": True}},
    stream=True,
  )
  consume_stream(response2)


if __name__ == "__main__":
  main()
