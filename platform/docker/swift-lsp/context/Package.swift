// swift-tools-version:5.10
import PackageDescription

// Minimal anchor package so sourcekit-lsp has a workspace context.
// `Sources/Scratch/Scratch.swift` is the file the LSP indexes for completion
// requests sent without a real on-disk file path; the web client opens
// virtual documents at that path.
let package = Package(
    name: "Scratch",
    targets: [
        .target(name: "Scratch", path: "Sources/Scratch")
    ]
)
