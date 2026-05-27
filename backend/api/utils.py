import json
from typing import Any

def ndjson(event: dict[str, Any]) -> str:
    return json.dumps(event, ensure_ascii=False, default=str) + "\n"


def paragraph_chunks(token_iter):
    """
    Convert token streams into stable markdown chunks.
    Paragraphs, markdown tables, and lists are emitted after a blank line so
    the frontend does not render half-built blocks row-by-row.
    """
    buffer = ""

    for token in token_iter:
        if not token:
            continue
        buffer += str(token)

        while "\n\n" in buffer:
            chunk, buffer = buffer.split("\n\n", 1)
            chunk = chunk.strip()
            if chunk:
                yield chunk + "\n\n"

    tail = buffer.strip()
    if tail:
        yield tail
