import { GObject, Gio, Gtk, Adw } from '#gi'
import { ExtensionPreferences } from '#extensions/prefs'
import { setContext, useSettings } from '#me/context'

class PreferencesPage extends Adw.PreferencesPage {
  static {
    GObject.registerClass(this)
  }

  constructor() {
    super({
      title: 'Settings'
    })

    this.settings = useSettings()

    this.addSection(null, [
      {
        title: 'Mode',
        subtitle: 'Select operation mode',
        setting: 'mode',
        type: 'enum',
        options: ['Dock', 'Panel']
      },
      {
        title: 'Apps Button',
        subtitle: 'Set apps button position',
        setting: 'show-apps-position',
        type: 'enum',
        options: ['Start', 'End']
      }
    ])

    this.addSection('Icons', [
      {
        title: 'Size',
        subtitle: 'Set taskbar icons size',
        setting: 'icon-size',
        type: 'int',
        options: { lower: 16, upper: 128 }
      },
      {
        title: 'Alignment',
        subtitle: 'Set taskbar icons alignment',
        setting: 'icon-alignment',
        type: 'enum',
        options: ['Start', 'End', 'Center']
      }
    ])

    this.addSection('Dock', [
      {
        title: 'Position',
        subtitle: 'Set dock position',
        setting: 'dock-position',
        type: 'enum',
        options: ['Left', 'Right', 'Top', 'Bottom']
      },
      {
        title: 'Alignment',
        subtitle: 'Set dock alignment',
        setting: 'dock-alignment',
        type: 'enum',
        options: ['Fill', 'Start', 'End', 'Center']
      }
    ])

    this.addSection('Panel', [
      {
        title: 'Position',
        subtitle: 'Set panel position',
        setting: 'panel-position',
        type: 'enum',
        options: ['Top', 'Bottom']
      }
    ])
  }

  addSection(title, actions) {
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

export default class FlexiDockPreferences extends ExtensionPreferences {
  constructor(metadata) {
    super(metadata)
    setContext(this)
  }

  getPreferencesWidget() {
    return new PreferencesPage()
  }
}
