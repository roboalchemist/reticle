import Foundation

struct ServiceLogSnapshot: Equatable {
  let directory: URL
  let text: String
}

enum ServiceLogReader {
  static func directoryURL(
    for runtime: ModelRuntime,
    homeDirectory: URL = FileManager.default.homeDirectoryForCurrentUser
  ) -> URL {
    switch runtime {
    case .mlxLM:
      homeDirectory.appendingPathComponent(".reticle/mlx/logs", isDirectory: true)
    case .mtplx:
      homeDirectory.appendingPathComponent(".mtplx/logs", isDirectory: true)
    }
  }

  static func logFileNames(for runtime: ModelRuntime) -> [String] {
    switch runtime {
    case .mlxLM:
      ["server.log", "server.error.log"]
    case .mtplx:
      ["reticle-mtplx.log", "reticle-mtplx.error.log"]
    }
  }

  static func read(
    runtime: ModelRuntime,
    homeDirectory: URL = FileManager.default.homeDirectoryForCurrentUser,
    maximumBytesPerFile: UInt64 = 256 * 1_024
  ) -> ServiceLogSnapshot {
    let directory = directoryURL(for: runtime, homeDirectory: homeDirectory)
    let sections = logFileNames(for: runtime).map { fileName in
      let url = directory.appendingPathComponent(fileName)
      return "===== \(fileName) =====\n\(tail(url, maximumBytes: maximumBytesPerFile))"
    }
    return ServiceLogSnapshot(directory: directory, text: sections.joined(separator: "\n\n"))
  }

  private static func tail(_ url: URL, maximumBytes: UInt64) -> String {
    guard FileManager.default.fileExists(atPath: url.path) else {
      return "(log file does not exist yet)"
    }

    do {
      let handle = try FileHandle(forReadingFrom: url)
      defer { try? handle.close() }
      let size = try handle.seekToEnd()
      let start = size > maximumBytes ? size - maximumBytes : 0
      try handle.seek(toOffset: start)
      let data = try handle.readToEnd() ?? Data()
      let prefix = start > 0 ? "… earlier log content omitted …\n" : ""
      let text = String(decoding: data, as: UTF8.self)
      return text.isEmpty ? "(log file is empty)" : prefix + text
    } catch {
      return "(unable to read log: \(error.localizedDescription))"
    }
  }
}
