import Foundation

struct ModelPreset: Identifiable, Hashable {
  let id: String
  let name: String
  let model: String
  let fimFormat: String
  let note: String

  static let seedCoder = ModelPreset(
    id: "seed-coder-8b",
    name: "Seed-Coder 8B — quality",
    model: "roboalchemist/Seed-Coder-8B-Base-MLX-mixed-3-4",
    fimFormat: "seed",
    note: "Best completion quality in Reticle's Mac tests; about 3.6 GB."
  )

  static let qwenCoder3B = ModelPreset(
    id: "qwen-coder-3b",
    name: "Qwen2.5-Coder 3B — speed",
    model: "mlx-community/Qwen2.5-Coder-3B-Instruct-4bit",
    fimFormat: "qwen",
    note: "Lower latency and memory use, with less reliable FIM quality than Seed."
  )

  static let custom = ModelPreset(
    id: "custom",
    name: "Custom MLX model",
    model: "",
    fimFormat: "openai",
    note: "Use an MLX-LM model or local path that supports the selected FIM format."
  )

  static let all = [seedCoder, qwenCoder3B, custom]
}

struct ServiceConfiguration: Equatable {
  var model: String
  var fimFormat: String
  var port: Int
  var promptCacheSize: Int
  var promptCacheBytes: Int

  static let defaults = ServiceConfiguration(
    model: ModelPreset.seedCoder.model,
    fimFormat: ModelPreset.seedCoder.fimFormat,
    port: 8001,
    promptCacheSize: 8,
    promptCacheBytes: 4_294_967_296
  )

  var environment: [String: String] {
    [
      "RETICLE_MLX_MODEL": model,
      "RETICLE_MLX_FIM_FORMAT": fimFormat,
      "RETICLE_MLX_PORT": String(port),
      "RETICLE_MLX_PROMPT_CACHE_SIZE": String(promptCacheSize),
      "RETICLE_MLX_PROMPT_CACHE_BYTES": String(promptCacheBytes),
    ]
  }

  var vscodeSettings: String {
    """
    {
      "reticle.baseURL": "http://127.0.0.1:\(port)/v1",
      "reticle.model": "\(model)",
      "reticle.fimFormat": "\(fimFormat)",
      "reticle.temperature": 0,
      "reticle.maxTokens": 64,
      "reticle.maxLines": 8
    }
    """
  }

  @MainActor
  static func load(from defaults: UserDefaults = .standard) -> ServiceConfiguration {
    var configuration = ServiceConfiguration.defaults
    if let model = defaults.string(forKey: "model"), !model.isEmpty {
      configuration.model = model
    }
    if let format = defaults.string(forKey: "fimFormat"), !format.isEmpty {
      configuration.fimFormat = format
    }
    let port = defaults.integer(forKey: "port")
    if port > 0 {
      configuration.port = port
    }
    let cacheSize = defaults.integer(forKey: "promptCacheSize")
    if cacheSize > 0 {
      configuration.promptCacheSize = cacheSize
    }
    let cacheBytes = defaults.object(forKey: "promptCacheBytes") as? NSNumber
    if let cacheBytes, cacheBytes.intValue > 0 {
      configuration.promptCacheBytes = cacheBytes.intValue
    }
    return configuration
  }

  @MainActor
  func save(to defaults: UserDefaults = .standard) {
    defaults.set(model, forKey: "model")
    defaults.set(fimFormat, forKey: "fimFormat")
    defaults.set(port, forKey: "port")
    defaults.set(promptCacheSize, forKey: "promptCacheSize")
    defaults.set(promptCacheBytes, forKey: "promptCacheBytes")
  }
}
