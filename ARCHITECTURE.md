# Architecture Overview: Generative Noise Generator

This document outlines the architectural design, system interactions, process lifecycle management, and core subsystems of the **Generative Noise Generator** GNOME Shell extension.

---

## 1. System Architecture & Core Philosophy

The extension is engineered around three core principles:

1. **Zero-Asset Procedural Synthesis:** No pre-recorded audio files (.mp3, .ogg) are stored on disk. All acoustic output is computed dynamically in real time via mathematical oscillators.
2. **Process Isolation & Security:** Audio generation runs in an isolated, non-privileged background process supervised via GStreamer CLI tools, preventing any blocking operations on the GNOME Shell main event loop.
3. **Strict Memory & Signal Hygiene:** Every GSettings signal, D-Bus proxy watcher, and child process handle is explicitly registered and unbound during extension teardown (`disable()`), ensuring absolute zero memory leaks or zombie processes.

---

## 2. File Component Breakdown

The extension repository structure is organized as follows:

`text
gnome-generative-noise-generator@kyleabaker.github.com/
├── metadata.json                                          # Extension manifest & GNOME version targets
├── extension.js                                           # Main runtime entry point, UI indicators, and process watchdogs
├── prefs.js                                               # Libadwaita preferences configuration window
├── stylesheet.css                                         # HIG-compliant styling for split-button and menu items
└── schemas/
    └── org.gnome.shell.extensions.com.github.kyleabaker.gnome-generative-noise-generator.gschema.xml # Persistent user settings schema
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

### B. Split-Button Composite UI Widget

Because GNOME Shell does not provide a native split-button class, the extension constructs a composite widget inside an `St.BoxLayout`:

- **Left Button (`split-button-main`):** Houses the status icon and text label. Triggers immediate play/pause state toggling on click.
- **Right Button (`split-button-arrow`):** Houses a symbolic dropdown arrow (`pan-down-symbolic`). Toggles a native `PopupMenu.PopupMenu` instance containing noise spectrum options.
- **Unified Visual Styling:** CSS rules remove interior borders and apply asymmetric border-radius properties so the two distinct `St.Button` elements appear as a single cohesive hardware control.

### C. Process Supervision & Watchdogs

To guarantee system stability, background processes are managed robustly:

- **Secure Spawning:** Utilizes array-based argument vectors via `GLib.spawn_async(...)` rather than raw shell string evaluation, providing absolute immunity to command injection vulnerabilities.
- **Child Watch Monitor:** Binds an asynchronous process watcher (`GLib.child_watch_add`) to the spawned GStreamer PID. If the audio process crashes or is terminated externally, the watch handler fires automatically, resetting the panel UI state to "Off" and preventing UI desynchronization.

### D. Suspend & Resume Intelligence

The extension binds to system sleep/resume notifications via the system D-Bus `org.freedesktop.login1` manager:

- When `PrepareForSleep` emits a `true` (sleeping) signal while audio is playing, the extension gracefully terminates the active GStreamer stream and flags `_wasPlayingBeforeSleep = true`.
- Upon waking (`false`), if the flag is set, the extension automatically restarts the procedural stream at the exact previous volume and noise profile.
