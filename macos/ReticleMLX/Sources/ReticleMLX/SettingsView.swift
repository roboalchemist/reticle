import AppKit
import ServiceManagement
import SwiftUI

struct SettingsView: View {
  @ObservedObject var controller: ServiceController
  @ObservedObject private var downloads: ModelDownloadController

  @State private var selectedPresetID = ModelPreset.seedCoder.id
  @State private var model = ServiceConfiguration.defaults.model
  @State private var requestModel = ServiceConfiguration.defaults.requestModel
  @State private var fimFormat = ServiceConfiguration.defaults.fimFormat
  @State private var runtime = ServiceConfiguration.defaults.runtime
  @State private var port = String(ServiceConfiguration.defaults.port)
  @State private var cacheSize = String(ServiceConfiguration.defaults.promptCacheSize)
  @State private var cacheGigabytes = "4"
  @State private var launchAtLogin = SMAppService.mainApp.status == .enabled
  @State private var loginItemError = ""
  @State private var showCustomModel = false

  init(controller: ServiceController) {
    self.controller = controller
    _downloads = ObservedObject(wrappedValue: controller.downloads)
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
    VStack(alignment: .leading, spacing: 14) {
      header
      modelList
      customModelSection
      runtimeSection
      integrationSection
      activitySection
    }
    .padding(22)
    .frame(minWidth: 860, idealWidth: 920, maxWidth: .infinity)
    .frame(minHeight: 980, idealHeight: 1_080, maxHeight: .infinity)
    .onAppear {
      loadSavedConfiguration()
      Task {
        await controller.refresh()
        await controller.refreshModelDownloads()
      }
    }
  }

  private var header: some View {
    HStack(spacing: 12) {
      BrandLogo(size: 48)
      VStack(alignment: .leading, spacing: 2) {
        Text("Reticle MLX")
          .font(.title2.bold())
        Text("Choose, download, and run local models with MLX-LM or MTPLX")
          .foregroundStyle(.secondary)
      }
      Spacer()
      Label(controller.state.title, systemImage: controller.state.symbolName)
        .foregroundStyle(controller.state == .healthy ? .green : .secondary)
    }
  }

  private var modelList: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .firstTextBaseline) {
        Text("Models")
          .font(.headline)
        Text("Measured and validated for fill-in-the-middle completion")
          .font(.caption)
          .foregroundStyle(.secondary)
        Spacer()
      }

      ForEach(ModelPreset.suggested) { preset in
        modelCard(preset)
      }
    }
  }

  private func modelCard(_ preset: ModelPreset) -> some View {
    let selected = selectedPresetID == preset.id
    let downloaded = downloads.isDownloaded(preset)
    let active = downloads.active?.modelID == preset.id ? downloads.active : nil

    return ModelCardView(
      preset: preset,
      selected: selected,
      downloaded: downloaded,
      active: active,
      downloadDisabled: downloaded || downloads.isBusy || controller.isBusy,
      onDownload: { controller.download(preset) },
      onSelect: { select(preset) },
      onPause: { downloads.pause() },
      onResume: { downloads.resume() },
      onCancel: { downloads.cancel() },
      statusText: active.map(downloadStatus) ?? ""
    )
  }

  private var customModelSection: some View {
    DisclosureGroup("Custom model", isExpanded: $showCustomModel) {
      VStack(alignment: .leading, spacing: 8) {
        TextField("Hugging Face model ID or local MLX path", text: $model)
          .onChange(of: model) { _ in
            if !ModelPreset.suggested.contains(where: { $0.model == model }) {
              selectedPresetID = ModelPreset.custom.id
              requestModel = "default_model"
              runtime = .mlxLM
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
      }
      .padding(.top, 8)
    }
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

      Toggle("Launch Reticle MLX at login", isOn: $launchAtLogin)
        .padding(.top, 8)
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

  private var integrationSection: some View {
    GroupBox("Service & VS Code") {
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

        Divider().frame(height: 20)

        Button("Install VS Code Extension") {
          Task { await controller.installVSCodeExtension() }
        }
        .disabled(controller.isBusy)

        Button("VS Code Doctor") {
          Task { await controller.vscodeDoctor(configuration) }
        }
        .disabled(controller.isBusy || downloads.isBusy)

        Button("Copy VS Code Settings") {
          configuration.save()
          controller.copyVSCodeSettings(configuration)
        }
        .disabled(configuration.model.isEmpty)
      }
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
      .frame(minHeight: 72, maxHeight: 100)
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

  private func select(_ preset: ModelPreset) {
    selectedPresetID = preset.id
    model = preset.model
    requestModel = preset.requestModel
    fimFormat = preset.fimFormat
    runtime = preset.runtime
    port = String(preset.defaultPort)
    showCustomModel = false
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
    showCustomModel = selectedPresetID == ModelPreset.custom.id
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
  let active: ModelDownloadProgress?
  let downloadDisabled: Bool
  let onDownload: () -> Void
  let onSelect: () -> Void
  let onPause: () -> Void
  let onResume: () -> Void
  let onCancel: () -> Void
  let statusText: String

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .top, spacing: 12) {
        description
        Spacer(minLength: 12)
        actions
      }

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

  private var description: some View {
    VStack(alignment: .leading, spacing: 3) {
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
        if downloaded {
          Label("Downloaded", systemImage: "checkmark.circle.fill")
            .font(.caption)
            .foregroundStyle(.green)
        }
      }
      Text(preset.tagline)
        .font(.subheadline.weight(.medium))
      Text(preset.summary)
        .font(.caption)
        .foregroundStyle(.secondary)
        .lineLimit(2)
        .fixedSize(horizontal: false, vertical: true)
    }
  }

  private var actions: some View {
    VStack(alignment: .trailing, spacing: 7) {
      HStack(spacing: 8) {
        Button(downloaded ? "Downloaded" : "Download", action: onDownload)
          .disabled(downloadDisabled)
        if selected {
          Button("Selected") {}
            .buttonStyle(.borderedProminent)
            .disabled(true)
        } else {
          Button("Select", action: onSelect)
            .buttonStyle(.bordered)
        }
      }
      Text("\(preset.formattedDownloadSize) · \(preset.minimumMemoryGB)+ GB memory")
        .font(.caption2)
        .foregroundStyle(.secondary)
      Text(preset.runtime.displayName)
        .font(.caption2.weight(.medium))
        .foregroundStyle(preset.runtime == .mtplx ? Color.orange : Color.secondary)
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
