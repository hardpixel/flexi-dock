import { GObject, Gio, Gtk, Adw } from '#gi'
import { extensionUtils as ExtensionUtils } from '#misc'

class Preferences extends Adw.PreferencesPage {
  static {
    GObject.registerClass(this)
  }

  constructor() {
    super({
      title: 'Settings'
    })

    this.settings = ExtensionUtils.getSettings()

    this.addSection({
      title: 'General',
      actions: [
        {
          title: 'Mode',
          type: 'enum',
          subtitle: 'Select operation mode',
          setting: 'mode',
          options: ['Dock', 'Panel']
        },
        {
          title: 'Apps Button',
          type: 'enum',
          subtitle: 'Set apps button position',
          setting: 'show-apps-position',
          options: ['Start', 'End']
        }
      ]
    })

    this.addSection({
      title: 'Icons',
      actions: [
        {
          title: 'Size',
          type: 'int',
          subtitle: 'Set taskbar icons size',
          setting: 'icon-size',
          options: { lower: 16, upper: 128 }
        },
        {
          title: 'Alignment',
          type: 'enum',
          subtitle: 'Set taskbar icons alignment',
          setting: 'icon-alignment',
          options: ['Start', 'End', 'Center']
        }
      ]
    })

    this.addSection({
      title: 'Dock',
      actions: [
        {
          title: 'Position',
          type: 'enum',
          subtitle: 'Set dock position',
          setting: 'dock-position',
          options: ['Left', 'Right', 'Top', 'Bottom']
        },
        {
          title: 'Alignment',
          type: 'enum',
          subtitle: 'Set dock alignment',
          setting: 'dock-alignment',
          options: ['Fill', 'Start', 'End', 'Center']
        }
      ]
    })

    this.addSection({
      title: 'Panel',
      actions: [
        {
          title: 'Position',
          type: 'enum',
          subtitle: 'Set panel position',
          setting: 'panel-position',
          options: ['Top', 'Bottom']
        }
      ]
    })
  }

  addSection({ title, actions }) {
    const group = new Adw.PreferencesGroup({ title })
    this.add(group)

    actions.forEach(({ type, title, subtitle, setting, options }) => {
      const row = new Adw.ActionRow({ title })
      group.add(row)

      let widget = null

      if (type == 'enum') {
        widget = new Gtk.ComboBoxText({ valign: Gtk.Align.CENTER })

        options.forEach((text, id) => {
          widget.append(`${id}`, `${text}`)
        })

        const value = this.settings.get_enum(setting)
        widget.set_active(value)

        widget.connect('changed', cbox => {
          this.settings.set_enum(setting, cbox.get_active())
        })
      }

      if (type == 'int') {
        const adjust = new Gtk.Adjustment({
          value: this.settings.get_int(setting),
          lower: 0,
          upper: 100,
          page_size: 0,
          step_increment: 1,
          ...options
        })

        widget = new Gtk.SpinButton({ valign: Gtk.Align.CENTER })
        widget.set_adjustment(adjust)

        this.settings.bind(setting, widget, 'value', Gio.SettingsBindFlags.DEFAULT)
      }

      if (widget) {
        widget.set_size_request(120, -1)
        row.add_suffix(widget)
      }

      if (subtitle) {
        row.set_subtitle(subtitle)
      }
    })
  }
}

export function init() {
  ExtensionUtils.initTranslations()
}

export function buildPrefsWidget() {
  return new Preferences()
}
