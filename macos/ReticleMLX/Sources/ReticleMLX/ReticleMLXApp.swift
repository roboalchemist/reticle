import AppKit
import Combine
import SwiftUI

@main
enum ReticleMLXApp {
  static func main() {
    let application = NSApplication.shared
    let delegate = AppDelegate()
    application.delegate = delegate
    application.setActivationPolicy(.accessory)
    application.run()
  }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
  private let controller = ServiceController()
  private var statusItem: NSStatusItem?
  private var settingsWindow: NSWindow?
  private var timer: Timer?
  private var cancellables = Set<AnyCancellable>()

  func applicationDidFinishLaunching(_ notification: Notification) {
    let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
    item.button?.toolTip = "Reticle MLX"
    statusItem = item

    let menu = NSMenu()
    menu.delegate = self
    item.menu = menu

    controller.$state
      .sink { [weak self] state in
        self?.statusItem?.button?.image = NSImage(
          systemSymbolName: state.symbolName,
          accessibilityDescription: "Reticle MLX: \(state.title)"
        )
        self?.statusItem?.button?.image?.isTemplate = true
      }
      .store(in: &cancellables)

    Task { await controller.refresh() }
    timer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
      Task { @MainActor in
        await self?.controller.refresh()
      }
    }
    if let timer {
      RunLoop.main.add(timer, forMode: .common)
    }
  }

  func menuNeedsUpdate(_ menu: NSMenu) {
    menu.removeAllItems()
    menu.addItem(disabledItem("Reticle MLX", bold: true))
    menu.addItem(disabledItem("Status: \(controller.state.title)"))
    menu.addItem(disabledItem(shortModelName(controller.installedModel)))
    menu.addItem(.separator())

    if controller.state == .notInstalled {
      menu.addItem(actionItem("Install Model & Service…", #selector(openSettings)))
    } else {
      menu.addItem(actionItem("Start", #selector(startService), enabled: !controller.isBusy))
      menu.addItem(actionItem("Stop", #selector(stopService), enabled: !controller.isBusy))
      menu.addItem(actionItem("Restart", #selector(restartService), enabled: !controller.isBusy))
      menu.addItem(actionItem("Run Doctor", #selector(runDoctor), enabled: !controller.isBusy))
    }

    menu.addItem(.separator())
    menu.addItem(actionItem("Open Logs", #selector(openLogs)))
    menu.addItem(actionItem("Settings…", #selector(openSettings), key: ","))
    menu.addItem(actionItem("Reticle MLX on GitHub", #selector(openGitHub)))
    menu.addItem(.separator())
    menu.addItem(actionItem("Quit Reticle MLX", #selector(quit), key: "q"))
  }

  @objc private func startService() {
    Task { await controller.start() }
  }

  @objc private func stopService() {
    Task { await controller.stop() }
  }

  @objc private func restartService() {
    Task { await controller.restart() }
  }

  @objc private func runDoctor() {
    openSettings()
    Task { await controller.doctor() }
  }

  @objc private func openLogs() {
    controller.openLogs()
  }

  @objc private func openSettings() {
    if settingsWindow == nil {
      let window = NSWindow(
        contentRect: NSRect(x: 0, y: 0, width: 620, height: 600),
        styleMask: [.titled, .closable, .miniaturizable],
        backing: .buffered,
        defer: false
      )
      window.title = "Reticle MLX Settings"
      window.contentView = NSHostingView(rootView: SettingsView(controller: controller))
      window.isReleasedWhenClosed = false
      window.center()
      settingsWindow = window
    }
    settingsWindow?.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
  }

  @objc private func openGitHub() {
    NSWorkspace.shared.open(URL(string: "https://github.com/roboalchemist/reticle-mlx")!)
  }

  @objc private func quit() {
    NSApp.terminate(nil)
  }

  private func actionItem(
    _ title: String,
    _ action: Selector,
    enabled: Bool = true,
    key: String = ""
  ) -> NSMenuItem {
    let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
    item.target = self
    item.isEnabled = enabled
    return item
  }

  private func disabledItem(_ title: String, bold: Bool = false) -> NSMenuItem {
    let item = NSMenuItem(title: title, action: nil, keyEquivalent: "")
    item.isEnabled = false
    if bold {
      item.attributedTitle = NSAttributedString(
        string: title,
        attributes: [.font: NSFont.boldSystemFont(ofSize: NSFont.systemFontSize)]
      )
    }
    return item
  }

  private func shortModelName(_ model: String) -> String {
    let name = model.split(separator: "/").last.map(String.init) ?? model
    return name.count > 46 ? String(name.prefix(43)) + "…" : name
  }
}
