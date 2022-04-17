import { GObject, Graphene, Clutter, Shell, St } from '#gi'
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
  }

  popupMenu() {
    super.popupMenu(St.Side.BOTTOM)
  }

  handleDragOver() {
    return DND.DragMotionResult.CONTINUE
  }

  acceptDrop() {
    return false
  }

  scaleAndFade() {}
  undoScaleAndFade() {}
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

    this.button = new AppIcon(app)
    this.set_child(this.button)

    this.button.connect(
      'scroll-event', this._onMouseScroll.bind(this)
    )
  }

  get app() {
    return this.button.app
  }

  get icon() {
    return this.button.icon
  }

  get windows() {
    return this.app.get_windows()
  }

  setIconSize(size) {
    this.icon.setIconSize(size)
  }

  setActive(active) {
    if (active) {
      this.button.add_style_pseudo_class('checked')
    } else {
      this.button.remove_style_pseudo_class('checked')
    }
  }

  show() {
    this.ease({
      scale_x: 1,
      scale_y: 1,
      opacity: 255,
      duration: 200,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD
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

  cycleWindows(direction) {
    const windows = this.windows.sort((a, b) => {
      return a.get_user_time() > b.get_user_time()
    })

    let currIndex = windows.indexOf(global.display.focus_window)
    let nextIndex = 0

    if (currIndex < 0) {
      nextIndex = currIndex + (direction == 'up' ? -1 : 1)
    }

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

    if (direction) {
      this.cycleWindows(direction)
    }

    return Clutter.EVENT_STOP
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

  createApp(app, index, iconSize) {
    const actor = new AppButton(app)
    actor.setIconSize(iconSize)

    this.mainBox.add_child(actor)
    actor.show()
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
      'notify::vertical', this._onVertical.bind(this)
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

  get iconSize() {
    return this.setting.get('icon-size', 'int')
  }

  get iconAlign() {
    return this.setting.get('icon-alignment')
  }

  _onDestroy() {
    this.setting.disconnectAll()
    this.signals.disconnectAll()
  }

  _onAppsAlignment() {
    const align = this.setting.get('show-apps-position')
    const value = Clutter.ActorAlign[align.toUpperCase()]
    const index = align == 'start' ? 0 : this.get_n_children()

    if (this.showApps !== this.get_child_at_index(index)) {
      this.remove_child(this.showApps)
      this.insert_child_at_index(this.showApps, index)
    }
  }

  _onIconAlignment() {
    const expand = Clutter.ActorAlign.FILL
    const custom = Clutter.ActorAlign[this.iconAlign.toUpperCase()]

    this.appsList.x_align = this.vertical ? expand : custom
    this.appsList.y_align = this.vertical ? custom : expand
  }

  _onIconSize() {
    this.showApps.setIconSize(this.iconSize)
    this.appItems.forEach(item => item.setIconSize(this.iconSize))
  }

  _onVertical() {
    this._onIconAlignment()

    if (this.vertical) {
      this.add_style_class_name('vertical')
    } else {
      this.remove_style_class_name('vertical')
    }
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

    const oldApps = [...this.appItems]
    const newApps = []

    for (const id in appsMap) {
      newApps.push(appsMap[id])
    }

    for (const app of running) {
      if (!(app.get_id() in appsMap)) {
        newApps.push(app)
      }
    }

    const oldIds = oldApps.map(item => item.app.get_id())
    const newIds = newApps.map(app => app.get_id())

    oldIds.forEach((id, index) => {
      if (!newIds.includes(id)) {
        oldApps[index].animateDestroy()
      }
    })

    newIds.forEach((id, index) => {
      if (!oldIds.includes(id)) {
        this.appsList.createApp(newApps[index], index, this.iconSize)
      }
    })
  }
}
