import Sparkle

@MainActor
final class SparkleUpdater {
  private let updaterController: SPUStandardUpdaterController?

  init(bundle: Bundle = .main) {
    guard Self.isConfigured(bundle: bundle) else {
      updaterController = nil
      return
    }

    updaterController = SPUStandardUpdaterController(
      startingUpdater: true,
      updaterDelegate: nil,
      userDriverDelegate: nil
    )
  }

  var updater: SPUUpdater? {
    updaterController?.updater
  }

  var canCheckForUpdates: Bool {
    updater?.canCheckForUpdates == true
  }

  func checkForUpdates() {
    updater?.checkForUpdates()
  }

  nonisolated static func isConfigured(bundle: Bundle) -> Bool {
    isConfigured(
      feedURL: bundle.object(forInfoDictionaryKey: "SUFeedURL") as? String,
      publicKey: bundle.object(forInfoDictionaryKey: "SUPublicEDKey") as? String
    )
  }

  nonisolated static func isConfigured(feedURL: String?, publicKey: String?) -> Bool {
    guard let feedURL, let url = URL(string: feedURL), url.scheme == "https" else { return false }
    guard let publicKey, !publicKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    else { return false }

    return true
  }
}
