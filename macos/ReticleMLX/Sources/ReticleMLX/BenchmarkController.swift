import AppKit
import Foundation
import UniformTypeIdentifiers

struct BenchmarkRequestPayload: Encodable, Equatable {
  let model: String
  let prompt: String
  let suffix: String
  let maxTokens: Int
  let stop: [String]?
  let temperature: Double
  let stream: Bool

  enum CodingKeys: String, CodingKey {
    case model
    case prompt
    case suffix
    case maxTokens = "max_tokens"
    case stop
    case temperature
    case stream
  }
}

enum BenchmarkRequestFactory {
  static func make(
    configuration: ServiceConfiguration,
    marker: String
  ) -> BenchmarkRequestPayload {
    let prefix =
      """
      // Reticle benchmark \(marker)
      function formatUsers(users: User[]): string[] {
        return users
          .
      """
    let suffix =
      """

          .map((user) => `${user.name}: ${user.email}`);
      }
      interface User { name: string; email: string; active: boolean }
      """

    switch configuration.fimFormat {
    case "qwen":
      return BenchmarkRequestPayload(
        model: configuration.requestModel,
        prompt: "<|fim_prefix|>\(prefix)<|fim_suffix|>\(suffix)<|fim_middle|>",
        suffix: "",
        maxTokens: 64,
        stop: ["<|fim_pad|>", "<|endoftext|>"],
        temperature: 0,
        stream: true
      )
    case "seed":
      return BenchmarkRequestPayload(
        model: configuration.requestModel,
        prompt: "<[fim-suffix]>\(suffix)<[fim-prefix]>\(prefix)<[fim-middle]>",
        suffix: "",
        maxTokens: 64,
        stop: nil,
        temperature: 0,
        stream: true
      )
    case "zeta":
      return BenchmarkRequestPayload(
        model: configuration.requestModel,
        prompt:
          "<[fim-suffix]>\(suffix)<[fim-prefix]><filename>reticle_benchmark.ts\n<|marker_1|>\(prefix)<|user_cursor|><|marker_2|><[fim-middle]>",
        suffix: "",
        maxTokens: 64,
        stop: nil,
        temperature: 0,
        stream: true
      )
    case "codestral":
      return BenchmarkRequestPayload(
        model: configuration.requestModel,
        prompt: "[SUFFIX]\(suffix)[PREFIX]\(prefix)",
        suffix: "",
        maxTokens: 64,
        stop: ["</s>"],
        temperature: 0,
        stream: true
      )
    default:
      return BenchmarkRequestPayload(
        model: configuration.requestModel,
        prompt: prefix,
        suffix: suffix,
        maxTokens: 64,
        stop: nil,
        temperature: 0,
        stream: true
      )
    }
  }
}

struct ModelBenchmarkResult: Identifiable, Equatable {
  let modelID: String
  let modelName: String
  let runtime: String
  let ttftMilliseconds: Double
  let coldMilliseconds: Double
  let warmMilliseconds: Double
  let completionTokensPerSecond: Double
  let tokenRateIsEstimated: Bool
  let completedAt: Date

  var id: String { modelID }

  static let tabSeparatedHeader =
    "Model\tRuntime\tTTFT (ms)\tCold total (ms)\tWarm total (ms)\tCompletion (tok/s)\tToken rate"

  var tabSeparatedValues: String {
    [
      modelName,
      runtime,
      Self.format(ttftMilliseconds),
      Self.format(coldMilliseconds),
      Self.format(warmMilliseconds),
      Self.format(completionTokensPerSecond),
      tokenRateIsEstimated ? "estimated" : "reported",
    ].joined(separator: "\t")
  }

  private static func format(_ value: Double) -> String {
    String(format: "%.1f", value)
  }
}

struct CompletionBenchmarkSample {
  let ttftSeconds: Double
  let totalSeconds: Double
  let completionTokens: Int
  let tokenCountIsEstimated: Bool

  var tokensPerSecond: Double {
    let decodeSeconds = max(0.001, totalSeconds - ttftSeconds)
    return Double(completionTokens) / decodeSeconds
  }
}

enum CompletionBenchmarkClient {
  static func run(
    configuration: ServiceConfiguration,
    sessionID: String,
    marker: String,
    session: URLSession = .shared
  ) async throws -> CompletionBenchmarkSample {
    let endpoint = URL(
      string: "http://127.0.0.1:\(configuration.port)/v1/completions"
    )!
    var request = URLRequest(url: endpoint)
    request.httpMethod = "POST"
    request.timeoutInterval = 180
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue(sessionID, forHTTPHeaderField: "x-reticle-autocomplete-session-id")
    request.httpBody = try JSONEncoder().encode(
      BenchmarkRequestFactory.make(configuration: configuration, marker: marker)
    )

    let startedAt = ProcessInfo.processInfo.systemUptime
    let (bytes, response) = try await session.bytes(for: request)
    guard let httpResponse = response as? HTTPURLResponse,
      (200..<300).contains(httpResponse.statusCode)
    else {
      throw URLError(.badServerResponse)
    }

    var firstTokenAt: Double?
    var completion = ""
    var reportedTokens: Int?
    var eventCount = 0

    for try await line in bytes.lines {
      let dataText: String
      if line.hasPrefix("data:") {
        dataText = String(line.dropFirst(5)).trimmingCharacters(in: .whitespaces)
      } else if line.hasPrefix("{") {
        dataText = line
      } else {
        continue
      }
      if dataText == "[DONE]" {
        break
      }
      guard let data = dataText.data(using: .utf8),
        let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
      else {
        continue
      }
      if let error = object["error"] {
        throw NSError(
          domain: "ReticleBenchmark",
          code: 1,
          userInfo: [NSLocalizedDescriptionKey: String(describing: error)]
        )
      }
      if let usage = object["usage"] as? [String: Any],
        let tokens = usage["completion_tokens"] as? Int
      {
        reportedTokens = tokens
      }
      guard let choices = object["choices"] as? [[String: Any]],
        let text = choices.first?["text"] as? String,
        !text.isEmpty
      else {
        continue
      }
      if firstTokenAt == nil {
        firstTokenAt = ProcessInfo.processInfo.systemUptime
      }
      completion += text
      eventCount += 1
    }

    let finishedAt = ProcessInfo.processInfo.systemUptime
    let total = finishedAt - startedAt
    let ttft = (firstTokenAt ?? finishedAt) - startedAt
    let estimatedTokens = max(eventCount, Int(ceil(Double(completion.utf8.count) / 4.0)))
    return CompletionBenchmarkSample(
      ttftSeconds: ttft,
      totalSeconds: total,
      completionTokens: max(1, reportedTokens ?? estimatedTokens),
      tokenCountIsEstimated: reportedTokens == nil
    )
  }
}

@MainActor
final class BenchmarkController: ObservableObject {
  @Published private(set) var results: [ModelBenchmarkResult] = []
  @Published private(set) var isRunning = false
  @Published private(set) var status = "No benchmark has been run."

  func run(configuration: ServiceConfiguration, modelName: String) async {
    guard !isRunning else { return }
    isRunning = true
    status = "Running a cold prompt and three warm prompt-cache samples…"
    defer { isRunning = false }

    do {
      let marker = UUID().uuidString
      let sessionID = "reticle-benchmark-\(marker)"
      let cold = try await CompletionBenchmarkClient.run(
        configuration: configuration,
        sessionID: sessionID,
        marker: marker
      )
      var warmSamples: [CompletionBenchmarkSample] = []
      for _ in 0..<3 {
        warmSamples.append(
          try await CompletionBenchmarkClient.run(
            configuration: configuration,
            sessionID: sessionID,
            marker: marker
          )
        )
      }

      let result = ModelBenchmarkResult(
        modelID: configuration.model,
        modelName: modelName,
        runtime: configuration.runtime.displayName,
        ttftMilliseconds: median(warmSamples.map(\.ttftSeconds)) * 1_000,
        coldMilliseconds: cold.totalSeconds * 1_000,
        warmMilliseconds: median(warmSamples.map(\.totalSeconds)) * 1_000,
        completionTokensPerSecond: median(warmSamples.map(\.tokensPerSecond)),
        tokenRateIsEstimated: warmSamples.contains(where: \.tokenCountIsEstimated),
        completedAt: Date()
      )
      results.removeAll { $0.modelID == result.modelID }
      results.insert(result, at: 0)
      status = "Completed \(modelName). Warm values are the median of three runs."
    } catch {
      status = "Benchmark failed: \(error.localizedDescription)"
    }
  }

  func copyResults() {
    NSPasteboard.general.clearContents()
    NSPasteboard.general.setString(tabSeparatedResults, forType: .string)
    status = "Copied benchmark results as tab-separated text."
  }

  func exportResults() {
    let panel = NSSavePanel()
    panel.allowedContentTypes = [.tabSeparatedText]
    panel.canCreateDirectories = true
    panel.nameFieldStringValue = "reticle-mlx-benchmarks.tsv"
    guard panel.runModal() == .OK, let url = panel.url else { return }
    do {
      try tabSeparatedResults.write(to: url, atomically: true, encoding: .utf8)
      status = "Exported benchmark results to \(url.path)."
    } catch {
      status = "Could not export benchmark results: \(error.localizedDescription)"
    }
  }

  var tabSeparatedResults: String {
    ([ModelBenchmarkResult.tabSeparatedHeader] + results.map(\.tabSeparatedValues))
      .joined(separator: "\n")
  }

  private func median(_ values: [Double]) -> Double {
    let sorted = values.sorted()
    guard !sorted.isEmpty else { return 0 }
    if sorted.count.isMultiple(of: 2) {
      return (sorted[sorted.count / 2 - 1] + sorted[sorted.count / 2]) / 2
    }
    return sorted[sorted.count / 2]
  }
}
