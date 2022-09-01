import { GObject, Clutter, St } from '#gi'
import { main as Main } from '#ui'

import { Signals, Settings } from '#me/handlers'
import { TaskBar } from '#me/taskbar'

export class Dock extends St.Bin {
  static {
    GObject.registerClass(this)
  }

  constructor() {
    super({
      name: 'FlexiDock'
    })

    this.dockbar = new St.Bin({
      style_class: 'flexi-dock',
      track_hover: true,
      reactive: true,
      can_focus: true
    })

    this.taskbar = new TaskBar()
    this.signals = new Signals()
    this.setting = new Settings()

    this.signals.connect(
      Main.layoutManager, 'startup-complete', this._syncVisible.bind(this)
    )

    this.signals.connect(
      Main.layoutManager, 'monitors-changed', this._updateGeometry.bind(this)
    )

    this.signals.connect(
      Main.overview, 'showing', this._syncVisible.bind(this)
    )

    this.signals.connect(
      Main.overview, 'hiding', this._syncVisible.bind(this)
    )

    this.signals.connect(
      this.taskbar, 'notify::width', this._updateGeometry.bind(this)
    )

    this.signals.connect(
      this.taskbar, 'notify::height', this._updateGeometry.bind(this)
    )

    this.setting.connect(
      'dock-position', this._updateGeometry.bind(this)
    )

    this.setting.connect(
      'dock-alignment', this._updateGeometry.bind(this)
    )

    this.dockbar.set_child(this.taskbar)
    this.set_child(this.dockbar)
  }

  get monitor() {
    return Main.layoutManager.primaryMonitor
  }

  enable() {
    Main.layoutManager.addChrome(this, {
      affectsInputRegion:true,
      affectsStruts: true,
      trackFullscreen: true
    })

    this._updateGeometry()
  }

  disable() {
    this.setting.disconnectAll()
    this.signals.disconnectAll()

    this.destroy()
  }

  _updateGeometry() {
    const position  = this.setting.get('dock-position')
    const alignment = this.setting.get('dock-alignment')
    const vertical  = ['left', 'right'].includes(position)

    const expand = Clutter.ActorAlign.FILL
    const custom = Clutter.ActorAlign[alignment.toUpperCase()]

    this.dockbar.x_align = vertical ? expand : custom
    this.dockbar.y_align = vertical ? custom : expand

    this.taskbar.setLayout(position, vertical)

    const width  = vertical ? -1 : this.monitor.width
    const height = vertical ? this.monitor.height - Main.panel.height : -1

    this.set_size(width, height)

    const posX = position == 'right'
      ? this.monitor.x + this.monitor.width - this.width
      : this.monitor.x

    const posY = position == 'bottom'
      ? this.monitor.y + this.monitor.height - this.height
      : this.monitor.y + Main.panel.height

    this.set_position(posX, posY)

    if (this.posClassName) {
      this.dockbar.remove_style_class_name(this.posClassName)
    }

    this.posClassName = position
    this.dockbar.add_style_class_name(this.posClassName)
  }

  _syncVisible() {
    if (Main.overview.visibleTarget) {
      this.hide()
    } else {
      this.show()
    }
  }
}
