import Darwin
import Foundation

enum ModelDownloadPhase: Equatable {
  case preparing
  case downloading
  case paused
  case cancelling
  case completed
  case cancelled
  case failed
}

struct ModelDownloadProgress: Equatable {
  let modelID: String
  let modelName: String
  var phase: ModelDownloadPhase
  var downloadedBytes: Int64
  var totalBytes: Int64
  var currentFile: String
  var bytesPerSecond: Double
  var error: String?

  var fractionCompleted: Double {
    guard totalBytes > 0 else { return 0 }
    return min(1, max(0, Double(downloadedBytes) / Double(totalBytes)))
  }

  var canPause: Bool {
    phase == .downloading
  }

  var canResume: Bool {
    phase == .paused
  }

  var canCancel: Bool {
    switch phase {
    case .preparing, .downloading, .paused:
      true
    case .cancelling, .completed, .cancelled, .failed:
      false
    }
  }

  var etaSeconds: TimeInterval? {
    guard bytesPerSecond > 0, totalBytes > downloadedBytes else { return nil }
    return Double(totalBytes - downloadedBytes) / bytesPerSecond
  }
}

struct ModelDownloadEvent: Decodable, Equatable {
  let downloadedBytes: Int64
  let totalBytes: Int64
  let file: String
  let stage: String
}

private struct MTPLXDownloadEvent: Decodable {
  let event: String
  let sizeBytes: Int64?
  let totalBytes: Int64?
  let file: String?
  let message: String?

  enum CodingKeys: String, CodingKey {
    case event
    case sizeBytes = "size_bytes"
    case totalBytes = "total_bytes"
    case file
    case message
  }
}

enum ModelDownloadOutputParser {
  static let progressPrefix = "RETICLE_DOWNLOAD_PROGRESS\t"
  static let workerPrefix = "RETICLE_DOWNLOAD_WORKER\t"

  static func progress(from line: String) -> ModelDownloadEvent? {
    guard line.hasPrefix(progressPrefix) else { return nil }
    let json = String(line.dropFirst(progressPrefix.count))
    return try? JSONDecoder().decode(ModelDownloadEvent.self, from: Data(json.utf8))
  }

  static func workerPID(from line: String) -> pid_t? {
    guard line.hasPrefix(workerPrefix) else { return nil }
    return pid_t(line.dropFirst(workerPrefix.count).trimmingCharacters(in: .whitespaces))
  }

  static func mtplxProgress(from line: String, fallbackTotal: Int64) -> ModelDownloadEvent? {
    guard line.first == "{",
      let data = line.data(using: .utf8),
      let event = try? JSONDecoder().decode(MTPLXDownloadEvent.self, from: data)
    else { return nil }

    let supported = ["resolving", "start", "resume", "progress", "verifying", "complete"]
    guard supported.contains(event.event) else { return nil }
    let stage: String
    switch event.event {
    case "complete": stage = "complete"
    case "resolving", "verifying": stage = "metadata"
    default: stage = "downloading"
    }
    return ModelDownloadEvent(
      downloadedBytes: event.sizeBytes ?? 0,
      totalBytes: event.totalBytes ?? fallbackTotal,
      file: event.file ?? event.message ?? event.event.capitalized,
      stage: stage
    )
  }
}

@MainActor
final class ModelDownloadController: ObservableObject {
  @Published private(set) var active: ModelDownloadProgress?
  @Published private(set) var downloadedModelIDs = Set<String>()
  @Published private(set) var output = ""

  private var process: Process?
  private var outputPipe: Pipe?
  private var workerPID: pid_t?
  private var lineBuffer = ""
  private var cancellationRequested = false
  private var lastSampleDate: Date?
  private var lastSampleBytes: Int64 = 0

  var isBusy: Bool {
    guard let active else { return false }
    switch active.phase {
    case .preparing, .downloading, .paused, .cancelling:
      return true
    case .completed, .cancelled, .failed:
      return false
    }
  }

  func isDownloaded(_ preset: ModelPreset) -> Bool {
    downloadedModelIDs.contains(preset.id)
  }

  func markDownloaded(_ preset: ModelPreset, downloaded: Bool) {
    if downloaded {
      downloadedModelIDs.insert(preset.id)
    } else {
      downloadedModelIDs.remove(preset.id)
    }
  }

  func start(_ preset: ModelPreset, executableURL: URL) {
    guard !isBusy else { return }

    cancellationRequested = false
    workerPID = nil
    lineBuffer = ""
    output = ""
    lastSampleDate = nil
    lastSampleBytes = 0
    active = ModelDownloadProgress(
      modelID: preset.id,
      modelName: preset.name,
      phase: .preparing,
      downloadedBytes: 0,
      totalBytes: preset.downloadSizeBytes,
      currentFile: "Preparing the \(preset.runtime.displayName) runtime",
      bytesPerSecond: 0,
      error: nil
    )

    let pipe = Pipe()
    let task = Process()
    task.executableURL = executableURL
    task.arguments = ["download"]
    task.standardOutput = pipe
    task.standardError = pipe
    let downloadEnvironment: [String: String]
    switch preset.runtime {
    case .mlxLM:
      downloadEnvironment = [
        "RETICLE_MLX_MODEL": preset.model,
        "RETICLE_MLX_FIM_FORMAT": preset.fimFormat,
      ]
    case .mtplx:
      downloadEnvironment = ["MTPLX_MODEL": preset.model]
    }
    task.environment = ProcessInfo.processInfo.environment.merging(downloadEnvironment) { _, new in
      new
    }

    pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
      let data = handle.availableData
      guard !data.isEmpty else { return }
      let text = String(decoding: data, as: UTF8.self)
      Task { @MainActor [weak self] in
        self?.consume(text)
      }
    }
    task.terminationHandler = { [weak self] completedTask in
      Task { @MainActor [weak self] in
        self?.finish(exitCode: completedTask.terminationStatus)
      }
    }

    do {
      try task.run()
      process = task
      outputPipe = pipe
    } catch {
      pipe.fileHandleForReading.readabilityHandler = nil
      active?.phase = .failed
      active?.error = error.localizedDescription
      output = "Unable to start model download: \(error.localizedDescription)"
    }
  }

  func pause() {
    guard active?.phase == .downloading, let workerPID else { return }
    guard Darwin.kill(workerPID, SIGSTOP) == 0 else {
      active?.error = "Could not pause the download."
      return
    }
    active?.phase = .paused
  }

  func resume() {
    guard active?.phase == .paused, let workerPID else { return }
    guard Darwin.kill(workerPID, SIGCONT) == 0 else {
      active?.error = "Could not resume the download."
      return
    }
    lastSampleDate = Date()
    lastSampleBytes = active?.downloadedBytes ?? 0
    active?.phase = .downloading
  }

  func cancel() {
    guard active?.canCancel == true else { return }
    cancellationRequested = true
    active?.phase = .cancelling
    if let workerPID {
      _ = Darwin.kill(workerPID, SIGCONT)
      _ = Darwin.kill(workerPID, SIGTERM)
    }
    process?.terminate()
  }

  private func consume(_ text: String) {
    lineBuffer += text
    while let newline = lineBuffer.firstIndex(of: "\n") {
      let line = String(lineBuffer[..<newline])
      lineBuffer.removeSubrange(...newline)
      consumeLine(line)
    }
  }

  private func consumeLine(_ line: String) {
    if let worker = ModelDownloadOutputParser.workerPID(from: line) {
      workerPID = worker
      return
    }
    if let event = ModelDownloadOutputParser.progress(from: line) {
      apply(event)
      return
    }
    if let event = ModelDownloadOutputParser.mtplxProgress(
      from: line,
      fallbackTotal: active?.totalBytes ?? 0
    ) {
      apply(event)
      return
    }

    let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }
    output += output.isEmpty ? trimmed : "\n\(trimmed)"
    if active?.phase == .preparing {
      active?.currentFile = trimmed
    }
  }

  private func apply(_ event: ModelDownloadEvent) {
    let now = Date()
    if let previousDate = lastSampleDate {
      let elapsed = now.timeIntervalSince(previousDate)
      let newBytes = max(0, event.downloadedBytes - lastSampleBytes)
      if elapsed >= 0.1, newBytes > 0 {
        let instantSpeed = Double(newBytes) / elapsed
        let oldSpeed = active?.bytesPerSecond ?? 0
        active?.bytesPerSecond = oldSpeed > 0 ? (oldSpeed * 0.7 + instantSpeed * 0.3) : instantSpeed
      }
    }
    lastSampleDate = now
    lastSampleBytes = event.downloadedBytes

    active?.downloadedBytes = event.downloadedBytes
    active?.totalBytes = event.totalBytes
    active?.currentFile = event.file
    if event.stage == "complete" {
      active?.phase = .completed
    } else if active?.phase != .paused {
      active?.phase = event.stage == "metadata" ? .preparing : .downloading
    }
  }

  private func finish(exitCode: Int32) {
    if !lineBuffer.isEmpty {
      consumeLine(lineBuffer)
      lineBuffer = ""
    }
    outputPipe?.fileHandleForReading.readabilityHandler = nil
    outputPipe = nil
    process = nil
    workerPID = nil

    if cancellationRequested {
      active?.phase = .cancelled
      active?.currentFile = "Download cancelled"
      return
    }
    if exitCode == 0 {
      active?.phase = .completed
      active?.downloadedBytes = max(active?.downloadedBytes ?? 0, active?.totalBytes ?? 0)
      active?.currentFile = "Download complete"
      if let modelID = active?.modelID {
        downloadedModelIDs.insert(modelID)
      }
    } else {
      active?.phase = .failed
      active?.error = output.isEmpty ? "Download failed with exit code \(exitCode)." : output
    }
  }
}
