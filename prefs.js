/**
 * @file prefs.js
 * @brief Preferences window for Generative Noise Generator (Libadwaita)
 * @description Provides a native, HIG-compliant settings panel for configuring
 *              all procedural noise algorithms, output volume, and icon styles
 *              using consistent Adw.ComboRow implementations with visual previews.
 */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';
import {
  ExtensionPreferences,
  gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

/**
 * @class IconOptionItem
 * @brief Custom GObject data model representing an icon style option with its associated GIcon.
 */
const IconOptionItem = GObject.registerClass(
  {
    Properties: {
      key: GObject.ParamSpec.string(
        'key',
        'Key',
        'Configuration key',
        GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT_ONLY,
        ''
      ),
      label: GObject.ParamSpec.string(
        'label',
        'Label',
        'Display label',
        GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT_ONLY,
        ''
      ),
      gicon: GObject.ParamSpec.object(
        'gicon',
        'GIcon',
        'Associated icon file reference',
        GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT_ONLY,
        Gio.Icon.$gtype
      ),
    },
  },
  class IconOptionItem extends GObject.Object {}
);

/**
 * @class NoiseProfileItem
 * @brief Custom GObject data model representing a noise profile algorithm option.
 */
const NoiseProfileItem = GObject.registerClass(
  {
    Properties: {
      key: GObject.ParamSpec.string(
        'key',
        'Key',
        'Configuration key',
        GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT_ONLY,
        ''
      ),
      label: GObject.ParamSpec.string(
        'label',
        'Label',
        'Display label',
        GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT_ONLY,
        ''
      ),
    },
  },
  class NoiseProfileItem extends GObject.Object {}
);

/**
 * @class GenerativeNoisePreferences
 * @brief Manages the preferences window UI and GSettings bindings for the extension.
 */
export default class GenerativeNoisePreferences extends ExtensionPreferences {
  /**
   * Constructs the preferences window UI hierarchy conforming to Libadwaita HIG.
   * @param {Adw.PreferencesWindow} window - The preference window instance.
   */
  fillPreferencesWindow(window) {
    window.set_default_size(780, 620);

    const settings = this.getSettings(
      'org.gnome.shell.extensions.com.github.kyleabaker.gnome-generative-noise-generator'
    );

    const page = new Adw.PreferencesPage();

    // Group 1: Audio & Playback Settings
    const audioGroup = new Adw.PreferencesGroup({
      title: _('Generative Noise Settings'),
      description: _(
        'Configure default procedural audio parameters and startup behavior.'
      ),
    });
    page.add(audioGroup);

    // Complete Noise Profile Definitions (All 10 profiles)
    const noiseProfiles = [
      { key: 'white-noise', label: _('White Noise (Bright Hiss)') },
      { key: 'pink-noise', label: _('Pink Noise (Balanced Rain)') },
      { key: 'red-noise', label: _('Brown Noise (Deep Rumble)') },
      { key: 'blue-noise', label: _('Blue Noise (High Hiss)') },
      { key: 'gaussian-noise', label: _('Gaussian Noise (Pure Static)') },
      { key: 'sine', label: _('Pure Tone (Sine Wave 440Hz)') },
      { key: 'square', label: _('Retro Buzz (Square Wave)') },
      { key: 'saw', label: _('Synth Texture (Sawtooth Wave)') },
      { key: 'triangle', label: _('Soft Tone (Triangle Wave)') },
      { key: 'ticks', label: _('Rhythmic Ticks (Clock/Metronome)') },
    ];

    const noiseStore = new Gio.ListStore({
      item_type: NoiseProfileItem.$gtype,
    });
    noiseProfiles.forEach((profile) => {
      noiseStore.append(
        new NoiseProfileItem({
          key: profile.key,
          label: profile.label,
        })
      );
    });

    const noiseFactory = new Gtk.SignalListItemFactory();
    noiseFactory.connect('setup', (_, listItem) => {
      const label = new Gtk.Label({
        xalign: 0.0,
        valign: Gtk.Align.CENTER,
        margin_start: 12,
        margin_end: 12,
        margin_top: 8,
        margin_bottom: 8,
      });
      listItem.set_child(label);
    });

    noiseFactory.connect('bind', (_, listItem) => {
      const label = listItem.get_child();
      const item = listItem.get_item();
      if (label && item) {
        label.set_text(item.label);
      }
    });

    const profileRow = new Adw.ComboRow({
      title: _('Default Noise Profile'),
      subtitle: _('Select the startup algorithm spectrum'),
      model: noiseStore,
      factory: noiseFactory,
      list_factory: noiseFactory,
    });

    const currentType = settings.get_string('noise-type');
    const currentIndex = noiseProfiles.findIndex((p) => p.key === currentType);
    if (currentIndex !== -1) {
      profileRow.set_selected(currentIndex);
    }

    profileRow.connect('notify::selected', () => {
      const selectedItem = profileRow.get_selected_item();
      if (selectedItem) {
        settings.set_string('noise-type', selectedItem.key);
      }
    });
    audioGroup.add(profileRow);

    // Volume Adjustment Row
    const volumeRow = new Adw.ActionRow({
      title: _('Default Volume'),
      subtitle: _('Set initial sound intensity'),
    });

    const volumeScale = new Gtk.Scale({
      orientation: Gtk.Orientation.HORIZONTAL,
      adjustment: new Gtk.Adjustment({
        lower: 0.0,
        upper: 1.0,
        step_increment: 0.05,
        page_increment: 0.1,
      }),
      draw_value: true,
      hexpand: true,
      valign: Gtk.Align.CENTER,
    });

    settings.bind(
      'volume',
      volumeScale.adjustment,
      'value',
      Gio.SettingsBindFlags.DEFAULT
    );
    volumeRow.set_child(volumeScale);
    audioGroup.add(volumeRow);

    // Group 2: Appearance & Icon Styling
    const appearanceGroup = new Adw.PreferencesGroup({
      title: _('Appearance'),
      description: _(
        'Customize the status panel and quick settings icon style.'
      ),
    });
    page.add(appearanceGroup);

    const iconOptions = [
      {
        key: 'medium-sharp',
        label: _('Equalizer Towers - Medium LED & Sharp Wave (Default)'),
        filename: 'noise-generator-medium-sharp-symbolic.svg',
      },
      {
        key: 'medium-wave',
        label: _('Equalizer Towers - Medium LED & Smooth Wave'),
        filename: 'noise-generator-medium-wave-symbolic.svg',
      },
      {
        key: 'compact-sharp',
        label: _('Equalizer Towers - Compact Micro & Sharp Wave'),
        filename: 'noise-generator-compact-sharp-symbolic.svg',
      },
      {
        key: 'compact-wave',
        label: _('Equalizer Towers - Compact Micro & Smooth Wave'),
        filename: 'noise-generator-compact-wave-symbolic.svg',
      },
      {
        key: 'solid-sharp',
        label: _('Solid Towers - Sharp Wave'),
        filename: 'noise-generator-solid-sharp-symbolic.svg',
      },
      {
        key: 'solid-centered',
        label: _('Solid Towers - Centered (No Baseline)'),
        filename: 'noise-generator-solid-centered-symbolic.svg',
      },
      {
        key: 'default',
        label: _('Minimal - Standard Symbolic (No Segments)'),
        filename: 'noise-generator-symbolic.svg',
      },
    ];

    const iconStore = new Gio.ListStore({ item_type: IconOptionItem.$gtype });
    iconOptions.forEach((opt) => {
      const iconFile = this.dir.resolve_relative_path(
        `icons/scalable/status/${opt.filename}`
      );
      const gicon = iconFile?.query_exists(null)
        ? new Gio.FileIcon({ file: iconFile })
        : Gio.icon_new_for_string('weather-showers-symbolic');

      iconStore.append(
        new IconOptionItem({
          key: opt.key,
          label: opt.label,
          gicon: gicon,
        })
      );
    });

    const iconFactory = new Gtk.SignalListItemFactory();
    iconFactory.connect('setup', (_, listItem) => {
      const box = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 12,
        margin_start: 12,
        margin_end: 12,
        margin_top: 8,
        margin_bottom: 8,
      });
      const image = new Gtk.Image({
        pixel_size: 16,
        valign: Gtk.Align.CENTER,
      });
      const label = new Gtk.Label({
        xalign: 0.0,
        valign: Gtk.Align.CENTER,
        hexpand: true,
      });
      box.append(image);
      box.append(label);
      listItem.set_child(box);
    });

    iconFactory.connect('bind', (_, listItem) => {
      const box = listItem.get_child();
      const image = box.get_first_child();
      const label = image ? image.get_next_sibling() : null;
      const item = listItem.get_item();

      if (image && label && item) {
        image.set_from_gicon(item.gicon);
        label.set_text(item.label);
      }
    });

    const iconRow = new Adw.ComboRow({
      title: _('Icon Style'),
      model: iconStore,
      factory: iconFactory,
      list_factory: iconFactory,
    });

    const currentIconStyle = settings.get_string('icon-style');
    const currentIconIndex = iconOptions.findIndex(
      (o) => o.key === currentIconStyle
    );
    if (currentIconIndex !== -1) {
      iconRow.set_selected(currentIconIndex);
    }

    iconRow.connect('notify::selected', () => {
      const selectedItem = iconRow.get_selected_item();
      if (selectedItem) {
        settings.set_string('icon-style', selectedItem.key);
      }
    });
    appearanceGroup.add(iconRow);

    window.add(page);
  }
}
