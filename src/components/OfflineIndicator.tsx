import { useEffect, useState } from 'react'

export function OfflineIndicator() {
  const [cached, setCached] = useState(false)

  useEffect(() => {
    if (!('caches' in window)) return
    void caches
      .keys()
      .then((keys) => setCached(keys.length > 0))
      .catch(() => setCached(false))
  }, [])

  if (!cached) return null
  return (
    <span className="offline-indicator muted small" title="Chapters cache to your device as you read">
      Offline-ready
    </span>
  )
}
