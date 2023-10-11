let extensionContext = null

export function setContext(object) {
  extensionContext = object
}

export function useContext() {
  return extensionContext
}

export function useSettings() {
  return extensionContext.getSettings()
}
