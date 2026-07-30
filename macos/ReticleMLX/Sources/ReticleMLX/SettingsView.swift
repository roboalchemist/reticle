import AppKit
import ServiceManagement
import SwiftUI

enum SettingsSection: String, CaseIterable, Identifiable {
  case general
  case models
  case customModel
  case benchmark
  case vscodeSetup
  case logs

  static let defaultSection = SettingsSection.general

  var id: String { rawValue }

  var title: String {
    switch self {
    case .general: "General"
    case .models: "Models"
    case .customModel: "Custom Model"
    case .benchmark: "Benchmark"
    case .vscodeSetup: "VS Code Setup"
    case .logs: "Logs"
    }
  }

  var symbolName: String {
    switch self {
    case .general: "gearshape"
    case .models: "shippingbox"
    case .customModel: "slider.horizontal.3"
    case .benchmark: "gauge.with.dots.needle.50percent"
    case .vscodeSetup: "chevron.left.forwardslash.chevron.right"
    case .logs: "doc.text.magnifyingglass"
    }
  }
}

struct SettingsView: View {
  static let activityDefaultHeight: CGFloat = 240

  @ObservedObject var controller: ServiceController
  @ObservedObject private var downloads: ModelDownloadController
  @StateObject private var benchmarks: BenchmarkController

  @State private var selectedSection = SettingsSection.defaultSection
  @State private var selectedPresetID = ModelPreset.seedCoder.id
  @State private var loadingPresetID: String?
  @State private var benchmarkPresetID = ModelPreset.seedCoder.id
  @State private var model = ServiceConfiguration.defaults.model
  @State private var requestModel = ServiceConfiguration.defaults.requestModel
  @State private var fimFormat = ServiceConfiguration.defaults.fimFormat
  @State private var runtime = ServiceConfiguration.defaults.runtime
  @State private var port = String(ServiceConfiguration.defaults.port)
  @State private var cacheSize = String(ServiceConfiguration.defaults.promptCacheSize)
  @State private var cacheGigabytes = "4"
  @State private var launchAtLogin = SMAppService.mainApp.status == .enabled
  @State private var loginItemError = ""

  init(controller: ServiceController) {
    self.controller = controller
    _downloads = ObservedObject(wrappedValue: controller.downloads)
    _benchmarks = StateObject(wrappedValue: BenchmarkController())
  }

  private var configuration: ServiceConfiguration {
    ServiceConfiguration(
      model: model.trimmingCharacters(in: .whitespacesAndNewlines),
      requestModel: requestModel.trimmingCharacters(in: .whitespacesAndNewlines),
      fimFormat: fimFormat,
      runtime: runtime,
      port: Int(port) ?? ServiceConfiguration.defaults.port,
      promptCacheSize: Int(cacheSize) ?? ServiceConfiguration.defaults.promptCacheSize,
      promptCacheBytes: (Int(cacheGigabytes) ?? 4) * 1_073_741_824
    )
  }

  var body: some View {
    HStack(spacing: 0) {
      sidebar
      Divider()
      detail
    }
    .frame(
      minWidth: 720,
      idealWidth: 980,
      maxWidth: .infinity,
      minHeight: 520,
      idealHeight: 720,
      maxHeight: .infinity
    )
    .onAppear {
      loadSavedConfiguration()
      Task {
        await controller.refresh()
        await controller.refreshModelDownloads()
      }
    }
  }

  private var sidebar: some View {
    VStack(spacing: 0) {
      HStack(spacing: 10) {
        BrandLogo(size: 36)
        VStack(alignment: .leading, spacing: 1) {
          Text("Reticle MLX")
            .font(.headline)
          Text("Local autocomplete")
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        Spacer()
      }
      .padding(.horizontal, 14)
      .padding(.vertical, 12)

      Divider()

      List(SettingsSection.allCases, selection: $selectedSection) { section in
        Label(section.title, systemImage: section.symbolName)
          .tag(section)
      }
      .listStyle(.sidebar)
      .accessibilityIdentifier("settings.sidebar")
    }
    .frame(minWidth: 180, idealWidth: 210, maxWidth: 240)
  }

  private var detail: some View {
    VSplitView {
      selectedPage
        .frame(minHeight: 260, maxHeight: .infinity)
        .layoutPriority(1)
      activitySection
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .frame(
          minHeight: 92,
          idealHeight: Self.activityDefaultHeight,
          maxHeight: .infinity
        )
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .accessibilityIdentifier("settings.activity-split")
  }

  @ViewBuilder
  private var selectedPage: some View {
    switch selectedSection {
    case .general:
      generalPage
    case .models:
      modelsPage
    case .customModel:
      customModelPage
    case .benchmark:
      benchmarkPage
    case .vscodeSetup:
      vscodeSetupPage
    case .logs:
      logsPage
    }
  }

  private func pageHeader(_ title: String, subtitle: String) -> some View {
    HStack(alignment: .top, spacing: 12) {
      VStack(alignment: .leading, spacing: 3) {
        Text(title)
          .font(.title2.bold())
        Text(subtitle)
          .foregroundStyle(.secondary)
      }
      Spacer()
      Label(controller.state.title, systemImage: controller.state.symbolName)
        .foregroundStyle(
          controller.state == .healthy ? Color.green
            : controller.state == .unhealthy ? Color.orange : Color.secondary
        )
    }
  }

  private var generalPage: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 16) {
        pageHeader(
          "General",
          subtitle: "Manage the active model service, runtime, and startup behavior"
        )
        currentModelSection
        runtimeSection
        startupSection
        serviceSection
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(20)
    }
    .scrollIndicators(.automatic)
    .accessibilityIdentifier("settings.general")
  }

  private var currentModelSection: some View {
    let preset =
      ModelPreset.all.first(where: { $0.id == selectedPresetID }) ?? ModelPreset.custom

    return GroupBox("Current Model") {
      HStack(alignment: .center, spacing: 14) {
        VStack(alignment: .leading, spacing: 4) {
          Text(preset.name)
            .font(.headline)
          Text(
            selectedPresetID == ModelPreset.custom.id && !model.isEmpty
              ? model : preset.tagline
          )
          .font(.caption)
          .foregroundStyle(.secondary)
          Text("\(runtime.displayName) · \(fimFormat) FIM · port \(port)")
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
        Spacer()
        Button("Browse Models") {
          selectedSection = .models
        }
        Button("Custom Model") {
          selectedSection = .customModel
        }
      }
      .padding(.top, 4)
    }
  }

  private var modelsPage: some View {
    VStack(alignment: .leading, spacing: 12) {
      pageHeader(
        "Models",
        subtitle: "Compare, download, and select validated fill-in-the-middle models"
      )

      ScrollView {
        LazyVStack(alignment: .leading, spacing: 10) {
          ForEach(ModelPreset.suggested) { preset in
            modelCard(preset)
          }
        }
        .padding(.vertical, 2)
      }
      .scrollIndicators(.visible)
    }
    .padding(20)
    .accessibilityIdentifier("settings.models")
  }

  private var customModelPage: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 16) {
        pageHeader(
          "Custom Model",
          subtitle: "Configure an advanced MLX-LM model or local model directory"
        )

        GroupBox("Model") {
          VStack(alignment: .leading, spacing: 10) {
            TextField("Hugging Face model ID or local MLX path", text: $model)
              .onChange(of: model) { _ in
                if !ModelPreset.suggested.contains(where: { $0.model == model }) {
                  selectCustomModel()
                }
              }
            Picker("FIM format", selection: $fimFormat) {
              Text("Codestral").tag("codestral")
              Text("OpenAI suffix").tag("openai")
              Text("Qwen PSM").tag("qwen")
              Text("Seed SPM").tag("seed")
            }
            .pickerStyle(.segmented)
            Text(ModelPreset.custom.summary)
              .font(.caption)
              .foregroundStyle(.secondary)

            HStack {
              Button(
                selectedPresetID == ModelPreset.custom.id
                  ? "Custom Model Selected" : "Use Custom Model"
              ) {
                selectCustomModel()
              }
              .buttonStyle(.borderedProminent)
              .disabled(model.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
              Spacer()
              Text("Custom models run through MLX-LM")
                .font(.caption)
                .foregroundStyle(.secondary)
            }
          }
          .padding(.top, 4)
        }

        runtimeSection
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(20)
    }
    .scrollIndicators(.automatic)
    .accessibilityIdentifier("settings.custom-model")
  }

  private var vscodeSetupPage: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 16) {
        pageHeader(
          "VS Code Setup",
          subtitle: "Install Reticle, validate the connection, and copy the active settings"
        )

        GroupBox("Extension") {
          VStack(alignment: .leading, spacing: 10) {
            Text(
              "Install or update Reticle from the VS Code Marketplace, then run a complete extension, settings, endpoint, and FIM check."
            )
            .font(.caption)
            .foregroundStyle(.secondary)
            HStack(spacing: 9) {
              Button("Install VS Code Extension") {
                Task { await controller.installVSCodeExtension() }
              }
              .buttonStyle(.borderedProminent)
              .disabled(controller.isBusy)

              Button("VS Code Doctor") {
                Task { await controller.vscodeDoctor(configuration) }
              }
              .disabled(controller.isBusy || downloads.isBusy)
            }
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(.top, 4)
        }

        GroupBox("Active VS Code Settings") {
          VStack(alignment: .leading, spacing: 10) {
            Text(configuration.vscodeSettings)
              .font(.system(.caption, design: .monospaced))
              .textSelection(.enabled)
              .frame(maxWidth: .infinity, alignment: .leading)
              .padding(10)
              .background(
                RoundedRectangle(cornerRadius: 7)
                  .fill(Color(nsColor: .textBackgroundColor))
              )
            Button("Copy VS Code Settings") {
              configuration.save()
              controller.copyVSCodeSettings(configuration)
            }
            .disabled(configuration.model.isEmpty)
          }
          .padding(.top, 4)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(20)
    }
    .scrollIndicators(.automatic)
    .accessibilityIdentifier("settings.vscode-setup")
  }

  private var benchmarkPage: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 16) {
        pageHeader(
          "Benchmark",
          subtitle: "Compare real fill-in-the-middle latency and completion throughput"
        )

        GroupBox("Run Benchmark") {
          VStack(alignment: .leading, spacing: 10) {
            Picker("Model", selection: $benchmarkPresetID) {
              ForEach(ModelPreset.suggested) { preset in
                Text(preset.name).tag(preset.id)
              }
            }

            HStack(spacing: 9) {
              Button("Start Model & Benchmark") {
                Task { await runBenchmark() }
              }
              .buttonStyle(.borderedProminent)
              .disabled(
                benchmarks.isRunning || controller.isBusy || selectedBenchmarkPreset == nil
                  || !downloads.isDownloadedPresetOrCustom(benchmarkPresetID)
              )

              Button("Copy Results") {
                benchmarks.copyResults()
              }
              .disabled(benchmarks.results.isEmpty)

              Button("Export TSV…") {
                benchmarks.exportResults()
              }
              .disabled(benchmarks.results.isEmpty)

              if benchmarks.isRunning {
                ProgressView()
                  .controlSize(.small)
              }
            }

            Text(
              "Starting a different model changes the active Reticle service. Cold is a new prompt-cache session; warm is the median of three repeated requests."
            )
            .font(.caption)
            .foregroundStyle(.secondary)

            Text(benchmarks.status)
              .font(.caption.monospaced())
              .foregroundStyle(benchmarks.status.hasPrefix("Benchmark failed") ? .red : .secondary)
              .textSelection(.enabled)
          }
          .padding(.top, 4)
        }

        GroupBox("Results") {
          if benchmarks.results.isEmpty {
            VStack(spacing: 8) {
              Image(systemName: "gauge.with.dots.needle.50percent")
                .font(.title)
                .foregroundStyle(.secondary)
              Text("No Benchmark Results")
                .font(.headline)
              Text("Choose a downloaded model and run the benchmark.")
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, minHeight: 150)
          } else {
            ScrollView(.horizontal) {
              Grid(alignment: .leading, horizontalSpacing: 20, verticalSpacing: 9) {
                GridRow {
                  benchmarkHeader("Model")
                  benchmarkHeader("Runtime")
                  benchmarkHeader("TTFT")
                  benchmarkHeader("Cold total")
                  benchmarkHeader("Warm total")
                  benchmarkHeader("Completion")
                }
                Divider()
                  .gridCellUnsizedAxes(.horizontal)
                ForEach(benchmarks.results) { result in
                  GridRow {
                    Text(result.modelName)
                    Text(result.runtime)
                    benchmarkValue(result.ttftMilliseconds, suffix: "ms")
                    benchmarkValue(result.coldMilliseconds, suffix: "ms")
                    benchmarkValue(result.warmMilliseconds, suffix: "ms")
                    Text(
                      "\(String(format: "%.1f", result.completionTokensPerSecond)) tok/s\(result.tokenRateIsEstimated ? "*" : "")"
                    )
                    .font(.system(.caption, design: .monospaced))
                  }
                }
              }
              .padding(.vertical, 6)
            }
          }

          Text("* Token rate is estimated when the server does not report completion-token usage.")
            .font(.caption2)
            .foregroundStyle(.secondary)
            .padding(.top, 6)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(20)
    }
    .scrollIndicators(.automatic)
    .accessibilityIdentifier("settings.benchmark")
  }

  private var runtimeSection: some View {
    GroupBox("Runtime") {
      HStack(alignment: .top, spacing: 16) {
        RuntimeField(
          title: "Server port",
          help: "Loopback port used by \(runtime.displayName) and VS Code",
          value: $port
        )
        RuntimeField(
          title: "Prompt caches",
          help: runtime == .mtplx
            ? "MTPLX manages its persistent session cache" : "Editor sessions retained",
          enabled: runtime != .mtplx,
          value: $cacheSize
        )
        RuntimeField(
          title: "Cache limit (GB)",
          help: runtime == .mtplx
            ? "Managed automatically by MTPLX" : "Maximum combined KV-cache memory",
          enabled: runtime != .mtplx,
          value: $cacheGigabytes
        )
      }
      .padding(.top, 4)
    }
  }

  private var startupSection: some View {
    GroupBox("Startup") {
      Toggle("Launch Reticle MLX at login", isOn: $launchAtLogin)
        .padding(.top, 4)
        .onChange(of: launchAtLogin) { enabled in
          updateLoginItem(enabled)
        }

      if !loginItemError.isEmpty {
        Text(loginItemError)
          .font(.caption)
          .foregroundStyle(.red)
      }
    }
  }

  private var logsPage: some View {
    VStack(alignment: .leading, spacing: 12) {
      pageHeader(
        "Logs",
        subtitle: "Inspect, copy, and export service diagnostics"
      )

      HStack(spacing: 9) {
        Button("Refresh Logs") {
          Task { await controller.refreshLogs() }
        }
        .buttonStyle(.borderedProminent)
        .disabled(controller.isLoadingLogs)

        Button("Run Service Doctor") {
          Task { await controller.doctor() }
        }
        .disabled(controller.isBusy)

        Button("Copy All") {
          controller.copyLogs()
        }
        .disabled(controller.logOutput.isEmpty)

        Button("Export…") {
          controller.exportLogs()
        }
        .disabled(controller.logOutput.isEmpty)

        Button("Open Folder") {
          controller.openLogs()
        }
      }

      HStack {
        Label(controller.installedRuntime.displayName, systemImage: "server.rack")
        Text(controller.logDirectory)
          .font(.caption.monospaced())
          .foregroundStyle(.secondary)
          .textSelection(.enabled)
        Spacer()
        if controller.isLoadingLogs {
          ProgressView()
            .controlSize(.small)
        }
      }

      ScrollView([.horizontal, .vertical]) {
        Text(controller.logOutput.isEmpty ? "No logs loaded." : controller.logOutput)
          .font(.system(.caption, design: .monospaced))
          .frame(maxWidth: .infinity, alignment: .leading)
          .textSelection(.enabled)
          .padding(10)
      }
      .background(
        RoundedRectangle(cornerRadius: 7)
          .fill(Color(nsColor: .textBackgroundColor))
      )
    }
    .padding(20)
    .accessibilityIdentifier("settings.logs")
    .task(id: controller.installedRuntime) {
      await controller.refreshLogs()
    }
  }

  private var selectedBenchmarkPreset: ModelPreset? {
    ModelPreset.suggested.first { $0.id == benchmarkPresetID }
  }

  private func runBenchmark() async {
    guard let preset = selectedBenchmarkPreset else { return }
    let benchmarkConfiguration = ServiceConfiguration(
      model: preset.model,
      requestModel: preset.requestModel,
      fimFormat: preset.fimFormat,
      runtime: preset.runtime,
      port: preset.defaultPort,
      promptCacheSize: Int(cacheSize) ?? ServiceConfiguration.defaults.promptCacheSize,
      promptCacheBytes: (Int(cacheGigabytes) ?? 4) * 1_073_741_824
    )
    select(preset)
    await controller.install(benchmarkConfiguration)
    guard controller.state == .healthy else { return }
    await benchmarks.run(configuration: benchmarkConfiguration, modelName: preset.name)
  }

  private func benchmarkHeader(_ title: String) -> some View {
    Text(title)
      .font(.caption.bold())
      .foregroundStyle(.secondary)
  }

  private func benchmarkValue(_ value: Double, suffix: String) -> some View {
    Text("\(String(format: "%.1f", value)) \(suffix)")
      .font(.system(.caption, design: .monospaced))
  }

  private var serviceSection: some View {
    GroupBox("Service") {
      HStack(spacing: 9) {
        Button(controller.state == .notInstalled ? "Install & Start Service" : "Apply & Restart") {
          Task { await controller.install(configuration) }
        }
        .buttonStyle(.borderedProminent)
        .disabled(
          controller.isBusy || downloads.isBusy || configuration.model.isEmpty
            || !downloads.isDownloadedPresetOrCustom(selectedPresetID)
        )

        Button("Service Doctor") {
          Task { await controller.doctor() }
        }
        .disabled(controller.isBusy || downloads.isBusy)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.top, 4)
    }
  }

  private var activitySection: some View {
    GroupBox("Activity") {
      ScrollView(.vertical, showsIndicators: false) {
        Text(activityText)
          .font(.system(.caption, design: .monospaced))
          .frame(maxWidth: .infinity, alignment: .leading)
          .textSelection(.enabled)
          .padding(.vertical, 4)
      }
      .frame(maxHeight: .infinity)
    }
  }

  private var activityText: String {
    if downloads.isBusy || downloads.active?.phase == .failed {
      let status = downloads.active.map(downloadStatus) ?? ""
      if downloads.output.isEmpty {
        return status
      }
      return "\(status)\n\(downloads.output)"
    }
    return controller.output.isEmpty ? "No activity yet." : controller.output
  }

  private func selectCustomModel() {
    selectedPresetID = ModelPreset.custom.id
    requestModel = ModelPreset.custom.requestModel
    runtime = ModelPreset.custom.runtime
  }

  private func modelCard(_ preset: ModelPreset) -> some View {
    let selected = selectedPresetID == preset.id
    let downloaded = downloads.isDownloaded(preset)
    let active = downloads.active?.modelID == preset.id ? downloads.active : nil
    let loading = loadingPresetID == preset.id

    return ModelCardView(
      preset: preset,
      selected: selected,
      downloaded: downloaded,
      loading: loading,
      active: active,
      downloadDisabled: downloaded || downloads.isBusy || controller.isBusy,
      onDownload: { controller.download(preset) },
      selectionDisabled: !downloaded || downloads.isBusy || controller.isBusy
        || loadingPresetID != nil,
      onSelect: {
        Task {
          await activate(preset)
        }
      },
      onPause: { downloads.pause() },
      onResume: { downloads.resume() },
      onCancel: { downloads.cancel() },
      statusText: active.map(downloadStatus) ?? ""
    )
  }

  private func activate(_ preset: ModelPreset) async {
    guard downloads.isDownloaded(preset), loadingPresetID == nil else { return }
    loadingPresetID = preset.id
    defer { loadingPresetID = nil }

    let target = configuration(for: preset)
    await controller.install(target)
    guard controller.state == .healthy else { return }
    select(preset)
  }

  private func configuration(for preset: ModelPreset) -> ServiceConfiguration {
    ServiceConfiguration(
      model: preset.model,
      requestModel: preset.requestModel,
      fimFormat: preset.fimFormat,
      runtime: preset.runtime,
      port: preset.defaultPort,
      promptCacheSize: Int(cacheSize) ?? ServiceConfiguration.defaults.promptCacheSize,
      promptCacheBytes: (Int(cacheGigabytes) ?? 4) * 1_073_741_824
    )
  }

  private func select(_ preset: ModelPreset) {
    selectedPresetID = preset.id
    model = preset.model
    requestModel = preset.requestModel
    fimFormat = preset.fimFormat
    runtime = preset.runtime
    port = String(preset.defaultPort)
  }

  private func downloadStatus(_ progress: ModelDownloadProgress) -> String {
    switch progress.phase {
    case .preparing:
      return progress.currentFile
    case .downloading, .paused, .cancelling:
      var pieces = [
        "\(ByteCountFormatter.string(fromByteCount: progress.downloadedBytes, countStyle: .file)) of \(ByteCountFormatter.string(fromByteCount: progress.totalBytes, countStyle: .file))"
      ]
      if progress.bytesPerSecond > 0 {
        pieces.append(
          "\(ByteCountFormatter.string(fromByteCount: Int64(progress.bytesPerSecond), countStyle: .file))/s"
        )
      }
      if let eta = progress.etaSeconds {
        pieces.append("\(formatDuration(eta)) remaining")
      }
      if progress.phase == .paused {
        pieces.append("Paused")
      } else if progress.phase == .cancelling {
        pieces.append("Cancelling…")
      }
      return pieces.joined(separator: " · ")
    case .completed:
      return "Download complete"
    case .cancelled:
      return "Download cancelled. Completed files were preserved."
    case .failed:
      return progress.error ?? "Download failed"
    }
  }

  private func formatDuration(_ seconds: TimeInterval) -> String {
    let total = max(0, Int(seconds.rounded()))
    if total >= 60 {
      return "\(total / 60)m \(total % 60)s"
    }
    return "\(total)s"
  }

  private func loadSavedConfiguration() {
    let saved = ServiceConfiguration.load()
    model = saved.model
    requestModel = saved.requestModel
    fimFormat = saved.fimFormat
    runtime = saved.runtime
    port = String(saved.port)
    cacheSize = String(saved.promptCacheSize)
    cacheGigabytes = String(max(1, saved.promptCacheBytes / 1_073_741_824))
    selectedPresetID =
      ModelPreset.suggested.first {
        $0.model == saved.model && $0.fimFormat == saved.fimFormat && $0.runtime == saved.runtime
      }?.id ?? ModelPreset.custom.id
  }

  private func updateLoginItem(_ enabled: Bool) {
    do {
      if enabled {
        try SMAppService.mainApp.register()
      } else {
        try SMAppService.mainApp.unregister()
      }
      loginItemError = ""
    } catch {
      loginItemError = "Could not update Login Items: \(error.localizedDescription)"
      launchAtLogin = SMAppService.mainApp.status == .enabled
    }
  }
}

private struct BrandLogo: View {
  let size: CGFloat

  var body: some View {
    Group {
      if let url = Bundle.main.url(forResource: "AppLogo", withExtension: "png"),
        let image = NSImage(contentsOf: url)
      {
        Image(nsImage: image)
          .resizable()
          .interpolation(.high)
      } else {
        Color.clear
      }
    }
    .frame(width: size, height: size)
    .accessibilityLabel("Reticle MLX")
  }
}

private struct ModelCardView: View {
  let preset: ModelPreset
  let selected: Bool
  let downloaded: Bool
  let loading: Bool
  let active: ModelDownloadProgress?
  let downloadDisabled: Bool
  let onDownload: () -> Void
  let selectionDisabled: Bool
  let onSelect: () -> Void
  let onPause: () -> Void
  let onResume: () -> Void
  let onCancel: () -> Void
  let statusText: String

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .top, spacing: 12) {
        title
          .layoutPriority(1)
        Spacer(minLength: 8)
        actions
          .fixedSize(horizontal: true, vertical: false)
      }

      metadata

      Text(preset.summary)
        .font(.caption)
        .foregroundStyle(.secondary)
        .lineLimit(2)
        .fixedSize(horizontal: false, vertical: true)

      HStack(spacing: 14) {
        ModelScore(label: "Quality", score: preset.qualityScore)
        ModelScore(label: "Speed", score: preset.speedScore)
        ModelScore(label: "Low memory", score: preset.memoryScore)
      }

      if let active {
        progress(active)
      }
    }
    .padding(11)
    .background(
      RoundedRectangle(cornerRadius: 10)
        .fill(selected ? Color.indigo.opacity(0.08) : Color(nsColor: .controlBackgroundColor))
    )
    .overlay(
      RoundedRectangle(cornerRadius: 10)
        .stroke(selected ? Color.indigo.opacity(0.75) : Color.secondary.opacity(0.18), lineWidth: 1)
    )
  }

  private var title: some View {
    HStack(spacing: 7) {
      Text(preset.name)
        .font(.headline)
      if let badge = preset.badge {
        Text(badge)
          .font(.caption2.bold())
          .padding(.horizontal, 7)
          .padding(.vertical, 2)
          .foregroundStyle(selected ? Color.white : Color.indigo)
          .background(Capsule().fill(selected ? Color.indigo : Color.indigo.opacity(0.12)))
      }
    }
  }

  private var metadata: some View {
    Text(
      "\(preset.tagline) · \(preset.formattedDownloadSize) · \(preset.minimumMemoryGB)+ GB memory · \(preset.runtime.displayName)"
    )
    .font(.subheadline.weight(.medium))
    .foregroundStyle(.secondary)
    .fixedSize(horizontal: false, vertical: true)
  }

  private var actions: some View {
    HStack(spacing: 8) {
      Button(downloaded ? "Downloaded" : "Download", action: onDownload)
        .disabled(downloadDisabled)
      if loading {
        Button("Loading…") {}
          .buttonStyle(.borderedProminent)
          .disabled(true)
      } else if selected {
        Button("Selected") {}
          .buttonStyle(.borderedProminent)
          .disabled(true)
      } else {
        Button("Select", action: onSelect)
          .buttonStyle(.bordered)
          .disabled(selectionDisabled)
      }
    }
  }

  private func progress(_ progress: ModelDownloadProgress) -> some View {
    VStack(alignment: .leading, spacing: 5) {
      if progress.phase == .preparing {
        ProgressView()
          .controlSize(.small)
      } else {
        ProgressView(value: progress.fractionCompleted)
          .progressViewStyle(.linear)
      }

      HStack(spacing: 8) {
        Text(statusText)
          .font(.caption)
          .foregroundStyle(progress.phase == .failed ? .red : .secondary)
          .lineLimit(1)
        Spacer()
        if progress.canPause {
          Button("Pause", action: onPause)
            .controlSize(.small)
        } else if progress.canResume {
          Button("Resume", action: onResume)
            .controlSize(.small)
        }
        if progress.canCancel {
          Button("Cancel", role: .destructive, action: onCancel)
            .controlSize(.small)
        }
      }
    }
  }
}

private struct ModelScore: View {
  let label: String
  let score: Int

  var body: some View {
    HStack(spacing: 4) {
      Text(label)
        .font(.caption2)
        .foregroundStyle(.secondary)
      HStack(spacing: 2) {
        ForEach(1...5, id: \.self) { value in
          Circle()
            .fill(value <= score ? Color.indigo : Color.secondary.opacity(0.2))
            .frame(width: 5, height: 5)
        }
      }
    }
    .accessibilityLabel("\(label) \(score) out of 5")
  }
}

private struct RuntimeField: View {
  let title: String
  let help: String
  var enabled = true
  @Binding var value: String

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(title)
        .font(.subheadline.weight(.medium))
      TextField(title, text: $value)
        .textFieldStyle(.roundedBorder)
        .frame(maxWidth: .infinity)
        .disabled(!enabled)
      Text(help)
        .font(.caption2)
        .foregroundStyle(.secondary)
        .fixedSize(horizontal: false, vertical: true)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

extension ModelDownloadController {
  fileprivate func isDownloadedPresetOrCustom(_ presetID: String) -> Bool {
    presetID == ModelPreset.custom.id || downloadedModelIDs.contains(presetID)
  }
}
