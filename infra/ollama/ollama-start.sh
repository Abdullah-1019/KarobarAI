#!/bin/sh
set -eu
rm -f /tmp/models-ready

# Use loopback for CLI calls; the server itself listens on the internal network.
ollama serve &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
trap 'exit 0' INT TERM

attempt=0
until OLLAMA_HOST=127.0.0.1:11434 ollama list >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ] || ! kill -0 "$server_pid" 2>/dev/null; then
    echo "Ollama server did not become ready" >&2
    exit 1
  fi
  sleep 1
done

# Pull is idempotent: model blobs survive container recreation in ollama_data.
OLLAMA_HOST=127.0.0.1:11434 ollama pull "$OLLAMA_CHAT_MODEL"
OLLAMA_HOST=127.0.0.1:11434 ollama pull "$OLLAMA_EMBED_MODEL"
touch /tmp/models-ready
wait "$server_pid"
