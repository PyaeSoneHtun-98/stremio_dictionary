// CI helper for the macOS beta (Issue #53). Prints JSON describing on-screen windows owned by
// the given process IDs, using only owner/bounds metadata (no Screen Recording permission).
// Usage: macos-window-probe <pid> [<pid> ...]
import CoreGraphics
import Foundation

let pids = Set(CommandLine.arguments.dropFirst().compactMap { Int32($0) })
let windows = (CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]]) ?? []

var result: [[String: Any]] = []
for window in windows {
  guard let pid = window[kCGWindowOwnerPID as String] as? Int32, pids.contains(pid) else { continue }
  let bounds = window[kCGWindowBounds as String] as? [String: Any] ?? [:]
  result.append([
    "pid": pid,
    "id": window[kCGWindowNumber as String] as? Int ?? 0,
    "layer": window[kCGWindowLayer as String] as? Int ?? 0,
    "x": bounds["X"] as? Double ?? 0,
    "y": bounds["Y"] as? Double ?? 0,
    "width": bounds["Width"] as? Double ?? 0,
    "height": bounds["Height"] as? Double ?? 0,
  ])
}

let data = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
print(String(data: data, encoding: .utf8)!)
