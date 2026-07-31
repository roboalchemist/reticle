import Foundation

enum ModelRuntime: String, CaseIterable {
  case mlxLM = "mlx-lm"
  case mtplx

  var displayName: String {
    switch self {
    case .mlxLM: "MLX-LM"
    case .mtplx: "MTPLX"
    }
  }
}

struct ModelPreset: Identifiable, Hashable {
  let id: String
  let name: String
  let tagline: String
  let model: String
  let requestModel: String
  let fimFormat: String
  let runtime: ModelRuntime
  let defaultPort: Int
  let summary: String
  let downloadSizeBytes: Int64
  let minimumMemoryGB: Int
  let qualityScore: Int
  let speedScore: Int
  let memoryScore: Int
  let badge: String?
  let supportsInlineCompletion: Bool

  static let seedCoder = ModelPreset(
    id: "seed-coder-8b",
    name: "Seed-Coder 8B",
    tagline: "Best tested completion quality",
    model: "roboalchemist/Seed-Coder-8B-Base-MLX-mixed-3-4",
    requestModel: "default_model",
    fimFormat: "seed",
    runtime: .mlxLM,
    defaultPort: 8001,
    summary:
      "Reticle’s recommended model for accurate multi-language, multi-line edits. Our mixed 3/4-bit build preserves quality while improving Mac decode speed.",
    downloadSizeBytes: 3_600_000_000,
    minimumMemoryGB: 16,
    qualityScore: 5,
    speedScore: 3,
    memoryScore: 3,
    badge: "Recommended",
    supportsInlineCompletion: true
  )

  static let zeta2Point1 = ModelPreset(
    id: "zeta-2.1",
    name: "Zeta 2.1",
    tagline: "Latest Zed edit model",
    model: "slxnxl/zeta-2.1-mlx-4bit",
    requestModel: "default_model",
    fimFormat: "zeta",
    runtime: .mlxLM,
    defaultPort: 8001,
    summary:
      "The Mac-ready 4-bit build of Zed’s latest edit-prediction model. Reticle adapts its marker-wrapped region rewrites into regular cursor-local FIM suggestions.",
    downloadSizeBytes: 4_653_300_633,
    minimumMemoryGB: 16,
    qualityScore: 5,
    speedScore: 3,
    memoryScore: 3,
    badge: "Zeta FIM",
    supportsInlineCompletion: true
  )

  static let zeta7B = ModelPreset(
    id: "zeta-7b",
    name: "Zeta 7B",
    tagline: "Next-edit tuned",
    model: "mlx-community/zed-industries-zeta-4bit",
    requestModel: "default_model",
    fimFormat: "qwen",
    runtime: .mlxLM,
    defaultPort: 8001,
    summary:
      "Zed’s Qwen2.5-Coder 7B edit-prediction fine-tune. Reticle uses its validated Qwen FIM compatibility for safe cursor-local, multi-line suggestions.",
    downloadSizeBytes: 4_295_768_341,
    minimumMemoryGB: 16,
    qualityScore: 4,
    speedScore: 3,
    memoryScore: 3,
    badge: "Edit prediction",
    supportsInlineCompletion: true
  )

  static let qwenCoder1Point5B = ModelPreset(
    id: "qwen-coder-1.5b",
    name: "Qwen2.5-Coder 1.5B",
    tagline: "Fastest and lightest",
    model: "mlx-community/Qwen2.5-Coder-1.5B-4bit",
    requestModel: "default_model",
    fimFormat: "qwen",
    runtime: .mlxLM,
    defaultPort: 8001,
    summary:
      "The quickest way to get low-latency local suggestions. Ideal for smaller-memory Macs and short, frequent completions.",
    downloadSizeBytes: 950_000_000,
    minimumMemoryGB: 8,
    qualityScore: 3,
    speedScore: 5,
    memoryScore: 5,
    badge: "Fastest",
    supportsInlineCompletion: true
  )

  static let qwenCoder3B = ModelPreset(
    id: "qwen-coder-3b",
    name: "Qwen2.5-Coder 3B",
    tagline: "Balanced speed and quality",
    model: "mlx-community/Qwen2.5-Coder-3B-4bit",
    requestModel: "default_model",
    fimFormat: "qwen",
    runtime: .mlxLM,
    defaultPort: 8001,
    summary:
      "A practical middle ground: stronger completions than the 1.5B model while remaining responsive on everyday Apple Silicon.",
    downloadSizeBytes: 1_850_000_000,
    minimumMemoryGB: 12,
    qualityScore: 4,
    speedScore: 4,
    memoryScore: 4,
    badge: "Balanced",
    supportsInlineCompletion: true
  )

  static let qwen35MTPLX = ModelPreset(
    id: "qwen3.5-9b-mtplx",
    name: "Qwen3.5 9B MTPLX",
    tagline: "Fast speculative completion",
    model: "Youssofal/Qwen3.5-9B-MTPLX-Optimized-Speed",
    requestModel: "mtplx-qwen35-9b-optimized-speed",
    fimFormat: "qwen",
    runtime: .mtplx,
    defaultPort: 8000,
    summary:
      "A verified native-MTP model served by MTPLX. Choose it for low-latency multi-line suggestions with speculative decoding and a persistent prompt cache.",
    downloadSizeBytes: 8_695_123_128,
    minimumMemoryGB: 16,
    qualityScore: 4,
    speedScore: 5,
    memoryScore: 2,
    badge: "Speculative",
    supportsInlineCompletion: true
  )

  static let codestral22B = ModelPreset(
    id: "codestral-22b",
    name: "Codestral 22B",
    tagline: "Large-model code specialist",
    model: "mlx-community/Codestral-22B-v0.1-4bit",
    requestModel: "default_model",
    fimFormat: "codestral",
    runtime: .mlxLM,
    defaultPort: 8001,
    summary:
      "A much larger FIM-native coding model for high-memory Macs. Choose it when richer completions matter more than latency or disk use.",
    downloadSizeBytes: 12_500_000_000,
    minimumMemoryGB: 32,
    qualityScore: 4,
    speedScore: 2,
    memoryScore: 1,
    badge: "Large",
    supportsInlineCompletion: true
  )

  static let custom = ModelPreset(
    id: "custom",
    name: "Custom MLX model",
    tagline: "Advanced",
    model: "",
    requestModel: "default_model",
    fimFormat: "openai",
    runtime: .mlxLM,
    defaultPort: 8001,
    summary: "Use an MLX-LM model or local path that supports the selected FIM format.",
    downloadSizeBytes: 0,
    minimumMemoryGB: 0,
    qualityScore: 0,
    speedScore: 0,
    memoryScore: 0,
    badge: nil,
    supportsInlineCompletion: true
  )

  private static let catalog = [
    zeta2Point1,
    zeta7B,
    qwenCoder1Point5B,
    qwenCoder3B,
    qwen35MTPLX,
    seedCoder,
    codestral22B,
  ]

  static let suggested =
    catalog.enumerated()
    .sorted { left, right in
      if left.element.isRecommended != right.element.isRecommended {
        return left.element.isRecommended
      }
      return left.offset < right.offset
    }
    .map(\.element)

  static let all = suggested + [custom]
  static let inlineCompletionPresets = suggested.filter(\.supportsInlineCompletion)

  static func downloadedInlineCompletionPresets(in modelIDs: Set<String>) -> [ModelPreset] {
    inlineCompletionPresets.filter { modelIDs.contains($0.id) }
  }

  static func displayName(for model: String, runtime: ModelRuntime) -> String {
    if let preset = suggested.first(where: { $0.model == model && $0.runtime == runtime }) {
      return preset.name
    }
    let name = model.split(separator: "/").last.map(String.init) ?? model
    return name.isEmpty ? "model" : name
  }

  var upstreamURL: URL? {
    let address: String
    switch id {
    case Self.seedCoder.id:
      address = "https://huggingface.co/ByteDance-Seed/Seed-Coder-8B-Base"
    case Self.zeta2Point1.id:
      address = "https://huggingface.co/zed-industries/zeta-2.1"
    case Self.zeta7B.id:
      address = "https://huggingface.co/zed-industries/zeta"
    case Self.qwenCoder1Point5B.id:
      address = "https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B"
    case Self.qwenCoder3B.id:
      address = "https://huggingface.co/Qwen/Qwen2.5-Coder-3B"
    case Self.qwen35MTPLX.id:
      address = "https://huggingface.co/Youssofal/Qwen3.5-9B-MTPLX-Optimized-Speed"
    case Self.codestral22B.id:
      address = "https://huggingface.co/mistralai/Codestral-22B-v0.1"
    default:
      return nil
    }
    return URL(string: address)
  }

  var isRecommended: Bool {
    badge == "Recommended"
  }

  var formattedDownloadSize: String {
    ByteCountFormatter.string(fromByteCount: downloadSizeBytes, countStyle: .file)
  }
}

struct ServiceConfiguration: Equatable {
  var model: String
  var requestModel: String
  var fimFormat: String
  var runtime: ModelRuntime
  var port: Int
  var promptCacheSize: Int
  var promptCacheBytes: Int

  static let defaults = ServiceConfiguration(
    model: ModelPreset.seedCoder.model,
    requestModel: ModelPreset.seedCoder.requestModel,
    fimFormat: ModelPreset.seedCoder.fimFormat,
    runtime: ModelPreset.seedCoder.runtime,
    port: 8001,
    promptCacheSize: 8,
    promptCacheBytes: 4_294_967_296
  )

  var serviceEnvironment: [String: String] {
    switch runtime {
    case .mlxLM:
      [
        "RETICLE_MLX_MODEL": model,
        "RETICLE_MLX_FIM_FORMAT": fimFormat,
        "RETICLE_MLX_PORT": String(port),
        "RETICLE_MLX_PROMPT_CACHE_SIZE": String(promptCacheSize),
        "RETICLE_MLX_PROMPT_CACHE_BYTES": String(promptCacheBytes),
      ]
    case .mtplx:
      [
        "MTPLX_MODEL": model,
        "MTPLX_PORT": String(port),
        "MTPLX_SKIP_DOWNLOAD": "1",
      ]
    }
  }

  var vscodeEnvironment: [String: String] {
    [
      "RETICLE_MLX_MODEL": requestModel,
      "RETICLE_MLX_API_MODEL": requestModel,
      "RETICLE_MLX_FIM_FORMAT": fimFormat,
      "RETICLE_MLX_PORT": String(port),
    ]
  }

  var vscodeSettings: String {
    """
    {
      "reticle.baseURL": "http://127.0.0.1:\(port)/v1",
      "reticle.model": "\(requestModel)",
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
    let savedRequestModel = defaults.string(forKey: "requestModel")
    if let format = defaults.string(forKey: "fimFormat"), !format.isEmpty {
      configuration.fimFormat = format
    }
    if let runtimeName = defaults.string(forKey: "runtime"),
      let runtime = ModelRuntime(rawValue: runtimeName)
    {
      configuration.runtime = runtime
    }
    if let savedRequestModel, !savedRequestModel.isEmpty {
      configuration.requestModel = savedRequestModel
    } else if configuration.runtime == .mtplx {
      configuration.requestModel =
        ModelPreset.suggested.first {
          $0.runtime == .mtplx && $0.model == configuration.model
        }?.requestModel ?? ModelPreset.qwen35MTPLX.requestModel
    } else {
      configuration.requestModel = "default_model"
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
    defaults.set(requestModel, forKey: "requestModel")
    defaults.set(fimFormat, forKey: "fimFormat")
    defaults.set(runtime.rawValue, forKey: "runtime")
    defaults.set(port, forKey: "port")
    defaults.set(promptCacheSize, forKey: "promptCacheSize")
    defaults.set(promptCacheBytes, forKey: "promptCacheBytes")
  }
}
