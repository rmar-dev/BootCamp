# Swift sourcekit-lsp + WebSocket bridge for Monaco's monaco-languageclient.
#
# This image runs a small Node WebSocket server that, on each connection,
# spawns a sourcekit-lsp child process and pipes JSON-RPC frames between the
# socket and stdin/stdout.
#
# Limitations to document:
#   - Linux toolchain has Foundation, but NOT SwiftUI / UIKit / AVKit (iOS SDKs).
#     Files importing those resolve as "module not found" and lose semantic info.
#     The static Monaco provider in `web/lib/monaco/swift-language.ts` covers
#     SwiftUI / AVKit completion regardless.
#   - One subprocess per connection. If you expect >50 concurrent learners,
#     wire a session pool / cap.

FROM swift:5.10

# --- Node for the bridge server ---------------------------------------------
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
 && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

# --- Working "context" Swift package ----------------------------------------
# sourcekit-lsp wants a Package.swift to anchor the workspace. We seed a
# minimal package that re-exports Foundation so per-file completions resolve
# `import Foundation` without errors.
WORKDIR /workspace
COPY context/Package.swift /workspace/Package.swift
COPY context/Sources/Scratch/Scratch.swift /workspace/Sources/Scratch/Scratch.swift
RUN swift build || true

# --- Bridge server -----------------------------------------------------------
WORKDIR /app
COPY package.json /app/package.json
RUN npm install --omit=dev
COPY bridge.js /app/bridge.js

EXPOSE 4500
ENV WORKSPACE=/workspace
ENV PORT=4500

CMD ["node", "bridge.js"]
