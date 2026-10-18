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
  'medium-sharp': 'noise-generator-medium-sharp-symbolic.svg',
  'medium-wave': 'noise-generator-medium-wave-symbolic.svg',
  'compact-sharp': 'noise-generator-compact-sharp-symbolic.svg',
  'compact-wave': 'noise-generator-compact-wave-symbolic.svg',
  'solid-sharp': 'noise-generator-solid-sharp-symbolic.svg',
  'solid-centered': 'noise-generator-solid-centered-symbolic.svg',
  default: 'noise-generator-symbolic.svg',
};

/**
 * Set of validated icon style keys to safeguard against invalid configuration states.
 * @type {Set<string>}
 */
const VALID_ICON_STYLES = new Set(Object.keys(ICON_MAP));

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
      });

      this._extension = extension;
      this._isPlaying = false;

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

      // Make the submenu header icon interactive to toggle playback on/off interchangeably
      if (this.menu._headerIcon) {
        this.menu._headerIcon.reactive = true;
        this.menu._headerIcon.track_hover = true;
        this.menu._headerIcon.connect('button-release-event', () => {
          this._extension._togglePlayback();
          return Clutter.EVENT_STOP;
        });
      }

      // Supported algorithmic noise profiles and tone generators
      this._profiles = [
        { name: 'White Noise (Bright Hiss)', type: 'white-noise' },
        { name: 'Pink Noise (Balanced Rain)', type: 'pink-noise' },
        { name: 'Brown Noise (Deep Rumble)', type: 'red-noise' },
        { name: 'Blue Noise (High Hiss)', type: 'blue-noise' },
        { name: 'Gaussian Noise (Pure Static)', type: 'gaussian-noise' },
        { name: 'Pure Tone (Sine Wave 440Hz)', type: 'sine' },
        { name: 'Retro Buzz (Square Wave)', type: 'square' },
        { name: 'Synth Texture (Sawtooth Wave)', type: 'saw' },
        { name: 'Soft Tone (Triangle Wave)', type: 'triangle' },
        { name: 'Rhythmic Ticks (Clock/Metronome)', type: 'ticks' },
      ];

      this._menuItems = {};
      this._profileLabels = {};

      // Populate submenu options dynamically
      this._profiles.forEach((profile) => {
        let menuItem = new PopupMenu.PopupMenuItem(profile.name);
        this._profileLabels[profile.type] = profile.name;

        menuItem.connect('activate', () => {
          this._extension._settings.set_string('noise-type', profile.type);
        });
        this.menu.addMenuItem(menuItem);
        this._menuItems[profile.type] = menuItem;
      });
    }

    /**
     * Updates the toggle button and submenu header icons dynamically.
     * @param {Gio.FileIcon} gicon - The new GIcon instance to apply.
     */
    updateIcon(gicon) {
      this.gicon = gicon;
      if (this.menu) {
        this.menu.setHeader(gicon, 'Generative Noise', 'Select Profile');
        // Re-apply interactivity flags if header icon instance is recreated on header update
        if (this.menu._headerIcon) {
          this.menu._headerIcon.reactive = true;
          this.menu._headerIcon.track_hover = true;
          this.menu._headerIcon.connect('button-release-event', () => {
            this._extension._togglePlayback();
            return Clutter.EVENT_STOP;
          });
        }
      }
    }

    /**
     * Updates the toggle button state, active checkmarks, and styling.
     * @param {boolean} isPlaying - Current audio stream execution status.
     * @param {string} noiseName - Human-readable name of the active noise profile.
     * @param {string} noiseType - Machine-readable identifier of the active profile.
     */
    updateState(isPlaying, noiseName, noiseType) {
      this._isPlaying = isPlaying;
      this.checked = isPlaying;
      this.title = noiseName; // Keeps the selected profile name visible regardless of playing state

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
      this._extension = extension;

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
 * @brief Core extension lifecycle manager handling GStreamer subprocesses, GSettings bindings, and power hooks.
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
      'org.gnome.shell.extensions.com.github.kyleabaker.gnome-generative-noise-generator'
    );

    // Resolve user icon style preference with fallback validation
    const rawIconStyle = this._settings.get_string('icon-style');
    this._currentIconStyle = VALID_ICON_STYLES.has(rawIconStyle)
      ? rawIconStyle
      : 'medium-sharp';

    this._customGIcon = this._resolveIcon(this._currentIconStyle);

    // Initialize state flags and identifiers
    this._isPlaying = false;
    this._audioPid = null;
    this._childWatchId = null;
    this._wasPlayingBeforeSleep = false;
    this._loginProxy = null;
    this._prepareForSleepId = null;
    this._settingsChangedId = null;

    // Validate and load noise profile type
    const rawNoiseType = this._settings.get_string('noise-type');
    const validProfiles = new Set([
      'white-noise',
      'pink-noise',
      'red-noise',
      'blue-noise',
      'gaussian-noise',
      'sine',
      'square',
      'saw',
      'triangle',
      'ticks',
    ]);
    this._currentNoiseType = validProfiles.has(rawNoiseType)
      ? rawNoiseType
      : 'white-noise';

    // Validate and load volume multiplier setting
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
          if (validProfiles.has(newType)) {
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

    // Setup system sleep/resume lifecycle hooks via logind DBus proxy
    this._setupPowerManagerListener();
  }

  /**
   * Resolves a Gio.FileIcon reference from an icon style key, with fallback handling.
   * @param {string} styleKey - The configuration key for the icon style.
   * @returns {Gio.FileIcon|Gio.ThemedIcon} The resolved icon instance.
   */
  _resolveIcon(styleKey) {
    const filename =
      ICON_MAP[styleKey] || 'noise-generator-medium-sharp-symbolic.svg';
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
   * Maps internal noise profile keys to human-readable labels.
   * @param {string} type - Machine identifier for the noise profile.
   * @returns {string} Formatted display title.
   */
  _getDisplayName(type) {
    switch (type) {
      case 'pink-noise':
        return 'Pink Noise';
      case 'red-noise':
        return 'Brown Noise';
      case 'blue-noise':
        return 'Blue Noise';
      case 'gaussian-noise':
        return 'Gaussian Noise';
      case 'sine':
        return 'Pure Tone (Sine)';
      case 'square':
        return 'Retro Buzz (Square)';
      case 'saw':
        return 'Synth Texture (Saw)';
      case 'triangle':
        return 'Soft Tone (Triangle)';
      case 'ticks':
        return 'Rhythmic Ticks';
      default:
        return 'White Noise';
    }
  }

  /**
   * Toggles audio stream playback state.
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
   * Spawns the GStreamer background subprocess to generate procedural audio.
   */
  _startAudioStream() {
    this._stopAudioStream();

    try {
      let argv = [
        'gst-launch-1.0',
        'audiotestsrc',
        `wave=${this._currentNoiseType}`,
        '!',
        'volume',
        `volume=${this._currentVolume}`,
        '!',
        'autoaudiosink',
      ];

      let [success, pid] = GLib.spawn_async(
        null,
        argv,
        null,
        GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
        null
      );

      if (success) {
        this._audioPid = pid;
        this._isPlaying = true;
        this._indicator.updateIndicatorState(
          true,
          this._currentNoiseName,
          this._currentNoiseType
        );

        // Watch child process termination to handle unexpected exits cleanly
        this._childWatchId = GLib.child_watch_add(
          GLib.PRIORITY_DEFAULT,
          pid,
          (pid, status) => {
            this._childWatchId = null;
            this._onProcessExited(status);
            return GLib.SOURCE_REMOVE;
          }
        );
      } else {
        throw new Error('Spawn execution returned failure flag.');
      }
    } catch (e) {
      console.error(`[GenerativeNoise] Stream execution failed: ${e.message}`);
      Main.notifyError(
        'GNOME Generative Noise',
        'Could not initialize procedural audio stream.'
      );
      this._isPlaying = false;
    }
  }

  /**
   * Handles asynchronous exit events from the GStreamer subprocess.
   * @param {number} status - Exit status code.
   */
  _onProcessExited(status) {
    if (!this._indicator) return;
    console.log(`_onProcessExited status: ${status}`);
    this._audioPid = null;
    this._isPlaying = false;
    this._indicator.updateIndicatorState(
      false,
      this._currentNoiseName,
      this._currentNoiseType
    );
  }

  /**
   * Terminates the active GStreamer audio generation subprocess safely.
   */
  _stopAudioStream() {
    if (this._childWatchId) {
      GLib.source_remove(this._childWatchId);
      this._childWatchId = null;
    }

    if (this._audioPid !== null) {
      try {
        GLib.spawn_async(
          null,
          ['kill', '-15', String(this._audioPid)],
          null,
          GLib.SpawnFlags.SEARCH_PATH,
          null
        );
      } catch (e) {
        console.error(
          `[GenerativeNoise] Failed to kill PID ${this._audioPid}: ${e.message}`
        );
      }
      this._audioPid = null;
    }
    this._isPlaying = false;
  }

  /**
   * Binds system power state signals (PrepareForSleep) to automatically pause/resume audio playback.
   */
  _setupPowerManagerListener() {
    try {
      const proxy = Gio.DBusProxy.new_for_bus_sync(
        Gio.BusType.SYSTEM,
        Gio.DBusProxyFlags.NONE,
        null,
        'org.freedesktop.login1',
        '/org/freedesktop/login1',
        'org.freedesktop.login1.Manager',
        null
      );

      if (!this._settings) return;

      this._loginProxy = proxy;
      this._prepareForSleepId = this._loginProxy.connect(
        'g-signal',
        (proxy, senderName, signalName, parameters) => {
          if (signalName === 'PrepareForSleep') {
            let [isSleeping] = parameters.get_child_value(0).get_boolean();
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

  /**
   * Extension deactivation routine. Cleans up audio streams, disconnects settings listeners,
   * unbinds DBus proxies, and destroys UI elements.
   */
  disable() {
    this._stopAudioStream();

    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }

    if (this._settings && this._settingsChangedId) {
      this._settings.disconnect(this._settingsChangedId);
      this._settings = null;
    }

    if (this._prepareForSleepId && this._loginProxy) {
      try {
        this._loginProxy.disconnect(this._prepareForSleepId);
      } catch {
        // Suppress errors during teardown
      }
      this._prepareForSleepId = null;
      this._loginProxy = null;
    }

    this._customGIcon = null;
  }
}
