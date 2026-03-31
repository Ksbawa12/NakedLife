import { useMemo } from 'react'
import { Capacitor } from '@capacitor/core'

/** True when running inside the Capacitor Android WebView (not mobile Chrome). */
export function useAndroidNative(): boolean {
  return useMemo(
    () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android',
    [],
  )
}
