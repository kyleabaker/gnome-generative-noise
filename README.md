# Generative Noise Generator

**Generative Noise Generator** is a high-performance, 100% offline ambient noise extension for GNOME Shell. Unlike traditional audio players that rely on pre-recorded audio files prone to distracting repeating seams or clicks, this extension uses **procedural mathematical synthesis** via GStreamer to generate infinitely long, non-repeating ambient soundscapes on the fly.

Designed specifically for the modern GNOME desktop, it features a native **split-button top bar interface** that provides instant one-click toggling alongside an intuitive dropdown menu for spectrum selection and settings management.

---

## Features

- **True Procedural Generation:** Uses mathematical oscillators (`audiotestsrc`) to produce continuous, non-looping audio streams. Zero disk space required for audio assets.
- **Multiple Noise Profiles:** Instantly switch between four distinct acoustic spectra:
  - **White Noise:** Bright, equal-energy hiss (like classic static).
  - **Pink Noise:** Balanced, octave-equal hiss (softer, like heavy rainfall).
  - **Brown Noise:** Deep, rolling rumble (like a distant waterfall or heavy thunder).
  - **Blue Noise:** High-frequency boosted hiss.
- **Split-Button Top Bar UI:** Click the left side/icon to toggle playback instantly; click the right arrow to open the configuration dropdown.
- **Persistent Settings (GSettings):** Remembers your preferred noise profile and volume settings across sessions.
- **Native Libadwaita Preferences Window:** Clean, HIG-compliant settings panel accessible right from the GNOME Extensions app.
- **Suspend & Sleep Intelligence:** Automatically pauses audio when your system enters sleep/suspend, and safely restores state upon wake.
- **Process Watchdogs:** Actively monitors background GStreamer processes to prevent zombie pipelines or UI desynchronization.

---

## Requirements

- **GNOME Shell:** Version 45, 46, 47, 48, 49, or 50.
- **System Dependencies:** GStreamer core and CLI tools (`gst-launch-1.0`).

### Installing System Dependencies (Ubuntu / Debian)

Before installing the extension, ensure GStreamer tools are present on your system:

```bash
sudo apt update
sudo apt install gstreamer1.0-tools gstreamer1.0-plugins-good
```

---

## Installation Guide

### Manual Installation

1. Clone or download this repository into your local GNOME Shell extensions directory:
   ```bash
   mkdir -p ~/.local/share/gnome-shell/extensions/gnome-generative-noise-generator@kyleabaker.github.com
   ```
2. Place the following required files into that directory:
   - `metadata.json`
   - `extension.js`
   - `stylesheet.css`
   - `prefs.js`
   - `schemas/org.gnome.shell.extensions.com.github.kyleabaker.gnome-generative-noise-generator.gschema.xml`

3. Compile the GSettings schema so GNOME recognizes your persistent preferences:

   ```bash
   glib-compile-schemas ~/.local/share/gnome-shell/extensions/gnome-generative-noise-generator@kyleabaker.github.com/schemas/
   ```

4. **Restart GNOME Shell:**
   - **On X11:** Press `Alt + F2`, type `r`, and press Enter.
   - **On Wayland:** Log out and log back in.

5. Enable the extension using the **Extensions** app or via terminal:
   ```bash
   gnome-extensions enable gnome-generative-noise-generator@kyleabaker.github.com
   ```

---

## Usage Guide

- **Toggle Playback:** Click the left section of the top bar widget (`Noise: Off` / profile name) to start or stop sound generation.
- **Select Profile:** Click the small dropdown arrow on the right of the indicator to open the menu, then click any profile (White, Pink, Brown, or Blue) to hot-swap the algorithm instantly.
- **Configure Defaults:** Open the **Extensions** app, locate _Generative Noise Generator_, and click the gear/preferences icon to adjust default startup profiles and output volume via the Libadwaita settings window.

---

## Architecture & Security

- **Secure Process Spawning:** Uses array-based argument vectors (`GLib.spawn_async`) rather than raw shell string evaluation, providing absolute immunity to command injection vulnerabilities.
- **Strict Memory Hygiene:** All signal listeners, GSettings connections, and DBus proxies are explicitly disconnected and cleaned up upon extension disable, ensuring zero memory leaks.

---

## License

This project is open-source software.
