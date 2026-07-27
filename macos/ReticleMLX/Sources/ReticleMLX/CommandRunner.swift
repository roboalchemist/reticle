import Foundation

struct CommandResult {
  let exitCode: Int32
  let output: String

  var succeeded: Bool {
    exitCode == 0
  }
}

struct CommandRunner {
  let executableURL: URL

  static func resolveExecutable(
    environment: [String: String] = ProcessInfo.processInfo.environment,
    bundle: Bundle = .main
  ) -> URL? {
    if let override = environment["RETICLE_MLX_CLI"], !override.isEmpty {
      return URL(fileURLWithPath: override)
    }
    if let bundled = bundle.url(forResource: "reticle-mlx", withExtension: nil) {
      return bundled
    }
    let candidates = [
      "/opt/homebrew/bin/reticle-mlx",
      "/usr/local/bin/reticle-mlx",
      FileManager.default.currentDirectoryPath + "/scripts/reticle-mlx",
      FileManager.default.currentDirectoryPath + "/../../scripts/reticle-mlx",
    ]
    return
      candidates
      .map(URL.init(fileURLWithPath:))
      .first { FileManager.default.isExecutableFile(atPath: $0.path) }
  }

  static func resolveMTPLXExecutable(
    environment: [String: String] = ProcessInfo.processInfo.environment,
    bundle: Bundle = .main
  ) -> URL? {
    if let override = environment["RETICLE_MTPLX_CLI"], !override.isEmpty {
      return URL(fileURLWithPath: override)
    }
    if let bundled = bundle.url(forResource: "reticle-mtplx", withExtension: nil) {
      return bundled
    }
    let candidates = [
      "/opt/homebrew/bin/reticle-mtplx",
      "/usr/local/bin/reticle-mtplx",
      FileManager.default.currentDirectoryPath + "/scripts/mtplx-service",
      FileManager.default.currentDirectoryPath + "/../../scripts/mtplx-service",
    ]
    return
      candidates
      .map(URL.init(fileURLWithPath:))
      .first { FileManager.default.isExecutableFile(atPath: $0.path) }
  }

  func run(_ command: String, environment overrides: [String: String] = [:]) async -> CommandResult
  {
    await Task.detached(priority: .userInitiated) {
      let temporaryURL = FileManager.default.temporaryDirectory
        .appendingPathComponent("reticle-mlx-\(UUID().uuidString).log")
      FileManager.default.createFile(atPath: temporaryURL.path, contents: nil)

      do {
        let outputHandle = try FileHandle(forWritingTo: temporaryURL)
        let process = Process()
        process.executableURL = executableURL
        process.arguments = [command]
        process.standardOutput = outputHandle
        process.standardError = outputHandle
        process.environment = ProcessInfo.processInfo.environment.merging(overrides) { _, new in new
        }
        try process.run()
        process.waitUntilExit()
        try outputHandle.close()
        let data = (try? Data(contentsOf: temporaryURL)) ?? Data()
        try? FileManager.default.removeItem(at: temporaryURL)
        return CommandResult(
          exitCode: process.terminationStatus,
          output: String(decoding: data, as: UTF8.self)
        )
      } catch {
        try? FileManager.default.removeItem(at: temporaryURL)
        return CommandResult(exitCode: 127, output: "Unable to run reticle-mlx: \(error)\n")
      }
    }.value
  }
}
