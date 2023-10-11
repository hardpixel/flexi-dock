import { useSettings } from '#me/context'

export class Signals {
  constructor() {
    this.store = new Map()
  }

  connect(object, prop, callback) {
    const id = object.connect(prop, callback)
    this.store.set(id, object)

    return id
  }

  disconnect(id) {
    if (this.store.has(id)) {
      this.store.get(id).disconnect(id)
      this.store.delete(id)
    }
  }

  disconnectAll() {
    this.store.forEach((object, id) => object.disconnect(id))
    this.store.clear()
  }
}

export class Settings {
  constructor(proxy) {
    this.store = new Set()
    this.proxy = proxy || useSettings()
  }

  get(setting, type = 'string') {
    return this.proxy[`get_${type}`](setting)
  }

  set(setting, value, type = 'string') {
    return this.proxy[`set_${type}`](setting, value)
  }

  connect(setting, callback) {
    const id = this.proxy.connect(`changed::${setting}`, callback)
    this.store.add(id)

    return id
  }

  disconnect(id) {
    if (this.store.has(id)) {
      this.proxy.disconnect(id)
      this.store.delete(id)
    }
  }

  disconnectAll() {
    this.store.forEach(id => this.proxy.disconnect(id))
    this.store.clear()
  }
}
