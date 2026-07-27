import ServiceManagement
import SwiftUI

struct SettingsView: View {
  @ObservedObject var controller: ServiceController

  @State private var selectedPresetID = ModelPreset.seedCoder.id
  @State private var model = ServiceConfiguration.defaults.model
  @State private var fimFormat = ServiceConfiguration.defaults.fimFormat
  @State private var port = String(ServiceConfiguration.defaults.port)
  @State private var cacheSize = String(ServiceConfiguration.defaults.promptCacheSize)
  @State private var cacheGigabytes = "4"
  @State private var launchAtLogin = SMAppService.mainApp.status == .enabled
  @State private var loginItemError = ""

  private var configuration: ServiceConfiguration {
    ServiceConfiguration(
      model: model.trimmingCharacters(in: .whitespacesAndNewlines),
      fimFormat: fimFormat,
      port: Int(port) ?? ServiceConfiguration.defaults.port,
      promptCacheSize: Int(cacheSize) ?? ServiceConfiguration.defaults.promptCacheSize,
      promptCacheBytes: (Int(cacheGigabytes) ?? 4) * 1_073_741_824
    )
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      HStack {
        Image(systemName: "scope")
          .font(.system(size: 32))
          .foregroundStyle(.indigo)
        VStack(alignment: .leading) {
          Text("Reticle MLX")
            .font(.title2.bold())
          Text("Local code completion models in your menu bar")
            .foregroundStyle(.secondary)
        }
        Spacer()
        Label(controller.state.title, systemImage: controller.state.symbolName)
          .foregroundStyle(controller.state == .healthy ? .green : .secondary)
      }

      Form {
        Picker("Model preset", selection: $selectedPresetID) {
          ForEach(ModelPreset.all) { preset in
            Text(preset.name).tag(preset.id)
          }
        }
        .onChange(of: selectedPresetID) { newValue in
          guard let preset = ModelPreset.all.first(where: { $0.id == newValue }),
            preset.id != ModelPreset.custom.id
          else { return }
          model = preset.model
          fimFormat = preset.fimFormat
        }

        Text(
          ModelPreset.all.first(where: { $0.id == selectedPresetID })?.note
            ?? ModelPreset.custom.note
        )
        .font(.caption)
        .foregroundStyle(.secondary)

        TextField("MLX model or local path", text: $model)

        Picker("FIM format", selection: $fimFormat) {
          Text("Seed suffix-prefix-middle").tag("seed")
          Text("Qwen prefix-suffix-middle").tag("qwen")
          Text("OpenAI prompt + suffix").tag("openai")
        }

        HStack {
          TextField("Port", text: $port)
            .frame(width: 90)
          TextField("Prompt caches", text: $cacheSize)
            .frame(width: 110)
          TextField("Cache limit (GB)", text: $cacheGigabytes)
            .frame(width: 125)
        }

        Toggle("Launch Reticle MLX at login", isOn: $launchAtLogin)
          .onChange(of: launchAtLogin) { enabled in
            updateLoginItem(enabled)
          }
      }
      .formStyle(.grouped)

      if !loginItemError.isEmpty {
        Text(loginItemError)
          .font(.caption)
          .foregroundStyle(.red)
      }

      HStack {
        Button(controller.state == .notInstalled ? "Install Model & Service" : "Apply & Restart") {
          Task { await controller.install(configuration) }
        }
        .buttonStyle(.borderedProminent)
        .disabled(controller.isBusy || configuration.model.isEmpty)

        Button("Copy VS Code Settings") {
          configuration.save()
          controller.copyVSCodeSettings(configuration)
        }
        .disabled(configuration.model.isEmpty)

        Button("Run Doctor") {
          Task { await controller.doctor() }
        }
        .disabled(controller.isBusy)
      }

      GroupBox("Activity") {
        ScrollView {
          Text(controller.output.isEmpty ? "No output yet." : controller.output)
            .font(.system(.caption, design: .monospaced))
            .frame(maxWidth: .infinity, alignment: .leading)
            .textSelection(.enabled)
            .padding(8)
        }
        .frame(minHeight: 120, maxHeight: 190)
      }
    }
    .padding(20)
    .frame(width: 620, height: 600)
    .onAppear {
      let saved = ServiceConfiguration.load()
      model = saved.model
      fimFormat = saved.fimFormat
      port = String(saved.port)
      cacheSize = String(saved.promptCacheSize)
      cacheGigabytes = String(max(1, saved.promptCacheBytes / 1_073_741_824))
      selectedPresetID =
        ModelPreset.all.first {
          $0.model == saved.model && $0.fimFormat == saved.fimFormat
        }?.id ?? ModelPreset.custom.id
      Task { await controller.refresh() }
    }
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
