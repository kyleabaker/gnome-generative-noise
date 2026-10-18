# Architecture Overview: GNOME Generative Noise

This document outlines the architectural design, system interactions, process lifecycle management, and core subsystems of the **Generative Noise** GNOME Shell extension.

---

## 1. System Architecture & Core Philosophy

The extension is engineered around three core principles:

1. **Zero-Asset Procedural Synthesis:** No pre-recorded audio files (.mp3, .ogg) are stored on disk. All acoustic output is computed dynamically in real time via mathematical oscillators.
2. **Process Isolation & Security:** Audio generation runs in an isolated, non-privileged background process supervised via `Gio.Subprocess`, preventing any blocking operations on the GNOME Shell main event loop.
3. **Strict Memory & Signal Hygiene:** Every GSettings signal, D-Bus proxy watcher, and child process handle is explicitly registered and unbound during extension teardown (`disable()`), ensuring absolute zero memory leaks or zombie processes.

---

## 2. File Component Breakdown

The extension repository structure is organized as follows:

`text
gnome-generative-noise@kyleabaker.github.com/
├── metadata.json                                          # Extension manifest & GNOME version targets
├── extension.js                                           # Main runtime entry point, Quick Settings UI, and process watchdogs
├── prefs.js                                               # Libadwaita preferences configuration window
├── stylesheet.css                                         # HIG-compliant styling for Quick Settings menu items
├── icons/                                                 # Scalable SVG icon assets for multiple status icon styles
└── schemas/
    └── org.gnome.shell.extensions.com.github.kyleabaker.gnome-generative-noise.gschema.xml # Persistent user settings schema
`

---

## 3. Subsystem Architecture

### A. Procedural Audio Engine (GStreamer Pipeline)

Instead of looping static buffers, the extension invokes GStreamer's mathematical sound source generator (`audiotestsrc`) piped directly into local audio hardware (`autoaudiosink`).

- **Pipeline Structure:**
  `bash
gst-launch-1.0 audiotestsrc wave=<profile> ! volume volume=<level> ! autoaudiosink
`
- **Supported Profiles (Mapped via GStreamer Wave types):**
  - `white-noise` -> Equal energy per frequency (Bright hiss)
  - `pink-noise` -> Equal energy per octave (Balanced rain)
  - `red-noise` -> Brownian motion drop-off (Deep rumble)
  - `blue-noise` -> High-frequency boosted hiss
  - `gaussian-noise` -> Pure statistical static
  - `sine` -> Clean fundamental tone (440Hz)
  - `square` -> Sharp square wave buzz
  - `saw` -> Rich harmonic sawtooth sweep
  - `triangle` -> Mellow rounded triangle tone
  - `ticks` -> Steady rhythmic pulse

All profile type identifiers are validated against a compile-time whitelist (`VALID_NOISE_TYPES`) before being interpolated into the process argument vector.

### B. Quick Settings Integration

The extension integrates natively into the GNOME Shell Quick Settings panel using two GObject-registered classes:

- **`GenerativeNoiseIndicator` (SystemIndicator):** Manages the top panel status tray icon (visible only during active playback) and instantiates the toggle widget. Registered via `Main.panel.statusArea.quickSettings.addExternalIndicator()`.
- **`GenerativeNoiseToggle` (QuickMenuToggle):** A toggle button with an attached dropdown submenu. Clicking the toggle starts or stops playback. The submenu lists all available profiles with a checkmark on the active selection. The submenu header icon is also interactive, providing an additional playback toggle surface.
- **Customizable Icons:** Users can select from multiple SVG icon styles (`medium-sharp`, `medium-wave`, `compact-sharp`, `compact-wave`, `solid-sharp`, `solid-centered`, or `default`) via GSettings. Icons are resolved from the extension bundle with fallback to a system theme icon.

### C. Process Supervision & Watchdogs

To guarantee system stability, background processes are managed robustly:

- **Secure Spawning:** Utilizes `Gio.Subprocess` with array-based argument vectors rather than raw shell string evaluation, providing immunity to command injection vulnerabilities. Volume values are formatted with `toFixed(4)` to prevent floating-point precision artifacts from reaching the GStreamer property parser.
- **Automatic Child Reaping:** `Gio.Subprocess.wait_async()` monitors the spawned process asynchronously. When the audio process exits (whether intentionally or due to a crash), the callback resets the panel UI state and clears internal references, preventing both UI desynchronization and zombie process accumulation.
- **Stale Callback Guard:** When switching profiles during active playback, a new subprocess replaces the previous one. An identity comparison (`this._subprocess === activeSubprocess`) ensures that only the callback for the currently active subprocess updates UI state — stale callbacks from replaced subprocesses are silently discarded.
- **Direct Signal Delivery:** Process termination uses `Gio.Subprocess.send_signal(15)` (SIGTERM) directly, avoiding the overhead and fragility of spawning a transient `kill` process.

### D. Suspend & Resume Intelligence

The extension binds to system sleep/resume notifications via the system D-Bus `org.freedesktop.login1` manager:

- The D-Bus proxy is constructed asynchronously (`Gio.DBusProxy.new_for_bus()`) with a `Gio.Cancellable` to avoid blocking the GNOME Shell compositor main thread and to prevent stale callback races during rapid disable/enable cycles.
- When `PrepareForSleep` emits a `true` (sleeping) signal while audio is playing, the extension gracefully terminates the active GStreamer stream and flags `_wasPlayingBeforeSleep = true`.
- Upon waking (`false`), if the flag is set, the extension automatically restarts the procedural stream at the exact previous volume and noise profile.
