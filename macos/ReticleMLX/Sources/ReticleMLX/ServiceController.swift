import AppKit
import Foundation
import UniformTypeIdentifiers

enum ServiceState: Equatable {
  case checking
  case healthy
  case starting
  case unhealthy
  case stopped
  case notInstalled
  case failed

  var title: String {
    switch self {
    case .checking: "Checking…"
    case .healthy: "Model running"
    case .starting: "Starting"
    case .unhealthy: "Unhealthy"
    case .stopped: "Stopped"
    case .notInstalled: "Not installed"
    case .failed: "Action failed"
    }
  }

  var symbolName: String {
    switch self {
    case .healthy: "checkmark.circle.fill"
    case .checking, .starting: "circle.dotted"
    case .stopped, .notInstalled: "circle"
    case .unhealthy: "exclamationmark.triangle.fill"
    case .failed: "exclamationmark.circle"
    }
  }
}

struct ServiceStateResolver {
  static let defaultStartupGraceInterval: TimeInterval = 90

  private let startupGraceInterval: TimeInterval
  private var observedProcess: String?
  private var observedAt: Date?

  init(startupGraceInterval: TimeInterval = Self.defaultStartupGraceInterval) {
    self.startupGraceInterval = startupGraceInterval
  }

  mutating func resolve(
    result: CommandResult,
    serviceDefinitionExists: Bool,
    now: Date = Date()
  ) -> ServiceState {
    if result.succeeded {
      resetStartupObservation()
      return .healthy
    }

    let output = result.output
    if output.contains("launchd: loaded") {
      let launchdState = value(for: "state", in: output)
      if let launchdState, launchdState != "running" {
        resetStartupObservation()
        return .unhealthy
      }

      let process = value(for: "pid", in: output) ?? launchdState ?? "loaded"
      if observedProcess != process {
        observedProcess = process
        observedAt = now
      } else if observedAt == nil {
        observedAt = now
      }

      guard let observedAt else { return .starting }
      return now.timeIntervalSince(observedAt) < startupGraceInterval
        ? .starting : .unhealthy
    }

    resetStartupObservation()
    if output.contains("launchd: not loaded"), serviceDefinitionExists {
      return .stopped
    }
    return .notInstalled
  }

  mutating func resetStartupObservation() {
    observedProcess = nil
    observedAt = nil
  }

  private func value(for key: String, in output: String) -> String? {
    let prefix = "\(key) = "
    return output.split(whereSeparator: \.isNewline)
      .map { $0.trimmingCharacters(in: .whitespaces) }
      .first { $0.hasPrefix(prefix) }
      .map { String($0.dropFirst(prefix.count)) }
  }
}

@MainActor
final class ServiceController: ObservableObject {
  @Published private(set) var state: ServiceState = .checking
  @Published private(set) var isBusy = false
  @Published private(set) var output = "Reticle MLX is checking the local service."
  @Published private(set) var installedModel = ServiceConfiguration.defaults.model
  @Published private(set) var installedFormat = ServiceConfiguration.defaults.fimFormat
  @Published private(set) var installedRuntime = ServiceConfiguration.defaults.runtime
  @Published private(set) var endpoint = "http://127.0.0.1:8001/v1"
  @Published private(set) var logOutput = ""
  @Published private(set) var logDirectory = ""
  @Published private(set) var isLoadingLogs = false
  @Published private(set) var removingModelID: String?

  let downloads: ModelDownloadController
  private let mlxRunner: CommandRunner?
  private let mtplxRunner: CommandRunner?
  private let defaults: UserDefaults
  private var isRefreshing = false
  private var stateResolver = ServiceStateResolver()

  init(
    mlxRunner: CommandRunner? = CommandRunner.resolveExecutable().map(CommandRunner.init),
    mtplxRunner: CommandRunner? = CommandRunner.resolveMTPLXExecutable().map(CommandRunner.init),
    downloads: ModelDownloadController? = nil,
    defaults: UserDefaults = .standard
  ) {
    self.mlxRunner = mlxRunner
    self.mtplxRunner = mtplxRunner
    self.downloads = downloads ?? ModelDownloadController()
    self.defaults = defaults
  }

  func refresh() async {
    guard !isBusy, !isRefreshing else { return }
    isRefreshing = true
    defer { isRefreshing = false }
    let runtime = ServiceConfiguration.load(from: defaults).runtime
    let runner = runner(for: runtime)
    guard let runner else {
      state = .notInstalled
      output = "The \(runtime.displayName) helper is missing from the app bundle."
      return
    }

    let result = await runner.run("status")
    parseInstalledConfiguration(from: result.output)
    output = result.output.trimmingCharacters(in: .whitespacesAndNewlines)
    let serviceDefinitionExists = FileManager.default.fileExists(
      atPath: NSString(
        string:
          runtime == .mtplx
          ? "~/Library/LaunchAgents/io.github.roboalchemist.reticle.mtplx.plist"
          : "~/Library/LaunchAgents/io.github.roboalchemist.reticle-mlx.plist"
      ).expandingTildeInPath
    )
    state = stateResolver.resolve(
      result: result,
      serviceDefinitionExists: serviceDefinitionExists
    )
  }

  func install(_ configuration: ServiceConfiguration) async {
    configuration.save(to: defaults)
    if let otherRunner = runner(for: configuration.runtime == .mlxLM ? .mtplx : .mlxLM) {
      _ = await otherRunner.run("stop")
    }
    await perform(
      "install",
      runtime: configuration.runtime,
      environment: configuration.serviceEnvironment
    )
  }

  func download(_ preset: ModelPreset) {
    let runner = runner(for: preset.runtime)
    guard let runner else {
      state = .notInstalled
      output = "The \(preset.runtime.displayName) helper is missing from the app bundle."
      return
    }
    downloads.start(preset, executableURL: runner.executableURL)
  }

  func isConfigured(_ preset: ModelPreset) -> Bool {
    let configuration = ServiceConfiguration.load(from: defaults)
    return configuration.runtime == preset.runtime && configuration.model == preset.model
  }

  func remove(_ preset: ModelPreset) async {
    guard !isBusy, !downloads.isBusy else {
      output = "Wait for the current Reticle operation to finish before deleting a model."
      return
    }
    guard !isConfigured(preset) else {
      output = "Switch to another model before deleting \(preset.name)."
      return
    }
    guard let runner = runner(for: preset.runtime) else {
      output = "The \(preset.runtime.displayName) helper is missing from the app bundle."
      return
    }

    let environment: [String: String]
    switch preset.runtime {
    case .mlxLM:
      environment = ["RETICLE_MLX_MODEL": preset.model]
    case .mtplx:
      environment = ["MTPLX_MODEL": preset.model]
    }

    isBusy = true
    removingModelID = preset.id
    output = "Deleting \(preset.name)…"
    let result = await runner.run("remove", environment: environment)
    let commandOutput = result.output.trimmingCharacters(in: .whitespacesAndNewlines)
    output =
      commandOutput.isEmpty
      ? (result.succeeded
        ? "Deleted \(preset.name)." : "Could not delete \(preset.name).")
      : commandOutput
    if result.succeeded {
      downloads.markDownloaded(preset, downloaded: false)
    }
    removingModelID = nil
    isBusy = false
  }

  func refreshModelDownloads() async {
    for preset in ModelPreset.suggested {
      guard let runner = runner(for: preset.runtime) else {
        downloads.markDownloaded(preset, downloaded: false)
        continue
      }
      let environment: [String: String]
      switch preset.runtime {
      case .mlxLM:
        environment = [
          "RETICLE_MLX_MODEL": preset.model,
          "RETICLE_MLX_FIM_FORMAT": preset.fimFormat,
        ]
      case .mtplx:
        environment = ["MTPLX_MODEL": preset.model]
      }
      let result = await runner.run(
        "model-status",
        environment: environment
      )
      downloads.markDownloaded(preset, downloaded: result.succeeded)
    }
  }

  func start() async {
    await perform("start", runtime: ServiceConfiguration.load(from: defaults).runtime)
  }

  func stop() async {
    await perform("stop", runtime: ServiceConfiguration.load(from: defaults).runtime)
  }

  func restart() async {
    await perform("restart", runtime: ServiceConfiguration.load(from: defaults).runtime)
  }

  func doctor() async {
    await perform("doctor", runtime: ServiceConfiguration.load(from: defaults).runtime)
  }

  func installVSCodeExtension() async {
    await performAuxiliary(
      "vscode-install",
      progressMessage: "Installing the Reticle VS Code extension…"
    )
  }

  func vscodeDoctor(_ configuration: ServiceConfiguration) async {
    await performAuxiliary(
      "vscode-doctor",
      environment: configuration.vscodeEnvironment,
      progressMessage: "Checking the Reticle VS Code integration…"
    )
  }

  func copyVSCodeSettings(_ configuration: ServiceConfiguration) {
    NSPasteboard.general.clearContents()
    NSPasteboard.general.setString(configuration.vscodeSettings, forType: .string)
    output = "Copied Reticle’s VS Code settings to the clipboard."
  }

  func openLogs() {
    let runtime = ServiceConfiguration.load(from: defaults).runtime
    let path = runtime == .mtplx ? "~/.mtplx/logs" : "~/.reticle/mlx/logs"
    let logs = URL(
      fileURLWithPath: NSString(string: path).expandingTildeInPath,
      isDirectory: true
    )
    try? FileManager.default.createDirectory(at: logs, withIntermediateDirectories: true)
    NSWorkspace.shared.open(logs)
  }

  func refreshLogs() async {
    guard !isLoadingLogs else { return }
    isLoadingLogs = true
    let runtime = ServiceConfiguration.load(from: defaults).runtime
    let serviceOutput = output
    let snapshot = await Task.detached(priority: .userInitiated) {
      ServiceLogReader.read(runtime: runtime)
    }.value
    logDirectory = snapshot.directory.path
    logOutput =
      """
      Reticle MLX diagnostics
      Runtime: \(runtime.displayName)
      Directory: \(snapshot.directory.path)

      ===== latest service status =====
      \(serviceOutput.isEmpty ? "(no service status output)" : serviceOutput)

      \(snapshot.text)
      """
    isLoadingLogs = false
  }

  func copyLogs() {
    guard !logOutput.isEmpty else { return }
    NSPasteboard.general.clearContents()
    NSPasteboard.general.setString(logOutput, forType: .string)
    output = "Copied Reticle MLX logs to the clipboard."
  }

  func exportLogs() {
    guard !logOutput.isEmpty else { return }
    let runtime = ServiceConfiguration.load(from: defaults).runtime
    let panel = NSSavePanel()
    panel.allowedContentTypes = [.plainText]
    panel.canCreateDirectories = true
    panel.nameFieldStringValue = "reticle-mlx-\(runtime.rawValue)-logs.txt"
    guard panel.runModal() == .OK, let url = panel.url else { return }
    do {
      try logOutput.write(to: url, atomically: true, encoding: .utf8)
      output = "Exported Reticle MLX logs to \(url.path)."
    } catch {
      output = "Could not export logs: \(error.localizedDescription)"
    }
  }

  private func perform(
    _ command: String,
    runtime: ModelRuntime,
    environment: [String: String] = [:]
  ) async {
    let runner = runner(for: runtime)
    guard let runner else {
      state = .notInstalled
      output = "The \(runtime.displayName) helper is missing from the app bundle."
      return
    }

    isBusy = true
    if command == "install" || command == "start" || command == "restart" {
      stateResolver.resetStartupObservation()
      state = .starting
    }
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

  private func performAuxiliary(
    _ command: String,
    environment: [String: String] = [:],
    progressMessage: String
  ) async {
    let runner = mlxRunner
    guard let runner else {
      output = "The reticle-mlx helper is missing from the app bundle."
      return
    }

    isBusy = true
    output = progressMessage
    let result = await runner.run(command, environment: environment)
    output = result.output.trimmingCharacters(in: .whitespacesAndNewlines)
    isBusy = false
  }

  private func parseInstalledConfiguration(from output: String) {
    for line in output.split(separator: "\n") {
      if line.hasPrefix("model: ") {
        installedModel = String(line.dropFirst("model: ".count))
      } else if line.hasPrefix("FIM format: ") {
        installedFormat = String(line.dropFirst("FIM format: ".count))
      } else if line.hasPrefix("endpoint: ") {
        endpoint = String(line.dropFirst("endpoint: ".count)) + "/v1"
      } else if line.hasPrefix("runtime: "),
        let runtime = ModelRuntime(rawValue: String(line.dropFirst("runtime: ".count)))
      {
        installedRuntime = runtime
      }
    }
  }

  private func runner(for runtime: ModelRuntime) -> CommandRunner? {
    switch runtime {
    case .mlxLM: mlxRunner
    case .mtplx: mtplxRunner
    }
  }
}
