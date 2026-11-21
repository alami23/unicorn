'use client'

import { useEffect, useRef, useState } from 'react'

interface UsePinchZoomOptions {
  minZoom?: number
  maxZoom?: number
  enabled?: boolean
  onManualZoom?: () => void
}

function getTouchDistance(t1: Touch, t2: Touch) {
  const dx = t1.clientX - t2.clientX
  const dy = t1.clientY - t2.clientY
  return Math.hypot(dx, dy)
}

function getTouchMidpoint(t1: Touch, t2: Touch) {
  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  }
}

export function usePinchZoom(
  containerRef: React.RefObject<HTMLDivElement | null>,
  zoom: number,
  setZoom: React.Dispatch<React.SetStateAction<number>>,
  options: UsePinchZoomOptions = {}
) {
  const { minZoom = 0.25, maxZoom = 2.5, enabled = true, onManualZoom } = options
  const [isPinching, setIsPinching] = useState(false)

  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  const onManualZoomRef = useRef(onManualZoom)
  onManualZoomRef.current = onManualZoom

  useEffect(() => {
    if (!enabled) return
    const el = containerRef.current
    if (!el) return

    let activePinch = false
    let startDistance = 0
    let startZoom = zoomRef.current
    let contentAnchorX = 0
    let contentAnchorY = 0
    let rafId: number | null = null

    const clamp = (val: number) => Math.min(maxZoom, Math.max(minZoom, val))

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0]
        const t2 = e.touches[1]
        const dist = getTouchDistance(t1, t2)
        if (dist <= 0) return

        const rect = el.getBoundingClientRect()
        const mid = getTouchMidpoint(t1, t2)

        activePinch = true
        startDistance = dist
        startZoom = zoomRef.current
        contentAnchorX = (el.scrollLeft + (mid.x - rect.left)) / Math.max(0.01, startZoom)
        contentAnchorY = (el.scrollTop + (mid.y - rect.top)) / Math.max(0.01, startZoom)

        setIsPinching(true)
        onManualZoomRef.current?.()
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!activePinch || e.touches.length !== 2) return

      // Intercept only two-finger pinch inside the invoice preview container
      // so global page scaling remains unaffected while single-finger scroll stays native
      e.preventDefault()

      const t1 = e.touches[0]
      const t2 = e.touches[1]
      const dist = getTouchDistance(t1, t2)
      if (startDistance <= 0) return

      const nextZoom = Number(clamp(startZoom * (dist / startDistance)).toFixed(3))
      const rect = el.getBoundingClientRect()
      const mid = getTouchMidpoint(t1, t2)

      zoomRef.current = nextZoom
      setZoom(nextZoom)

      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        el.scrollLeft = Math.max(0, contentAnchorX * nextZoom - (mid.x - rect.left))
        el.scrollTop = Math.max(0, contentAnchorY * nextZoom - (mid.y - rect.top))
      })
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (activePinch && e.touches.length < 2) {
        activePinch = false
        setIsPinching(false)
      }
    }

    const handleWheel = (e: WheelEvent) => {
      // Trackpad pinch gesture on desktop browsers fires ctrlKey + wheel
      if (!e.ctrlKey) return
      e.preventDefault()

      const currentZoom = zoomRef.current
      const factor = Math.exp(-e.deltaY * 0.004)
      const nextZoom = Number(clamp(currentZoom * factor).toFixed(3))
      if (nextZoom === currentZoom) return

      const rect = el.getBoundingClientRect()
      const offsetX = e.clientX - rect.left
      const offsetY = e.clientY - rect.top
      const anchorX = (el.scrollLeft + offsetX) / Math.max(0.01, currentZoom)
      const anchorY = (el.scrollTop + offsetY) / Math.max(0.01, currentZoom)

      zoomRef.current = nextZoom
      onManualZoomRef.current?.()
      setZoom(nextZoom)

      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        el.scrollLeft = Math.max(0, anchorX * nextZoom - offsetX)
        el.scrollTop = Math.max(0, anchorY * nextZoom - offsetY)
      })
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true })
    el.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
      el.removeEventListener('touchcancel', handleTouchEnd)
      el.removeEventListener('wheel', handleWheel)
    }
  }, [containerRef, enabled, minZoom, maxZoom, setZoom])

  return { isPinching }
}
