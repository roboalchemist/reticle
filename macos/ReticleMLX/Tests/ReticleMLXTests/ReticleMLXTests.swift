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
      configuration.environment["RETICLE_MLX_MODEL"],
      "roboalchemist/Seed-Coder-8B-Base-MLX-mixed-3-4"
    )
    XCTAssertEqual(configuration.environment["RETICLE_MLX_FIM_FORMAT"], "seed")
    XCTAssertTrue(configuration.vscodeSettings.contains("\"reticle.fimFormat\": \"seed\""))
    XCTAssertTrue(configuration.vscodeSettings.contains("http://127.0.0.1:8001/v1"))
  }

  func testQwenPresetUsesQwenFIMTransport() {
    XCTAssertEqual(ModelPreset.qwenCoder3B.fimFormat, "qwen")
    XCTAssertTrue(ModelPreset.qwenCoder3B.model.contains("Qwen2.5-Coder-3B"))
  }

  func testCommandResultSuccessTracksExitCode() {
    XCTAssertTrue(CommandResult(exitCode: 0, output: "").succeeded)
    XCTAssertFalse(CommandResult(exitCode: 1, output: "failed").succeeded)
  }
}
