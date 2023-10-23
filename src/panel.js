import { GObject, Clutter, St } from '#gi'
import { InjectionManager } from '#extensions/extension';
import { main as Main } from '#ui'

import { Signals, Settings } from '#me/handlers'
import { TaskBar } from '#me/taskbar'

class PanelBox extends St.BoxLayout {
  static {
    GObject.registerClass(this)
  }

  constructor(side) {
    super({
      name: `flexi-panel-box-${side}`
    })

    this.panelKey = `_${side}Box`
    this.panelBox = Main.panel[this.panelKey]
  }

  enable() {
    this.panelBox.set_height(36)
    this.panelBox.set_y_align(Clutter.ActorAlign.CENTER)

    Main.panel.remove_child(this.panelBox)
    this.add_child(this.panelBox)

    Main.panel[this.panelKey] = this
    Main.panel.add_child(this)
  }

  disable() {
    this.remove_all_children()
    Main.panel.remove_child(this)

    this.panelBox.set_height(-1)
    this.panelBox.set_y_align(Clutter.ActorAlign.FILL)

    Main.panel[this.panelKey] = this.panelBox
    Main.panel.add_child(this.panelBox)

    this.panelBox = null
    this.destroy()
  }

  insert_child_at_index(actor, index) {
    this.panelBox.insert_child_at_index(actor, index)
  }

  insert_child_above(actor, sibling) {
    this.panelBox.insert_child_above(actor, sibling)
  }

  insert_child_below(actor, sibling) {
    this.panelBox.insert_child_below(actor, sibling)
  }

  replace_child(oldActor, newActor) {
    this.panelBox.replace_child(oldActor, newActor)
  }

  add_child(actor) {
    if (actor === this.panelBox) {
      super.add_child(actor)
    } else if (actor instanceof Panel) {
      super.insert_child_at_index(actor, 0)
    } else {
      this.panelBox.add_child(actor)
    }
  }

  remove_child(actor) {
    if (actor === this.panelBox || actor instanceof Panel) {
      super.remove_child(actor)
    } else {
      this.panelBox.remove_child(actor)
    }
  }
}

export class Panel extends St.Bin {
  static {
    GObject.registerClass(this)
  }

  constructor() {
    super({
      name: 'FlexiPanel',
      style_class: 'flexi-panel',
      track_hover: true,
      reactive: true,
      can_focus: true
    })

    this.leftBox   = new PanelBox('left')
    this.centerBox = new PanelBox('center')
    this.rightBox  = new PanelBox('right')

    this.taskbar = new TaskBar()
    this.signals = new Signals()
    this.setting = new Settings()
    this.injects = new InjectionManager()

    this.signals.connect(
      Main.layoutManager, 'monitors-changed', this._updatePosition.bind(this)
    )

    this.signals.connect(
      this.taskbar, 'size-changed', this._updatePosition.bind(this)
    )

    this.setting.connect(
      'panel-position', this._updatePosition.bind(this)
    )

    this.set_child(this.taskbar)
  }

  get monitor() {
    return Main.layoutManager.primaryMonitor
  }

  enable() {
    this.leftBox.add_child(this)

    this.leftBox.enable()
    this.centerBox.enable()
    this.rightBox.enable()

    Main.overview.dash.hide()
    Main.overview.dash.height = 0

    Main.uiGroup.add_style_class_name('flexi-panel-enabled')
    Main.panel.add_style_class_name('flexi-panel-container')

    Main.panel.statusArea.activities.hide()

    this._updatePosition()
    this._injectAllocate()
  }

  disable() {
    this.leftBox.remove_child(this)

    this.leftBox.disable()
    this.centerBox.disable()
    this.rightBox.disable()

    this.setting.disconnectAll()
    this.signals.disconnectAll()
    this.injects.clear()

    Main.panel.statusArea.activities.show()

    Main.uiGroup.remove_style_class_name('flexi-panel-enabled')
    Main.panel.remove_style_class_name('flexi-panel-container')

    Main.overview.dash.show()
    Main.overview.dash.height = -1
    Main.overview.dash.setMaxSize(-1, -1)

    Main.panel.set_height(-1)
    Main.panel.queue_relayout()

    Main.layoutManager.panelBox.set_position(0, 0)

    this.destroy()
  }

  vfunc_get_preferred_width(_forHeight) {
    if (this.monitor) {
      return [0, this.monitor.width]
    } else {
      return [0, 0]
    }
  }

  _updatePosition() {
    const position = this.setting.get('panel-position')

    this.taskbar.setLayout(position, false)

    let [posX, posY, dash] = [0, this.monitor.y, 30]
    let [m, naturalHeight] = this.get_preferred_height(-1)

    if (position == 'bottom') {
      posY = this.monitor.y + this.monitor.height - naturalHeight
      dash = naturalHeight
    }

    Main.overview.dash.height = dash

    Main.panel.set_height(naturalHeight)
    Main.panel.queue_relayout()

    Main.layoutManager.panelBox.set_position(posX, posY)
  }

  _injectAllocate() {
    const proto = Object.getPrototypeOf(Main.panel)

    this.injects.overrideMethod(proto, 'vfunc_allocate', () => {
      return box => this._doPanelAllocate(Main.panel, box)
    })
  }

  _doPanelAllocate(actor, box) {
    actor.set_allocation(box)

    const leftBox     = actor._leftBox
    const centerBox   = actor._centerBox
    const rightBox    = actor._rightBox
    const childBox    = new Clutter.ActorBox()

    const centerWidth = centerBox.get_preferred_width(-1)[1]
    const rightWidth  = rightBox.get_preferred_width(-1)[1]

    const allocWidth  = box.x2 - box.x1
    const allocHeight = box.y2 - box.y1
    const sideWidth   = Math.floor(allocWidth - centerWidth - rightWidth)

    const rtlTextDir  = actor.get_text_direction() == Clutter.TextDirection.RTL

    childBox.y1 = 0
    childBox.y2 = allocHeight

    if (rtlTextDir) {
      childBox.x1 = allocWidth - sideWidth
      childBox.x2 = allocWidth
    } else {
      childBox.x1 = 0
      childBox.x2 = sideWidth
    }

    leftBox.allocate(childBox)

    childBox.y1 = 0
    childBox.y2 = allocHeight

    if (rtlTextDir) {
      childBox.x1 = rightWidth
      childBox.x2 = childBox.x1 + centerWidth
    } else {
      childBox.x1 = allocWidth - centerWidth - rightWidth
      childBox.x2 = childBox.x1 + centerWidth
    }

    centerBox.allocate(childBox)

    childBox.y1 = 0
    childBox.y2 = allocHeight

    if (rtlTextDir) {
      childBox.x1 = 0
      childBox.x2 = rightWidth
    } else {
      childBox.x1 = allocWidth - rightWidth
      childBox.x2 = allocWidth
    }

    rightBox.allocate(childBox)
  }
}
