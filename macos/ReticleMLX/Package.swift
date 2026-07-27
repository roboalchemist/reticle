// swift-tools-version: 5.10

import PackageDescription

let package = Package(
    name: "ReticleMLX",
    platforms: [
        .macOS(.v13),
    ],
    products: [
        .executable(name: "ReticleMLX", targets: ["ReticleMLX"]),
    ],
    targets: [
        .executableTarget(
            name: "ReticleMLX",
            path: "Sources/ReticleMLX"
        ),
        .testTarget(
            name: "ReticleMLXTests",
            dependencies: ["ReticleMLX"],
            path: "Tests/ReticleMLXTests"
        ),
    ],
    swiftLanguageVersions: [.v5]
)
