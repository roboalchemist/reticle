import XCTest

@testable import ReticleMLX

final class ReticleMLXTests: XCTestCase {
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

  func testSuggestedCatalogCoversSpeedBalanceQualityAndLargeModels() {
    XCTAssertEqual(ModelPreset.suggested.count, 5)
    XCTAssertEqual(ModelPreset.suggested.first, ModelPreset.qwenCoder1Point5B)
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
      badge: nil
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
