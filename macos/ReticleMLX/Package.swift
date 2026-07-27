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
    dependencies: [
        .package(url: "https://github.com/sparkle-project/Sparkle.git", from: "2.9.1"),
    ],
    targets: [
        .executableTarget(
            name: "ReticleMLX",
            dependencies: [
                .product(name: "Sparkle", package: "Sparkle"),
            ],
            path: "Sources/ReticleMLX",
            linkerSettings: [
                .unsafeFlags([
                    "-Xlinker", "-rpath",
                    "-Xlinker", "@executable_path/../Frameworks",
                ]),
            ]
        ),
        .testTarget(
            name: "ReticleMLXTests",
            dependencies: ["ReticleMLX"],
            path: "Tests/ReticleMLXTests"
        ),
    ],
    swiftLanguageVersions: [.v5]
)
