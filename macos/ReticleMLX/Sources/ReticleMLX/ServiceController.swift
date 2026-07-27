import AppKit
import Foundation

enum ServiceState: Equatable {
  case checking
  case healthy
  case starting
  case stopped
  case notInstalled
  case failed

  var title: String {
    switch self {
    case .checking: "Checking…"
    case .healthy: "Healthy"
    case .starting: "Starting or unhealthy"
    case .stopped: "Stopped"
    case .notInstalled: "Not installed"
    case .failed: "Action failed"
    }
  }

  var symbolName: String {
    switch self {
    case .healthy: "scope"
    case .checking, .starting: "circle.dotted"
    case .stopped, .notInstalled: "circle"
    case .failed: "exclamationmark.circle"
    }
  }
}

@MainActor
final class ServiceController: ObservableObject {
  @Published private(set) var state: ServiceState = .checking
  @Published private(set) var isBusy = false
  @Published private(set) var output = "Reticle MLX is checking the local service."
  @Published private(set) var installedModel = ServiceConfiguration.defaults.model
  @Published private(set) var installedFormat = ServiceConfiguration.defaults.fimFormat
  @Published private(set) var endpoint = "http://127.0.0.1:8001/v1"

  private let runner: CommandRunner?

  init(runner: CommandRunner? = CommandRunner.resolveExecutable().map(CommandRunner.init)) {
    self.runner = runner
  }

  func refresh() async {
    guard !isBusy else { return }
    guard let runner else {
      state = .notInstalled
      output = "The reticle-mlx helper is missing from the app bundle."
      return
    }

    state = .checking
    let result = await runner.run("status")
    parseInstalledConfiguration(from: result.output)
    output = result.output.trimmingCharacters(in: .whitespacesAndNewlines)

    if result.succeeded {
      state = .healthy
    } else if result.output.contains("launchd: loaded") {
      state = .starting
    } else if result.output.contains("launchd: not loaded"),
      FileManager.default.fileExists(
        atPath: NSString(string: "~/Library/LaunchAgents/io.github.roboalchemist.reticle-mlx.plist")
          .expandingTildeInPath
      )
    {
      state = .stopped
    } else {
      state = .notInstalled
    }
  }

  func install(_ configuration: ServiceConfiguration) async {
    configuration.save()
    await perform("install", environment: configuration.environment)
  }

  func start() async {
    await perform("start")
  }

  func stop() async {
    await perform("stop")
  }

  func restart() async {
    await perform("restart")
  }

  func doctor() async {
    await perform("doctor")
  }

  func copyVSCodeSettings(_ configuration: ServiceConfiguration) {
    NSPasteboard.general.clearContents()
    NSPasteboard.general.setString(configuration.vscodeSettings, forType: .string)
    output = "Copied Reticle’s VS Code settings to the clipboard."
  }

  func openLogs() {
    let logs = URL(
      fileURLWithPath: NSString(string: "~/.reticle/mlx/logs").expandingTildeInPath,
      isDirectory: true
    )
    try? FileManager.default.createDirectory(at: logs, withIntermediateDirectories: true)
    NSWorkspace.shared.open(logs)
  }

  private func perform(_ command: String, environment: [String: String] = [:]) async {
    guard let runner else {
      state = .notInstalled
      output = "The reticle-mlx helper is missing from the app bundle."
      return
    }

    isBusy = true
    output = "\(command.capitalized) in progress…"
    let result = await runner.run(command, environment: environment)
    output = result.output.trimmingCharacters(in: .whitespacesAndNewlines)
    isBusy = false

    if result.succeeded {
      await refresh()
    } else {
      state = .failed
    }
  }

  private func parseInstalledConfiguration(from output: String) {
    for line in output.split(separator: "\n") {
      if line.hasPrefix("model: ") {
        installedModel = String(line.dropFirst("model: ".count))
      } else if line.hasPrefix("FIM format: ") {
        installedFormat = String(line.dropFirst("FIM format: ".count))
      } else if line.hasPrefix("endpoint: ") {
        endpoint = String(line.dropFirst("endpoint: ".count)) + "/v1"
      }
    }
  }
}
