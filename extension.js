/**
 * @file extension.js
 * @brief GNOME Generative Noise - Quick Settings Integration & Extended Profiles
 * @description Integrates procedural noise generation natively into the GNOME Shell
 *              Quick Settings menu with a comprehensive library of algorithmic sound profiles
 *              and customizable status icon variations.
 */

import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

/**
 * Mapping table associating user-selectable icon style keys to their corresponding
 * SVG asset filenames stored within the extension bundle.
 * @type {Object.<string, string>}
 */
const ICON_MAP = {
  'medium-sharp': 'generative-noise-medium-sharp-symbolic.svg',
  'medium-wave': 'generative-noise-medium-wave-symbolic.svg',
  'compact-sharp': 'generative-noise-compact-sharp-symbolic.svg',
  'compact-wave': 'generative-noise-compact-wave-symbolic.svg',
  'solid-sharp': 'generative-noise-solid-sharp-symbolic.svg',
  'solid-centered': 'generative-noise-solid-centered-symbolic.svg',
  default: 'generative-noise-symbolic.svg',
};

/**
 * Set of validated icon style keys to safeguard against invalid configuration states.
 * @type {Set<string>}
 */
const VALID_ICON_STYLES = new Set(Object.keys(ICON_MAP));

/**
 * Canonical list of supported algorithmic noise profiles and tone generators.
 * This serves as the single source of truth for both UI menu construction and
 * GSettings input validation (defense-in-depth against invalid profile strings).
 * @type {Array<{name: string, shortName: string, type: string}>}
 */
const NOISE_PROFILES = [
  {
    name: 'White Noise (Bright Hiss)',
    shortName: 'White Noise',
    type: 'white-noise',
  },
  {
    name: 'Pink Noise (Balanced Rain)',
    shortName: 'Pink Noise',
    type: 'pink-noise',
  },
  {
    name: 'Brown Noise (Deep Rumble)',
    shortName: 'Brown Noise',
    type: 'red-noise',
  },
  {
    name: 'Blue Noise (High Hiss)',
    shortName: 'Blue Noise',
    type: 'blue-noise',
  },
  {
    name: 'Gaussian Noise (Pure Static)',
    shortName: 'Gaussian Noise',
    type: 'gaussian-noise',
  },
  {
    name: 'Pure Tone (Sine Wave 440Hz)',
    shortName: 'Pure Tone (Sine)',
    type: 'sine',
  },
  {
    name: 'Retro Buzz (Square Wave)',
    shortName: 'Retro Buzz (Square)',
    type: 'square',
  },
  {
    name: 'Synth Texture (Sawtooth Wave)',
    shortName: 'Synth Texture (Saw)',
    type: 'saw',
  },
  {
    name: 'Soft Tone (Triangle Wave)',
    shortName: 'Soft Tone (Triangle)',
    type: 'triangle',
  },
  {
    name: 'Rhythmic Ticks (Clock/Metronome)',
    shortName: 'Rhythmic Ticks',
    type: 'ticks',
  },
];

/**
 * Whitelist set of valid noise type identifiers, derived from NOISE_PROFILES.
 * Used for strict input validation of GSettings values before process argument construction.
 * @type {Set<string>}
 */
const VALID_NOISE_TYPES = new Set(NOISE_PROFILES.map((p) => p.type));

/**
 * Derived lookup map from noise type identifiers to abbreviated display names
 * for space-constrained UI elements (e.g. Quick Settings toggle title).
 * @type {Map<string, string>}
 */
const NOISE_SHORT_NAMES = new Map(
  NOISE_PROFILES.map((p) => [p.type, p.shortName])
);

/**
 * @class GenerativeNoiseToggle
 * @brief Quick settings menu toggle component representing the noise generator state.
 */
const GenerativeNoiseToggle = GObject.registerClass(
  class GenerativeNoiseToggle extends QuickSettings.QuickMenuToggle {
    /**
     * Initializes the quick menu toggle item, binds click events, and constructs the submenu.
     * @param {GnomeGenerativeNoiseExtension} extension - Reference to the main extension instance.
     */
    _init(extension) {
      super._init({
        title: extension._currentNoiseName,
        gicon: extension._customGIcon,
        toggleMode: true,
        accessibleName: 'GNOME Generative Noise',
      });

      this._extension = extension;

      /**
       * Tracks the signal handler ID attached to the submenu header icon,
       * ensuring proper disconnection on icon updates and widget destruction.
       * @type {number|null}
       * @private
       */
      this._headerIconSignalId = null;

      // Connect main toggle click to playback switching workflow
      this.connect('clicked', () => {
        this._extension._togglePlayback();
      });

      // Build the native submenu header with current icon and branding
      this.menu.setHeader(
        extension._customGIcon,
        'Generative Noise',
        'Select Profile'
      );

      // Make the submenu header icon interactive to toggle playback on/off
      this._connectHeaderIcon();

      /**
       * Map of noise type identifiers to their corresponding PopupMenuItem instances.
       * @type {Object.<string, PopupMenu.PopupMenuItem>}
       * @private
       */
      this._menuItems = {};

      /**
       * Map of noise type identifiers to their full descriptive menu label strings.
       * @type {Object.<string, string>}
       * @private
       */
      this._profileLabels = {};

      // Populate submenu options from the canonical profiles constant
      NOISE_PROFILES.forEach((profile) => {
        const menuItem = new PopupMenu.PopupMenuItem(profile.name);
        this._profileLabels[profile.type] = profile.name;

        menuItem.connect('activate', () => {
          this._extension._settings.set_string('noise-type', profile.type);
        });
        this.menu.addMenuItem(menuItem);
        this._menuItems[profile.type] = menuItem;
      });
    }

    /**
     * Connects a click handler to the submenu header icon for playback toggling.
     * Disconnects any previously attached handler to prevent signal accumulation.
     * @private
     */
    _connectHeaderIcon() {
      this._disconnectHeaderIcon();
      if (this.menu._headerIcon) {
        this.menu._headerIcon.reactive = true;
        this.menu._headerIcon.track_hover = true;
        this._headerIconSignalId = this.menu._headerIcon.connect(
          'button-release-event',
          () => {
            this._extension._togglePlayback();
            return Clutter.EVENT_STOP;
          }
        );
      }
    }

    /**
     * Disconnects the current header icon click handler if one is attached.
     * @private
     */
    _disconnectHeaderIcon() {
      if (this._headerIconSignalId !== null && this.menu._headerIcon) {
        try {
          this.menu._headerIcon.disconnect(this._headerIconSignalId);
        } catch {
          // Header icon instance may have been recreated or destroyed
        }
        this._headerIconSignalId = null;
      }
    }

    /**
     * Updates the toggle button and submenu header icons dynamically.
     * @param {Gio.FileIcon} gicon - The new GIcon instance to apply.
     */
    updateIcon(gicon) {
      this.gicon = gicon;
      if (this.menu) {
        this.menu.setHeader(gicon, 'Generative Noise', 'Select Profile');
        // Re-apply interactivity since setHeader may recreate the icon instance
        this._connectHeaderIcon();
      }
    }

    /**
     * Updates the toggle button state, active checkmarks, and styling.
     * @param {boolean} isPlaying - Current audio stream execution status.
     * @param {string} noiseName - Human-readable name of the active noise profile.
     * @param {string} noiseType - Machine-readable identifier of the active profile.
     */
    updateState(isPlaying, noiseName, noiseType) {
      this.checked = isPlaying;
      this.title = noiseName;

      // Refresh submenu checkmarks and active styling classes
      for (const [type, item] of Object.entries(this._menuItems)) {
        if (item) {
          const baseName = this._profileLabels[type] || '';
          if (type === noiseType) {
            item.label.text = `✓  ${baseName}`;
            item.add_style_class_name('active-profile');
          } else {
            item.label.text = baseName;
            item.remove_style_class_name('active-profile');
          }
        }
      }
    }

    /**
     * Cleans up signal handlers and extension references upon widget destruction.
     */
    destroy() {
      this._disconnectHeaderIcon();
      super.destroy();
      this._extension = null;
    }
  }
);

/**
 * @class GenerativeNoiseIndicator
 * @brief Manages the top panel system tray indicator and links it with the Quick Settings menu.
 */
const GenerativeNoiseIndicator = GObject.registerClass(
  class GenerativeNoiseIndicator extends QuickSettings.SystemIndicator {
    /**
     * Initializes the status indicator and instantiates the managed QuickToggle.
     * @param {GnomeGenerativeNoiseExtension} extension - Reference to the main extension instance.
     */
    _init(extension) {
      super._init();

      // Create the top panel status tray icon
      this._indicator = this._addIndicator();
      this._indicator.gicon = extension._customGIcon;
      this._indicator.visible = false; // Hidden when inactive, visible during playback

      // Instantiate quick toggle and push to managed items array
      this.quickToggle = new GenerativeNoiseToggle(extension);
      this.quickSettingsItems.push(this.quickToggle);
    }

    /**
     * Updates icon instances across both the top panel indicator and quick toggle.
     * @param {Gio.FileIcon} gicon - The icon reference to apply.
     */
    updateIcon(gicon) {
      if (this._indicator) {
        this._indicator.gicon = gicon;
      }
      if (this.quickToggle) {
        this.quickToggle.updateIcon(gicon);
      }
    }

    /**
     * Synchronizes overall indicator visibility and toggle state.
     * @param {boolean} isPlaying - Playback active state.
     * @param {string} noiseName - Selected noise profile display name.
     * @param {string} noiseType - Selected noise profile key.
     */
    updateIndicatorState(isPlaying, noiseName, noiseType) {
      this.quickToggle.updateState(isPlaying, noiseName, noiseType);
      this._indicator.visible = isPlaying;
    }

    /**
     * Cleans up quick settings items upon destruction.
     */
    destroy() {
      this.quickSettingsItems.forEach((item) => item.destroy());
      super.destroy();
    }
  }
);

/**
 * @class GnomeGenerativeNoiseExtension
 * @brief Core extension lifecycle manager handling GStreamer subprocesses, GSettings bindings,
 *        and system power hooks.
 */
export default class GnomeGenerativeNoiseExtension extends Extension {
  /**
   * Extension activation routine. Validates system dependencies, loads settings,
   * binds event listeners, and registers the Quick Settings indicator.
   */
  enable() {
    // Ensure core GStreamer command-line audio utility is available
    if (!GLib.find_program_in_path('gst-launch-1.0')) {
      Main.notifyError(
        'GNOME Generative Noise Error',
        'GStreamer tool "gst-launch-1.0" is missing. Please install gstreamer1.0-tools.'
      );
      return;
    }

    this._settings = this.getSettings(
      'org.gnome.shell.extensions.com.github.kyleabaker.gnome-generative-noise'
    );

    // Resolve user icon style preference with fallback validation
    const rawIconStyle = this._settings.get_string('icon-style');
    this._currentIconStyle = VALID_ICON_STYLES.has(rawIconStyle)
      ? rawIconStyle
      : 'medium-sharp';

    this._customGIcon = this._resolveIcon(this._currentIconStyle);

    // Initialize state flags and identifiers
    this._isPlaying = false;
    this._subprocess = null;
    this._wasPlayingBeforeSleep = false;
    this._loginProxy = null;
    this._prepareForSleepId = null;
    this._settingsChangedId = null;
    this._proxyCreationCancellable = null;

    // Validate and load noise profile type against the canonical whitelist
    const rawNoiseType = this._settings.get_string('noise-type');
    this._currentNoiseType = VALID_NOISE_TYPES.has(rawNoiseType)
      ? rawNoiseType
      : 'white-noise';

    // Validate and clamp volume multiplier to safe bounds [0.0, 1.0]
    const rawVolume = this._settings.get_double('volume');
    this._currentVolume =
      typeof rawVolume === 'number' && !Number.isNaN(rawVolume)
        ? Math.max(0.0, Math.min(1.0, rawVolume))
        : 0.7;

    this._currentNoiseName = this._getDisplayName(this._currentNoiseType);

    // Register Quick Settings system indicator
    this._indicator = new GenerativeNoiseIndicator(this);
    Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    this._indicator.updateIndicatorState(
      false,
      this._currentNoiseName,
      this._currentNoiseType
    );

    // Listen for GSettings configuration updates
    this._settingsChangedId = this._settings.connect(
      'changed',
      (settings, key) => {
        if (key === 'noise-type') {
          const newType = settings.get_string('noise-type');
          if (VALID_NOISE_TYPES.has(newType)) {
            this._currentNoiseType = newType;
            this._currentNoiseName = this._getDisplayName(
              this._currentNoiseType
            );
            if (this._isPlaying) {
              this._startAudioStream();
            } else {
              this._indicator.updateIndicatorState(
                false,
                this._currentNoiseName,
                this._currentNoiseType
              );
            }
          }
        } else if (key === 'volume') {
          const newVol = settings.get_double('volume');
          if (typeof newVol === 'number' && !Number.isNaN(newVol)) {
            this._currentVolume = Math.max(0.0, Math.min(1.0, newVol));
            if (this._isPlaying) {
              this._startAudioStream();
            }
          }
        } else if (key === 'icon-style') {
          const newStyle = settings.get_string('icon-style');
          if (VALID_ICON_STYLES.has(newStyle)) {
            this._currentIconStyle = newStyle;
            this._customGIcon = this._resolveIcon(newStyle);
            if (this._indicator) {
              this._indicator.updateIcon(this._customGIcon);
            }
          }
        }
      }
    );

    // Setup system sleep/resume lifecycle hooks via logind D-Bus proxy
    this._setupPowerManagerListener();
  }

  /**
   * Resolves a Gio.FileIcon reference from an icon style key, with fallback handling.
   * @param {string} styleKey - The configuration key for the icon style.
   * @returns {Gio.FileIcon|Gio.ThemedIcon} The resolved icon instance.
   * @private
   */
  _resolveIcon(styleKey) {
    const filename =
      ICON_MAP[styleKey] || 'generative-noise-medium-sharp-symbolic.svg';
    const iconFile = this.dir.resolve_relative_path(
      `icons/scalable/status/${filename}`
    );

    if (iconFile?.query_exists(null)) {
      return new Gio.FileIcon({ file: iconFile });
    }
    console.warn(
      `[GenerativeNoise] Custom icon ${filename} not found, falling back to system icon.`
    );
    return Gio.icon_new_for_string('audio-volume-high-symbolic');
  }

  /**
   * Maps an internal noise profile type key to its abbreviated display name,
   * derived from the canonical NOISE_PROFILES constant via NOISE_SHORT_NAMES.
   * @param {string} type - Machine identifier for the noise profile.
   * @returns {string} Abbreviated display title for space-constrained UI.
   * @private
   */
  _getDisplayName(type) {
    return NOISE_SHORT_NAMES.get(type) ?? 'White Noise';
  }

  /**
   * Toggles audio stream playback state between playing and stopped.
   * @private
   */
  _togglePlayback() {
    if (!this._isPlaying) {
      this._startAudioStream();
    } else {
      this._stopAudioStream();
      this._indicator.updateIndicatorState(
        false,
        this._currentNoiseName,
        this._currentNoiseType
      );
    }
  }

  /**
   * Spawns a GStreamer subprocess via Gio.Subprocess to generate procedural audio.
   * Uses Gio.Subprocess for automatic child reaping, direct signal delivery,
   * and elimination of zombie process leaks.
   * @private
   */
  _startAudioStream() {
    this._stopAudioStream();

    try {
      // Defense-in-depth: re-validate noise type against the canonical whitelist
      // immediately before constructing the process argument vector
      if (!VALID_NOISE_TYPES.has(this._currentNoiseType)) {
        throw new Error(
          `Noise type "${this._currentNoiseType}" failed whitelist validation.`
        );
      }

      // Construct GStreamer pipeline as array-based argv (per AGENTS.md §2).
      // Property assignments use gst-launch key=value syntax within single
      // argv elements; values are pre-validated against whitelists and bounds.
      // Volume uses toFixed(4) to prevent floating-point precision artifacts
      // (e.g. 0.30000000000000004) from reaching the GStreamer property parser.
      const argv = [
        'gst-launch-1.0',
        'audiotestsrc',
        `wave=${this._currentNoiseType}`,
        '!',
        'volume',
        `volume=${this._currentVolume.toFixed(4)}`,
        '!',
        'autoaudiosink',
      ];

      this._subprocess = Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);

      this._isPlaying = true;
      this._indicator.updateIndicatorState(
        true,
        this._currentNoiseName,
        this._currentNoiseType
      );

      // Monitor subprocess lifecycle asynchronously. Gio.Subprocess handles
      // child reaping automatically, preventing the zombie process leaks
      // inherent to the GLib.spawn_async + DO_NOT_REAP_CHILD pattern.
      const activeSubprocess = this._subprocess;
      activeSubprocess.wait_async(null, (proc, result) => {
        try {
          proc.wait_finish(result);
        } catch {
          // Subprocess was already reaped or the wait was cancelled
        }

        // Only update UI state if this subprocess is still the active one;
        // a newer stream may have already replaced it during profile switching
        if (this._subprocess === activeSubprocess) {
          this._subprocess = null;
          this._onProcessExited(proc.get_exit_status());
        }
      });
    } catch (e) {
      console.error(`[GenerativeNoise] Stream execution failed: ${e.message}`);
      Main.notifyError(
        'GNOME Generative Noise',
        'Could not initialize procedural audio stream.'
      );
      this._isPlaying = false;
      this._subprocess = null;
    }
  }

  /**
   * Handles asynchronous exit events from the GStreamer subprocess.
   * Resets playback state and synchronizes the panel indicator.
   * @param {number} status - Raw waitpid exit status code.
   * @private
   */
  _onProcessExited(status) {
    if (!this._indicator) return;
    console.debug(`[GenerativeNoise] Process exited with status: ${status}`);
    this._isPlaying = false;
    this._indicator.updateIndicatorState(
      false,
      this._currentNoiseName,
      this._currentNoiseType
    );
  }

  /**
   * Terminates the active GStreamer subprocess safely via direct SIGTERM delivery.
   * Uses Gio.Subprocess.send_signal() instead of spawning a separate `kill` process,
   * providing reliable signal delivery without transient process overhead.
   * @private
   */
  _stopAudioStream() {
    if (this._subprocess) {
      try {
        this._subprocess.send_signal(15); // SIGTERM
      } catch (e) {
        // Process may have already exited naturally before signal delivery
        console.debug(`[GenerativeNoise] Signal delivery note: ${e.message}`);
      }
      this._subprocess = null;
    }
    this._isPlaying = false;
  }

  /**
   * Binds system power state signals (PrepareForSleep) to automatically
   * pause and resume audio playback across sleep/wake cycles.
   * Uses asynchronous D-Bus proxy construction to avoid blocking the
   * GNOME Shell compositor main thread.
   * @private
   */
  _setupPowerManagerListener() {
    try {
      this._proxyCreationCancellable = new Gio.Cancellable();
      Gio.DBusProxy.new_for_bus(
        Gio.BusType.SYSTEM,
        Gio.DBusProxyFlags.NONE,
        null,
        'org.freedesktop.login1',
        '/org/freedesktop/login1',
        'org.freedesktop.login1.Manager',
        this._proxyCreationCancellable,
        (_source, result) => {
          try {
            const proxy = Gio.DBusProxy.new_for_bus_finish(result);

            // Guard: extension may have been disabled during async proxy construction
            if (!this._settings) return;

            this._loginProxy = proxy;
            this._prepareForSleepId = this._loginProxy.connect(
              'g-signal',
              (_proxy, _senderName, signalName, parameters) => {
                if (signalName === 'PrepareForSleep') {
                  const isSleeping = parameters
                    .get_child_value(0)
                    .get_boolean();
                  if (isSleeping && this._isPlaying) {
                    this._stopAudioStream();
                    this._wasPlayingBeforeSleep = true;
                  } else if (!isSleeping && this._wasPlayingBeforeSleep) {
                    this._startAudioStream();
                    this._wasPlayingBeforeSleep = false;
                  }
                }
              }
            );
          } catch (e) {
            console.warn(
              `[GenerativeNoise] Could not bind to login1 power manager: ${e.message}`
            );
          }
        }
      );
    } catch (e) {
      console.warn(
        `[GenerativeNoise] Could not initiate login1 proxy creation: ${e.message}`
      );
    }
  }

  /**
   * Extension deactivation routine. Cleans up audio streams, disconnects settings
   * listeners, unbinds D-Bus proxies, and destroys UI elements.
   */
  disable() {
    this._stopAudioStream();

    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }

    if (this._settings && this._settingsChangedId) {
      this._settings.disconnect(this._settingsChangedId);
      this._settingsChangedId = null;
      this._settings = null;
    }

    // Cancel any in-flight async D-Bus proxy creation to prevent stale
    // callbacks from firing after re-enable and leaking duplicate handlers
    if (this._proxyCreationCancellable) {
      this._proxyCreationCancellable.cancel();
      this._proxyCreationCancellable = null;
    }

    if (this._prepareForSleepId && this._loginProxy) {
      try {
        this._loginProxy.disconnect(this._prepareForSleepId);
      } catch {
        // Suppress errors during teardown if proxy was already invalidated
      }
      this._prepareForSleepId = null;
      this._loginProxy = null;
    }

    this._customGIcon = null;
    this._wasPlayingBeforeSleep = false;
  }
}
