import XCTest

@testable import ReticleMLX

final class ReticleMLXTests: XCTestCase {
  func testHealthyStateSaysTheModelIsRunning() {
    XCTAssertEqual(ServiceState.healthy.title, "Model running")
  }

  func testStartingStateNamesTheModelAndAvoidsTheDottedWheel() {
    XCTAssertEqual(ServiceState.starting.title(modelName: "Zeta 2.1"), "Starting Zeta 2.1")
    XCTAssertEqual(ServiceState.starting.symbolName, "hourglass")
    XCTAssertEqual(ServiceState.checking.symbolName, "magnifyingglass")
  }

  func testServiceStateSeparatesStartingFromUnhealthy() {
    let startedAt = Date(timeIntervalSince1970: 1_000)
    var resolver = ServiceStateResolver(startupGraceInterval: 90)
    let starting = CommandResult(
      exitCode: 1,
      output:
        """
        launchd: loaded (gui/501/io.github.roboalchemist.reticle-mlx)
        state = running
        pid = 123
        health: unavailable
        """
    )

    XCTAssertEqual(
      resolver.resolve(
        result: starting,
        serviceDefinitionExists: true,
        now: startedAt
      ),
      .starting
    )
    XCTAssertEqual(ServiceState.starting.title, "Starting")
    XCTAssertEqual(
      resolver.resolve(
        result: starting,
        serviceDefinitionExists: true,
        now: startedAt.addingTimeInterval(89)
      ),
      .starting
    )
    XCTAssertEqual(
      resolver.resolve(
        result: starting,
        serviceDefinitionExists: true,
        now: startedAt.addingTimeInterval(90)
      ),
      .unhealthy
    )
    XCTAssertEqual(ServiceState.unhealthy.title, "Unhealthy")
  }

  func testServiceStateReportsNonRunningLaunchAgentAsUnhealthyImmediately() {
    var resolver = ServiceStateResolver()
    let notRunning = CommandResult(
      exitCode: 1,
      output:
        """
        launchd: loaded (gui/501/io.github.roboalchemist.reticle-mlx)
        state = not running
        last exit code = (never exited)
        health: unavailable
        """
    )

    XCTAssertEqual(
      resolver.resolve(
        result: notRunning,
        serviceDefinitionExists: true
      ),
      .unhealthy
    )
  }

  func testServiceStateResetsStartupGraceForANewProcess() {
    let startedAt = Date(timeIntervalSince1970: 1_000)
    var resolver = ServiceStateResolver(startupGraceInterval: 10)
    let firstProcess = CommandResult(
      exitCode: 1,
      output: "launchd: loaded\nstate = running\npid = 123\nhealth: unavailable\n"
    )
    let nextProcess = CommandResult(
      exitCode: 1,
      output: "launchd: loaded\nstate = running\npid = 456\nhealth: unavailable\n"
    )

    XCTAssertEqual(
      resolver.resolve(
        result: firstProcess,
        serviceDefinitionExists: true,
        now: startedAt
      ),
      .starting
    )
    XCTAssertEqual(
      resolver.resolve(
        result: firstProcess,
        serviceDefinitionExists: true,
        now: startedAt.addingTimeInterval(10)
      ),
      .unhealthy
    )
    XCTAssertEqual(
      resolver.resolve(
        result: nextProcess,
        serviceDefinitionExists: true,
        now: startedAt.addingTimeInterval(11)
      ),
      .starting
    )
  }

  func testServiceStatePreservesStoppedAndNotInstalledDistinction() {
    var resolver = ServiceStateResolver()
    let notLoaded = CommandResult(
      exitCode: 1,
      output: "launchd: not loaded\nhealth: unavailable\n"
    )

    XCTAssertEqual(
      resolver.resolve(result: notLoaded, serviceDefinitionExists: true),
      .stopped
    )
    XCTAssertEqual(
      resolver.resolve(result: notLoaded, serviceDefinitionExists: false),
      .notInstalled
    )
  }

  func testBenchmarkRequestsUseTheSelectedFIMTransport() {
    let marker = "fixture"

    let seed = BenchmarkRequestFactory.make(
      configuration: ServiceConfiguration.defaults,
      marker: marker
    )
    XCTAssertTrue(seed.prompt.hasPrefix("<[fim-suffix]>"))
    XCTAssertTrue(seed.prompt.contains("<[fim-prefix]>"))
    XCTAssertEqual(seed.suffix, "")
    XCTAssertTrue(seed.stream)

    var qwenConfiguration = ServiceConfiguration.defaults
    qwenConfiguration.fimFormat = "qwen"
    let qwen = BenchmarkRequestFactory.make(
      configuration: qwenConfiguration,
      marker: marker
    )
    XCTAssertTrue(qwen.prompt.hasPrefix("<|fim_prefix|>"))
    XCTAssertTrue(qwen.prompt.contains("<|fim_middle|>"))
    XCTAssertEqual(qwen.stop, ["<|fim_pad|>", "<|endoftext|>"])

    var zetaConfiguration = ServiceConfiguration.defaults
    zetaConfiguration.fimFormat = "zeta"
    let zeta = BenchmarkRequestFactory.make(
      configuration: zetaConfiguration,
      marker: marker
    )
    XCTAssertTrue(zeta.prompt.hasPrefix("<[fim-suffix]>"))
    XCTAssertTrue(zeta.prompt.contains("<filename>reticle_benchmark.ts"))
    XCTAssertTrue(zeta.prompt.contains("<|marker_1|>"))
    XCTAssertTrue(zeta.prompt.contains("<|user_cursor|>"))
    XCTAssertTrue(zeta.prompt.contains("<|marker_2|>"))
    XCTAssertEqual(zeta.suffix, "")
  }

  func testBenchmarkResultsCopyAsTabSeparatedValues() {
    let result = ModelBenchmarkResult(
      modelID: "example/model",
      modelName: "Example",
      runtime: "MLX-LM",
      ttftMilliseconds: 12.34,
      coldMilliseconds: 56.78,
      warmMilliseconds: 34.56,
      completionTokensPerSecond: 98.76,
      tokenRateIsEstimated: true,
      completedAt: Date(timeIntervalSince1970: 0)
    )

    XCTAssertTrue(ModelBenchmarkResult.tabSeparatedHeader.contains("TTFT (ms)"))
    XCTAssertEqual(
      result.tabSeparatedValues,
      "Example\tMLX-LM\t12.3\t56.8\t34.6\t98.8\testimated"
    )
  }

  func testLiveBenchmarkMeasuresTTFTAndCompletionRateWhenEnabled() async throws {
    guard ProcessInfo.processInfo.environment["RETICLE_LIVE_BENCHMARK"] == "1" else {
      throw XCTSkip("Set RETICLE_LIVE_BENCHMARK=1 with the default service running.")
    }

    let sample = try await CompletionBenchmarkClient.run(
      configuration: ServiceConfiguration.defaults,
      sessionID: "reticle-live-test-\(UUID().uuidString)",
      marker: UUID().uuidString
    )

    XCTAssertGreaterThan(sample.ttftSeconds, 0)
    XCTAssertGreaterThanOrEqual(sample.totalSeconds, sample.ttftSeconds)
    XCTAssertGreaterThan(sample.completionTokens, 0)
    XCTAssertGreaterThan(sample.tokensPerSecond, 0)
  }

  func testServiceLogReaderFindsRuntimeLogsAndBoundsOutput() throws {
    let home = FileManager.default.temporaryDirectory
      .appendingPathComponent("reticle-log-reader-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: home) }
    let directory = ServiceLogReader.directoryURL(for: .mlxLM, homeDirectory: home)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    try "0123456789abcdef".write(
      to: directory.appendingPathComponent("server.log"),
      atomically: true,
      encoding: .utf8
    )
    try "startup failed".write(
      to: directory.appendingPathComponent("server.error.log"),
      atomically: true,
      encoding: .utf8
    )

    let snapshot = ServiceLogReader.read(
      runtime: .mlxLM,
      homeDirectory: home,
      maximumBytesPerFile: 8
    )

    XCTAssertEqual(snapshot.directory, directory)
    XCTAssertTrue(snapshot.text.contains("earlier log content omitted"))
    XCTAssertTrue(snapshot.text.contains("89abcdef"))
    XCTAssertTrue(snapshot.text.contains("p failed"))
  }

  func testSettingsSidebarStartsWithGeneralAndSeparatesWorkflows() {
    XCTAssertEqual(SettingsSection.defaultSection, .general)
    XCTAssertEqual(
      SettingsSection.allCases,
      [.general, .models, .customModel, .benchmark, .vscodeSetup, .logs]
    )
    XCTAssertEqual(
      SettingsSection.allCases.map(\.title),
      ["General", "Models", "Custom Model", "Benchmark", "VS Code Setup", "Logs"]
    )
  }

  func testActivityPaneDefaultsToTwiceItsPreviousHeight() {
    XCTAssertEqual(SettingsView.activityDefaultHeight, 480)
    XCTAssertEqual(SettingsView.windowIdealHeight, 960)
  }

  func testSparkleRequiresHTTPSFeedAndPublicKey() {
    XCTAssertFalse(SparkleUpdater.isConfigured(feedURL: nil, publicKey: nil))
    XCTAssertFalse(
      SparkleUpdater.isConfigured(
        feedURL: "http://updates.example.com/appcast.xml",
        publicKey: "public-key"
      )
    )
    XCTAssertFalse(
      SparkleUpdater.isConfigured(
        feedURL: "https://updates.example.com/appcast.xml",
        publicKey: " "
      )
    )
    XCTAssertTrue(
      SparkleUpdater.isConfigured(
        feedURL: "https://updates.example.com/appcast.xml",
        publicKey: "public-key"
      )
    )
  }

  func testSeedPresetBuildsMatchingRuntimeAndVSCodeConfiguration() {
    let configuration = ServiceConfiguration.defaults

    XCTAssertEqual(
      configuration.serviceEnvironment["RETICLE_MLX_MODEL"],
      "roboalchemist/Seed-Coder-8B-Base-MLX-mixed-3-4"
    )
    XCTAssertEqual(configuration.serviceEnvironment["RETICLE_MLX_FIM_FORMAT"], "seed")
    XCTAssertTrue(configuration.vscodeSettings.contains("\"reticle.fimFormat\": \"seed\""))
    XCTAssertTrue(configuration.vscodeSettings.contains("http://127.0.0.1:8001/v1"))
  }

  func testQwenPresetUsesQwenFIMTransport() {
    XCTAssertEqual(ModelPreset.qwenCoder3B.fimFormat, "qwen")
    XCTAssertTrue(ModelPreset.qwenCoder3B.model.contains("Qwen2.5-Coder-3B"))
    XCTAssertFalse(ModelPreset.qwenCoder3B.model.contains("Instruct"))
  }

  func testZeta21IsSecondAndUsesMacReadyMLXQuant() {
    XCTAssertEqual(ModelPreset.suggested.dropFirst().first, ModelPreset.zeta2Point1)
    XCTAssertEqual(ModelPreset.zeta2Point1.model, "slxnxl/zeta-2.1-mlx-4bit")
    XCTAssertEqual(ModelPreset.zeta2Point1.runtime, .mlxLM)
    XCTAssertEqual(ModelPreset.zeta2Point1.minimumMemoryGB, 16)
    XCTAssertEqual(ModelPreset.zeta2Point1.fimFormat, "zeta")
    XCTAssertTrue(ModelPreset.zeta2Point1.supportsInlineCompletion)
    XCTAssertEqual(
      ModelPreset.zeta2Point1.upstreamURL?.absoluteString,
      "https://huggingface.co/zed-industries/zeta-2.1"
    )
    XCTAssertTrue(ModelPreset.inlineCompletionPresets.contains(ModelPreset.zeta2Point1))
  }

  func testBenchmarkCatalogIncludesOnlyDownloadedFIMModels() {
    let downloaded = ModelPreset.downloadedInlineCompletionPresets(
      in: [
        ModelPreset.zeta2Point1.id,
        ModelPreset.qwenCoder1Point5B.id,
        ModelPreset.codestral22B.id,
      ]
    )

    XCTAssertEqual(
      downloaded,
      [
        ModelPreset.zeta2Point1,
        ModelPreset.qwenCoder1Point5B,
        ModelPreset.codestral22B,
      ]
    )
    XCTAssertFalse(downloaded.contains(ModelPreset.seedCoder))
  }

  func testZeta7BRemainsValidatedFIMOption() {
    XCTAssertEqual(ModelPreset.suggested.dropFirst(2).first, ModelPreset.zeta7B)
    XCTAssertEqual(ModelPreset.zeta7B.model, "mlx-community/zed-industries-zeta-4bit")
    XCTAssertEqual(ModelPreset.zeta7B.fimFormat, "qwen")
    XCTAssertEqual(ModelPreset.zeta7B.runtime, .mlxLM)
    XCTAssertEqual(ModelPreset.zeta7B.minimumMemoryGB, 16)
    XCTAssertTrue(ModelPreset.zeta7B.supportsInlineCompletion)
  }

  func testSuggestedCatalogCoversSpeedBalanceQualityAndLargeModels() {
    XCTAssertEqual(ModelPreset.suggested.count, 7)
    XCTAssertEqual(ModelPreset.inlineCompletionPresets.count, 7)
    XCTAssertEqual(ModelPreset.suggested.first, ModelPreset.seedCoder)
    XCTAssertTrue(ModelPreset.suggested.first?.isRecommended == true)
    XCTAssertTrue(ModelPreset.suggested.dropFirst().allSatisfy { !$0.isRecommended })
    XCTAssertEqual(ModelPreset.seedCoder.qualityScore, 5)
    XCTAssertEqual(ModelPreset.qwenCoder1Point5B.speedScore, 5)
    XCTAssertEqual(ModelPreset.qwen35MTPLX.runtime, .mtplx)
    XCTAssertEqual(
      ModelPreset.qwen35MTPLX.requestModel,
      "mtplx-qwen35-9b-optimized-speed"
    )
    XCTAssertEqual(ModelPreset.codestral22B.fimFormat, "codestral")
    XCTAssertGreaterThan(ModelPreset.codestral22B.downloadSizeBytes, 10_000_000_000)
  }

  func testEverySuggestedModelHasAnOfficialModelCard() {
    XCTAssertEqual(
      Dictionary(
        uniqueKeysWithValues: ModelPreset.suggested.map {
          ($0.id, $0.upstreamURL!.absoluteString)
        }
      ),
      [
        ModelPreset.seedCoder.id:
          "https://huggingface.co/ByteDance-Seed/Seed-Coder-8B-Base",
        ModelPreset.zeta2Point1.id:
          "https://huggingface.co/zed-industries/zeta-2.1",
        ModelPreset.zeta7B.id:
          "https://huggingface.co/zed-industries/zeta",
        ModelPreset.qwenCoder1Point5B.id:
          "https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B",
        ModelPreset.qwenCoder3B.id:
          "https://huggingface.co/Qwen/Qwen2.5-Coder-3B",
        ModelPreset.qwen35MTPLX.id:
          "https://huggingface.co/Youssofal/Qwen3.5-9B-MTPLX-Optimized-Speed",
        ModelPreset.codestral22B.id:
          "https://huggingface.co/mistralai/Codestral-22B-v0.1",
      ]
    )
  }

  func testMTPLXDownloadOutputParserReadsNativeProgressJSON() {
    XCTAssertEqual(
      ModelDownloadOutputParser.mtplxProgress(
        from:
          #"{"event":"progress","size_bytes":50,"total_bytes":200,"file":"model.safetensors"}"#,
        fallbackTotal: 100
      ),
      ModelDownloadEvent(
        downloadedBytes: 50,
        totalBytes: 200,
        file: "model.safetensors",
        stage: "downloading"
      )
    )
  }

  func testMTPLXPresetBuildsSeparateServiceAndVSCodeModels() {
    let preset = ModelPreset.qwen35MTPLX
    let configuration = ServiceConfiguration(
      model: preset.model,
      requestModel: preset.requestModel,
      fimFormat: preset.fimFormat,
      runtime: preset.runtime,
      port: preset.defaultPort,
      promptCacheSize: 8,
      promptCacheBytes: 4_294_967_296
    )

    XCTAssertEqual(configuration.serviceEnvironment["MTPLX_MODEL"], preset.model)
    XCTAssertEqual(configuration.serviceEnvironment["MTPLX_SKIP_DOWNLOAD"], "1")
    XCTAssertNil(configuration.serviceEnvironment["RETICLE_MLX_MODEL"])
    XCTAssertEqual(
      configuration.vscodeEnvironment["RETICLE_MLX_MODEL"],
      "mtplx-qwen35-9b-optimized-speed"
    )
    XCTAssertTrue(
      configuration.vscodeSettings.contains(
        "\"reticle.model\": \"mtplx-qwen35-9b-optimized-speed\""
      )
    )
    XCTAssertTrue(configuration.vscodeSettings.contains("http://127.0.0.1:8000/v1"))
  }

  @MainActor
  func testLegacyMLXSettingsMigrateToDefaultModelAlias() {
    let suite = "ReticleMLXTests.\(UUID().uuidString)"
    let defaults = UserDefaults(suiteName: suite)!
    defer { defaults.removePersistentDomain(forName: suite) }
    defaults.set(ModelPreset.codestral22B.model, forKey: "model")
    defaults.set("codestral", forKey: "fimFormat")

    let configuration = ServiceConfiguration.load(from: defaults)

    XCTAssertEqual(configuration.runtime, .mlxLM)
    XCTAssertEqual(configuration.requestModel, "default_model")
  }

  func testDownloadOutputParserReadsWorkerAndByteProgress() {
    XCTAssertEqual(
      ModelDownloadOutputParser.workerPID(from: "RETICLE_DOWNLOAD_WORKER\t1234"),
      1234
    )
    XCTAssertEqual(
      ModelDownloadOutputParser.progress(
        from: ModelDownloadOutputParser.progressPrefix
          + #"{"downloadedBytes":25,"totalBytes":100,"file":"weights.safetensors","stage":"downloading"}"#
      ),
      ModelDownloadEvent(
        downloadedBytes: 25,
        totalBytes: 100,
        file: "weights.safetensors",
        stage: "downloading"
      )
    )
  }

  func testDownloadProgressExposesPauseResumeCancelStates() {
    var progress = ModelDownloadProgress(
      modelID: "model",
      modelName: "Model",
      phase: .downloading,
      downloadedBytes: 25,
      totalBytes: 100,
      currentFile: "weights",
      bytesPerSecond: 25,
      error: nil
    )
    XCTAssertEqual(progress.fractionCompleted, 0.25)
    XCTAssertTrue(progress.canPause)
    XCTAssertTrue(progress.canCancel)
    XCTAssertEqual(progress.etaSeconds, 3)

    progress.phase = .paused
    XCTAssertTrue(progress.canResume)
    XCTAssertTrue(progress.canCancel)
  }

  @MainActor
  func testServiceControllerDeletesDownloadedInactiveModel() async throws {
    let suite = "ReticleMLXTests.\(UUID().uuidString)"
    let defaults = UserDefaults(suiteName: suite)!
    defer { defaults.removePersistentDomain(forName: suite) }
    ServiceConfiguration.defaults.save(to: defaults)

    let directory = FileManager.default.temporaryDirectory
      .appendingPathComponent("reticle-remove-test-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }
    let script = directory.appendingPathComponent("reticle-mlx")
    try """
    #!/bin/sh
    test "$1" = "remove"
    test "$RETICLE_MLX_MODEL" = "\(ModelPreset.qwenCoder1Point5B.model)"
    printf 'Deleted %s. Reclaimed approximately 1.0 GB.\\n' "$RETICLE_MLX_MODEL"
    """.write(to: script, atomically: true, encoding: .utf8)
    XCTAssertEqual(chmod(script.path, 0o755), 0)

    let downloads = ModelDownloadController()
    downloads.markDownloaded(ModelPreset.qwenCoder1Point5B, downloaded: true)
    let controller = ServiceController(
      mlxRunner: CommandRunner(executableURL: script),
      mtplxRunner: nil,
      downloads: downloads,
      defaults: defaults
    )

    await controller.remove(ModelPreset.qwenCoder1Point5B)

    XCTAssertFalse(downloads.isDownloaded(ModelPreset.qwenCoder1Point5B))
    XCTAssertNil(controller.removingModelID)
    XCTAssertTrue(controller.output.contains("Reclaimed approximately 1.0 GB"))
  }

  @MainActor
  func testServiceControllerRefusesToDeleteConfiguredModel() async {
    let suite = "ReticleMLXTests.\(UUID().uuidString)"
    let defaults = UserDefaults(suiteName: suite)!
    defer { defaults.removePersistentDomain(forName: suite) }
    ServiceConfiguration.defaults.save(to: defaults)
    let downloads = ModelDownloadController()
    downloads.markDownloaded(ModelPreset.seedCoder, downloaded: true)
    let controller = ServiceController(
      mlxRunner: nil,
      mtplxRunner: nil,
      downloads: downloads,
      defaults: defaults
    )

    await controller.remove(ModelPreset.seedCoder)

    XCTAssertTrue(downloads.isDownloaded(ModelPreset.seedCoder))
    XCTAssertEqual(
      controller.output,
      "Switch to another model before deleting \(ModelPreset.seedCoder.name)."
    )
  }

  @MainActor
  func testDownloadControllerPausesResumesAndCancelsWorker() async throws {
    let directory = FileManager.default.temporaryDirectory
      .appendingPathComponent("reticle-download-test-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }

    let script = directory.appendingPathComponent("reticle-mlx")
    try """
    #!/bin/sh
    sleep 30 &
    worker=$!
    printf 'RETICLE_DOWNLOAD_WORKER\\t%s\\n' "$worker"
    printf 'RETICLE_DOWNLOAD_PROGRESS\\t%s\\n' '{"downloadedBytes":25,"totalBytes":100,"file":"weights","stage":"downloading"}'
    wait "$worker"
    """.write(to: script, atomically: true, encoding: .utf8)
    XCTAssertEqual(chmod(script.path, 0o755), 0)

    let preset = ModelPreset(
      id: "test-model",
      name: "Test model",
      tagline: "Test",
      model: "example/test",
      requestModel: "example/test",
      fimFormat: "qwen",
      runtime: .mlxLM,
      defaultPort: 8001,
      summary: "Test",
      downloadSizeBytes: 100,
      minimumMemoryGB: 1,
      qualityScore: 1,
      speedScore: 1,
      memoryScore: 1,
      badge: nil,
      supportsInlineCompletion: true
    )
    let controller = ModelDownloadController()
    controller.start(preset, executableURL: script)

    for _ in 0..<100 {
      if controller.active?.phase == .downloading { break }
      try await Task.sleep(nanoseconds: 10_000_000)
    }
    XCTAssertEqual(controller.active?.phase, .downloading)

    controller.pause()
    XCTAssertEqual(controller.active?.phase, .paused)
    controller.resume()
    XCTAssertEqual(controller.active?.phase, .downloading)
    controller.cancel()

    for _ in 0..<100 {
      if controller.active?.phase == .cancelled { break }
      try await Task.sleep(nanoseconds: 10_000_000)
    }
    XCTAssertEqual(controller.active?.phase, .cancelled)
  }

  func testCommandResultSuccessTracksExitCode() {
    XCTAssertTrue(CommandResult(exitCode: 0, output: "").succeeded)
    XCTAssertFalse(CommandResult(exitCode: 1, output: "failed").succeeded)
  }
}
