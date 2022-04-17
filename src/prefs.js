import { GObject, Adw } from '#gi'
import { extensionUtils as ExtensionUtils } from '#misc'

class Preferences extends Adw.PreferencesGroup {
  static {
    GObject.registerClass(this)
  }

  constructor() {
    super({
      title: 'General'
    })
  }
}

export function init() {
  ExtensionUtils.initTranslations()
}

export function buildPrefsWidget() {
  return new Preferences()
}
