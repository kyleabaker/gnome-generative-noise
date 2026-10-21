# GNOME Generative Noise

**GNOME Generative Noise** is a high-performance, 100% offline ambient noise extension for GNOME Shell. Unlike traditional audio players that rely on pre-recorded audio files prone to distracting repeating seams or clicks, this extension uses **procedural mathematical synthesis** via GStreamer to generate infinitely long, non-repeating ambient soundscapes on the fly.

Designed specifically for the modern GNOME desktop, it integrates natively into the **Quick Settings panel** with a toggle and dropdown submenu for instant one-click playback control and profile selection.

---

## Features

- **True Procedural Generation:** Uses mathematical oscillators (`audiotestsrc`) to produce continuous, non-looping audio streams. Zero disk space required for audio assets.
- **Extended Noise & Tone Library:** Instantly switch between ten distinct algorithmic sound profiles:
  - **White Noise:** Bright, equal-energy hiss (like classic static).
  - **Pink Noise:** Balanced, octave-equal hiss (softer, like heavy rainfall).
  - **Brown Noise:** Deep, rolling rumble (like a distant waterfall or heavy thunder).
  - **Blue Noise:** High-frequency boosted hiss.
  - **Gaussian Noise:** Pure statistical static.
  - **Pure Tone (Sine Wave 440Hz):** Clean fundamental tone.
  - **Retro Buzz (Square Wave):** Sharp 8-bit style buzz.
  - **Synth Texture (Sawtooth Wave):** Rich harmonic sweep.
  - **Soft Tone (Triangle Wave):** Mellow rounded tone.
  - **Rhythmic Ticks (Clock/Metronome):** Steady rhythmic pulse.
- **Quick Settings Integration:** A native `QuickMenuToggle` in the GNOME Quick Settings panel — click the toggle to start or stop playback, open the submenu to select a profile.
- **Customizable Status Icons:** Choose from multiple icon styles via the preferences window.
- **Persistent Settings (GSettings):** Remembers your preferred noise profile, volume, and icon style across sessions.
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
   mkdir -p ~/.local/share/gnome-shell/extensions/gnome-generative-noise@kyleabaker.github.com
   ```
2. Place the following required files into that directory:
   - `metadata.json`
   - `extension.js`
   - `stylesheet.css`
   - `prefs.js`
   - `schemas/org.gnome.shell.extensions.com.github.kyleabaker.gnome-generative-noise.gschema.xml`

3. Compile the GSettings schema so GNOME recognizes your persistent preferences:

   ```bash
   glib-compile-schemas ~/.local/share/gnome-shell/extensions/gnome-generative-noise@kyleabaker.github.com/schemas/
   ```

4. **Restart GNOME Shell:**
   - **On X11:** Press `Alt + F2`, type `r`, and press Enter.
   - **On Wayland:** Log out and log back in.

5. Enable the extension using the **Extensions** app or via terminal:
   ```bash
   gnome-extensions enable gnome-generative-noise@kyleabaker.github.com
   ```

---

## Usage Guide

- **Toggle Playback:** Click the Generative Noise toggle in the Quick Settings panel to start or stop sound generation. A status indicator icon appears in the top bar during playback.
- **Select Profile:** Open the toggle's submenu to choose from any of the ten available noise and tone profiles — the active profile is marked with a checkmark.
- **Configure Defaults:** Open the **Extensions** app, locate _GNOME Generative Noise_, and click the gear/preferences icon to adjust default startup profiles, output volume, and icon style via the Libadwaita settings window.

---

## Architecture & Security

- **Secure Process Spawning:** Uses `Gio.Subprocess` with array-based argument vectors rather than raw shell string evaluation, providing immunity to command injection vulnerabilities.
- **Strict Memory Hygiene:** All signal listeners, GSettings connections, and D-Bus proxies are explicitly disconnected and cleaned up upon extension disable, ensuring zero memory leaks.

---

## License

This project is open-source software.
