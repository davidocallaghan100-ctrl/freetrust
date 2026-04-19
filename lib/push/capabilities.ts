export function getPushCapabilities() {
  if (typeof window === 'undefined') return { supportsWebPush: false, isStandalone: false, isIOS: false, iOSVersion: null }
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as { standalone?: boolean }).standalone === true
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const iOSVersion = isIOS
    ? parseFloat((navigator.userAgent.match(/OS (\d+)_/) ?? [])[1] ?? '0')
    : null
  const supportsWebPush = 'PushManager' in window && 'serviceWorker' in navigator
  return { isStandalone, isIOS, iOSVersion, supportsWebPush }
}

export function canReceivePush(): boolean {
  const { supportsWebPush, isIOS, iOSVersion, isStandalone } = getPushCapabilities()
  if (!supportsWebPush) return false
  if (isIOS) return (iOSVersion ?? 0) >= 16.4 && isStandalone
  return true
}
