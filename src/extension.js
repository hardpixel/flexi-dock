import { Settings } from '#me/handlers'
import { Dock } from '#me/dock'
import { Panel } from '#me/panel'

class Extension {
  enable() {
    this.settings = new Settings()

    this.settings.connect(
      'mode', this._onModeChange.bind(this)
    )

    this._onModeChange()
  }

  disable() {
    if (this.settings) {
      this.settings.disconnectAll()
      this.settings = null
    }

    this.removeDock()
  }

  removeDock() {
    if (this.dock) {
      this.dock.disable()
      this.dock = null
    }
  }

  _onModeChange() {
    const mode = this.settings.get('mode')
    const type = mode == 'dock' ? Dock : Panel

    if (!(this.dock instanceof type)) {
      this.removeDock()

      this.dock = new type()
      this.dock.enable()
    }
  }
}

export function init() {
  return new Extension()
}
