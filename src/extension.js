import { Extension } from '#extensions/extension'
import { setContext } from '#me/context'
import { Settings } from '#me/handlers'
import { Dock } from '#me/dock'
import { Panel } from '#me/panel'

export default class FlexiDock extends Extension {
  constructor(metadata) {
    super(metadata)
    setContext(this)
  }

  enable() {
    this.settings = new Settings()

    this.settings.connect(
      'mode', this._onModeChange.bind(this)
    )

    this._onModeChange()
  }

  disable() {
    this.settings?.disconnectAll()
    this.settings = null

    this.removeDock()
  }

  removeDock() {
    this.dock?.disable()
    this.dock = null
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
