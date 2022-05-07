import { GLib, GObject, Graphene, Clutter, Meta, Shell, St } from '#gi'
import { appDisplay as AppDisplay } from '#ui'
import { appFavorites as AppFavorites } from '#ui'
import { dnd as DND } from '#ui'
import { main as Main } from '#ui'
import { Signals, Settings } from '#me/handlers'

class TaskBarIcon extends St.Bin {
  static {
    GObject.registerClass(this)
  }

  constructor(params) {
    super({
      style_class: 'overview-icon'
    })

    this.icon = new St.Icon(params)
    this.set_child(this.icon)
  }

  setName(name) {
    this.icon.set_icon_name(name)
  }

  setSize(size) {
    this.icon.set_icon_size(size)
  }
}

class TaskBarSeparator extends St.Widget {
  static {
    GObject.registerClass(this)
  }

  constructor() {
    super({
      style_class: 'dash-separator',
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER
    })

    this.sideSize = 0
    this.vertical = false
  }

  setSize(size) {
    this.sideSize = size
    this.updateGeometry()
  }

  setVertical(vertical) {
    this.vertical = vertical
    this.updateGeometry()
  }

  updateGeometry() {
    if (this.vertical) {
      this.set_size(this.sideSize, 1)
    } else {
      this.set_size(1, this.sideSize)
    }
  }
}

class TaskBarItem extends St.Bin {
  static {
    GObject.registerClass(this)
  }

  constructor(params) {
    super({
      style_class: 'dash-item-container',
      x_align: Clutter.ActorAlign.START,
      y_align: Clutter.ActorAlign.START,
      ...params
    })

    this.label = new St.Label({
      style_class: 'dash-label'
    })

    this.label.hide()
    Main.layoutManager.addChrome(this.label)

    this.side = St.Side.BOTTOM
  }

  setSide(side) {
    this.side = St.Side[side.toUpperCase()]
    this.hideLabel()
  }

  showLabel() {
    this.label.opacity = 0
    this.label.show()

    const [stageX, stageY] = this.get_transformed_position()
    const [stageW, stageH] = global.stage.get_size()

    const node = this.label.get_theme_node()
    const ngap = node.get_length('-y-offset')
    const vert = this.side == St.Side.LEFT || this.side == St.Side.RIGHT

    let xPos = 0
    let yPos = 0

    if (vert) {
      const offset = Math.floor((this.height - this.label.height) / 2)
      yPos = Math.clamp(stageY + offset, 0, stageH - this.label.height)
    } else {
      const offset = Math.floor((this.width - this.label.width) / 2)
      xPos = Math.clamp(stageX + offset, 0, stageW - this.label.width)
    }

    if (this.side == St.Side.LEFT) {
      xPos = stageX + this.width + ngap
    }

    else if (this.side == St.Side.RIGHT) {
      xPos = stageX - this.label.width - ngap
    }

    else if (this.side == St.Side.TOP) {
      yPos = stageY + this.height + ngap
    }

    else if (this.side == St.Side.BOTTOM) {
      yPos = stageY - this.label.height - ngap
    }

    this.label.set_position(xPos, yPos)

    this.label.ease({
      opacity: 255,
      duration: 150,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD
    })
  }

  setLabelText(text) {
    this.label.set_text(text)
    this.child.accessible_name = text
  }

  hideLabel() {
    this.label.ease({
      opacity: 0,
      duration: 100,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD,
      onComplete: () => this.label.hide()
    })
  }

  hookLabel(actor) {
    actor.connect(
      'clicked', this.hideLabel.bind(this)
    )

    Main.overview.connectObject(
      'hiding', this.hideLabel.bind(this), actor
    )

    actor.connect('notify::hover', () => {
      if (actor.get_hover()) {
        this.showLabel()
      } else {
        this.hideLabel()
      }
    })
  }
}

class AppIcon extends AppDisplay.AppIcon {
  static {
    GObject.registerClass(this)
  }

  constructor(app) {
    super(app, {
      setSizeManually: true,
      showLabel: false
    })

    this.side = St.Side.BOTTOM
  }

  popupMenu() {
    super.popupMenu(this.side)
  }

  handleDragOver() {
    return DND.DragMotionResult.CONTINUE
  }

  acceptDrop() {
    return false
  }

  scaleAndFade() {}
  undoScaleAndFade() {}

  setSide(side) {
    this.side = side
    this.alignIndicator(this.side)

    if (this._menu) {
      this._menu.destroy()
      this._menu = null
    }
  }

  alignIndicator(side = St.Side.BOTTOM) {
    const xAlign = ['CENTER', 'END', 'CENTER', 'START']
    const yAlign = ['START', 'CENTER', 'END', 'CENTER']

    this._dot.x_align = Clutter.ActorAlign[xAlign[side]]
    this._dot.y_align = Clutter.ActorAlign[yAlign[side]]
  }
}

class AppButton extends TaskBarItem {
  static {
    GObject.registerClass(this)
  }

  constructor(app) {
    super({
      pivot_point: new Graphene.Point({ x: .5, y: .5 }),
      scale_x: 0,
      scale_y: 0,
      opacity: 0
    })

    this.signals = new Signals()
    this.appIcon = new AppIcon(app)

    this.signals.connect(
      app, 'windows-changed', this._onWindowsChanged.bind(this)
    )

    this.appIcon.connect(
      'scroll-event', this._onMouseScroll.bind(this)
    )

    this.connect(
      'notify::position', this._onPositionChanged.bind(this)
    )

    this.connect(
      'destroy', this._onDestroy.bind(this)
    )

    this.set_child(this.appIcon)

    this.setLabelText(app.get_name())
    this.hookLabel(this.appIcon)
  }

  get app() {
    return this.appIcon.app
  }

  get icon() {
    return this.appIcon.icon
  }

  get windows() {
    return this.app.get_windows()
  }

  setSide(side) {
    super.setSide(side)
    this.appIcon.setSide(this.side)
    this.updateIconGeometry()
  }

  setIconSize(size) {
    this.icon.setIconSize(size)
    this.updateIconGeometry()
  }

  setActive(active) {
    if (active) {
      this.appIcon.add_style_pseudo_class('checked')
    } else {
      this.appIcon.remove_style_pseudo_class('checked')
    }
  }

  show() {
    this.ease({
      scale_x: 1,
      scale_y: 1,
      opacity: 255,
      duration: 200,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD,
      onComplete: () => this.updateIconGeometry()
    })
  }

  animateDestroy() {
    this.ease({
      scale_x: 0,
      scale_y: 0,
      opacity: 0,
      duration: 200,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD,
      onComplete: () => this.destroy()
    })
  }

  updateIconGeometry() {
    if (this.get_stage() == null)
      return

    const [posX, posY] = this.get_transformed_position()
    const [boxW, boxH] = this.get_transformed_size()

    const rect = new Meta.Rectangle({
      x: posX + (boxW / 2),
      y: posY + (boxH / 2)
    })

    this.windows.forEach(win => {
      if (win.get_monitor() == Main.layoutManager.primaryIndex) {
        win.set_icon_geometry(rect)
      }
    })
  }

  activateLastWindow() {
    const windows = this.windows.sort((a, b) => {
      return b.get_user_time() - a.get_user_time()
    })

    Main.activateWindow(windows[0])
  }

  cycleWindows(direction) {
    const windows = this.windows.sort((a, b) => {
      return a.get_stable_sequence() - b.get_stable_sequence()
    })

    let currIndex = windows.indexOf(global.display.focus_window)

    if (currIndex < 0) {
      return this.activateLastWindow()
    }

    let nextIndex = currIndex + (direction == 'up' ? -1 : 1)

    if (nextIndex === windows.length) {
      nextIndex = 0
    } else if (nextIndex < 0) {
      nextIndex = windows.length - 1
    }

    if (currIndex != nextIndex) {
      Main.activateWindow(windows[nextIndex])
    }
  }

  _onMouseScroll(actor, event) {
    if (!this.windows.length) {
      return Clutter.EVENT_PROPAGATE
    }

    let direction = null

    switch (event.get_scroll_direction()) {
      case Clutter.ScrollDirection.UP:
      case Clutter.ScrollDirection.LEFT:
        direction = 'up'
        break
      case Clutter.ScrollDirection.DOWN:
      case Clutter.ScrollDirection.RIGHT:
        direction = 'down'
        break
    }

    if (direction && !this._scrollDeadTimeId) {
      this._scrollDeadTimeId = GLib.timeout_add(
        GLib.PRIORITY_DEFAULT, 300, () => this._scrollDeadTimeId = 0
      )

      this.cycleWindows(direction)
    }

    return Clutter.EVENT_STOP
  }

  _onWindowsChanged() {
    this.updateIconGeometry()
  }

  _onPositionChanged() {
    this.updateIconGeometry()
  }

  _onDestroy() {
    this.signals.disconnectAll()
  }
}

class ShowAppsButton extends TaskBarItem {
  static {
    GObject.registerClass(this)
  }

  constructor() {
    super({
      name: 'FlexiShowApps'
    })

    this.button = new St.Button({
      style_class: 'show-apps',
      track_hover: true,
      can_focus: true
    })

    this.icon = new TaskBarIcon({
      style_class: 'show-apps-icon',
      icon_name: 'view-app-grid-symbolic'
    })

    this.button.connect(
      'clicked', this._onClicked.bind(this)
    )

    this.button.set_child(this.icon)
    this.set_child(this.button)

    this.setLabelText(_('Show Applications'))
    this.hookLabel(this.button)
  }

  setIconSize(size) {
    this.icon.setSize(size)
  }

  _onClicked() {
    if (Main.overview.visible) {
      Main.overview.hide()
    } else {
      Main.overview.showApps()
    }
  }
}

class AppsContainer extends St.ScrollView {
  static {
    GObject.registerClass(this)
  }

  constructor() {
    super({
      clip_to_allocation: true,
      x_expand: true,
      y_expand: true
    })

    this.mainBox = new St.BoxLayout({
      style_class: 'flex-taskbar-list',
      x_align: Clutter.ActorAlign.START,
      y_align: Clutter.ActorAlign.START,
      x_expand: true,
      y_expand: true
    })

    this.set_policy(
      St.PolicyType.EXTERNAL, St.PolicyType.EXTERNAL
    )

    this.add_actor(this.mainBox)
  }

  get items() {
    return this.mainBox.get_children().filter(
      child => child instanceof AppButton
    )
  }

  setAlign(align, vertical) {
    const expand = Clutter.ActorAlign.FILL
    const custom = Clutter.ActorAlign[align.toUpperCase()]

    this.x_align = vertical ? expand : custom
    this.y_align = vertical ? custom : expand
  }
}

export class TaskBar extends St.BoxLayout {
  static {
    GObject.registerClass(this)
  }

  constructor() {
    super({
      style_class: 'flexi-taskbar'
    })

    this.fixedSide = 'bottom'

    this.wmTracker = Shell.WindowTracker.get_default()
    this.appSystem = Shell.AppSystem.get_default()
    this.favorites = AppFavorites.getAppFavorites()

    this._workerId = Main.initializeDeferredWork(
      this, this._redisplay.bind(this)
    )

    this.signals = new Signals()
    this.setting = new Settings()

    this.signals.connect(
      this.appSystem, 'installed-changed', this._queueRedisplay.bind(this)
    )

    this.signals.connect(
      this.appSystem, 'app-state-changed', this._queueRedisplay.bind(this)
    )

    this.signals.connect(
      this.favorites, 'changed', this._queueRedisplay.bind(this)
    )

    this.signals.connect(
      this.wmTracker, 'notify::focus-app', this._onFocusApp.bind(this)
    )

    this.setting.connect(
      'show-apps-position', this._onAppsAlignment.bind(this)
    )

    this.setting.connect(
      'icon-alignment', this._onIconAlignment.bind(this)
    )

    this.setting.connect(
      'icon-size', this._onIconSize.bind(this)
    )

    this.showApps = new ShowAppsButton()
    this.add_child(this.showApps)

    this.appsList = new AppsContainer()
    this.add_child(this.appsList)

    this.bind_property(
      'vertical', this.appsBox, 'vertical', GObject.BindingFlags.DEFAULT
    )

    this.connect(
      'destroy', this._onDestroy.bind(this)
    )

    this._onAppsAlignment()
    this._onIconAlignment()
    this._onIconSize()
  }

  get appsBox() {
    return this.appsList.mainBox
  }

  get appItems() {
    return this.appsList.items
  }

  get showAppsAlign() {
    return this.setting.get('show-apps-position')
  }

  get iconSize() {
    return this.setting.get('icon-size', 'int')
  }

  get iconAlign() {
    return this.setting.get('icon-alignment')
  }

  toggleClassName(name, enable) {
    if (enable) {
      this.add_style_class_name(name)
    } else {
      this.remove_style_class_name(name)
    }
  }

  setLayout(side, vertical) {
    this.fixedSide = side

    this.set_vertical(vertical)
    this.toggleClassName('vertical', vertical)

    this.showApps.setSide(side)
    this.appItems.forEach(item => item.setSide(side))
    this._onIconAlignment()

    this.separator && this.separator.setVertical(vertical)
  }

  createApp(app) {
    const button = new AppButton(app)

    button.setIconSize(this.iconSize)
    button.setSide(this.fixedSide)

    return button
  }

  _onDestroy() {
    this.setting.disconnectAll()
    this.signals.disconnectAll()
  }

  _onAppsAlignment() {
    const total = this.get_n_children()
    const index = this.showAppsAlign == 'end' ? total : 0

    if (this.showApps !== this.get_child_at_index(index)) {
      this.remove_child(this.showApps)
      this.insert_child_at_index(this.showApps, index)
    }
  }

  _onIconAlignment() {
    this.appsList.setAlign(this.iconAlign, this.vertical)
  }

  _onIconSize() {
    this.showApps.setIconSize(this.iconSize)
    this.appItems.forEach(item => item.setIconSize(this.iconSize))

    this.separator && this.separator.setSize(this.iconSize)
  }

  _onFocusApp() {
    const focused = this.wmTracker.focus_app
    const focusId = focused && focused.get_id()

    this.appItems.forEach(item => {
      item.setActive(focusId == item.app.get_id())
    })
  }

  _queueRedisplay() {
    Main.queueDeferredWork(this._workerId)
  }

  _redisplay() {
    const appsMap = this.favorites.getFavoriteMap()
    const running = this.appSystem.get_running()

    const oldList = this.appItems
    const oldApps = oldList.map(item => item.app)
    const newApps = []

    for (const id in appsMap) {
      newApps.push(appsMap[id])
    }

    for (const app of running) {
      if (!(app.get_id() in appsMap)) {
        newApps.push(app)
      }
    }

    const create = []
    const remove = []

    let newIndex = 0
    let oldIndex = 0

    while (newIndex < newApps.length || oldIndex < oldApps.length) {
      const oldApp = oldApps.length > oldIndex ? oldApps[oldIndex] : null
      const newApp = newApps.length > newIndex ? newApps[newIndex] : null

      if (oldApp == newApp) {
        oldIndex++
        newIndex++
        continue
      }

      if (oldApp && !newApps.includes(oldApp)) {
        remove.push(oldList[oldIndex])
        oldIndex++
        continue
      }

      if (newApp && !oldApps.includes(newApp)) {
        create.push({ item: this.createApp(newApp), pos: newIndex })
        newIndex++
        continue
      }

      const nextApp = newApps.length > newIndex + 1 ? newApps[newIndex + 1] : null
      const addHere = nextApp && nextApp == oldApp
      const removed = remove.some(item => item.app == newApp)

      if (addHere || removed) {
        create.push({ item: this.createApp(newApp), pos: newIndex + remove.length })
        newIndex++
      } else {
        remove.push(oldList[oldIndex])
        oldIndex++
      }
    }

    create.forEach(({ item, pos }) => {
      this.appsBox.insert_child_at_index(item, pos)
    })

    remove.forEach(child => {
      if (newApps.includes(child.app)) {
        child.destroy()
      } else {
        child.animateDestroy()
      }
    })

    create.forEach(({ item }) => {
      item.show()
    })

    const favsSize = Object.keys(appsMap).length
    const appsSize = oldList.length + create.length - remove.length

    if (favsSize > 0 && favsSize < appsSize) {
      if (!this.separator) {
        this.separator = new TaskBarSeparator()
        this.separator.setSize(this.iconSize)
        this.separator.setVertical(this.vertical)

        this.appsBox.add_child(this.separator)
      }

      this.appsBox.set_child_at_index(this.separator, favsSize)
    } else if (this.separator) {
      this.separator.destroy()
      this.separator = null
    }

    this.appsBox.queue_relayout()
  }
}
