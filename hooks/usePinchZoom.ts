'use client'

import { useEffect, useRef, useState } from 'react'

interface UsePinchZoomOptions {
  minZoom?: number
  maxZoom?: number
  enabled?: boolean
  contentWidth: number
  contentHeight: number
  frameRef: React.RefObject<HTMLDivElement | null>
  transformRef: React.RefObject<HTMLDivElement | null>
  zoomLabelRefs?: Array<React.RefObject<HTMLSpanElement | null>>
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
  options: UsePinchZoomOptions
) {
  const {
    minZoom = 0.25,
    maxZoom = 2.5,
    enabled = true,
    contentWidth,
    contentHeight,
    frameRef,
    transformRef,
    zoomLabelRefs,
    onManualZoom,
  } = options

  const [isPinching, setIsPinching] = useState(false)

  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  const dimsRef = useRef({ width: contentWidth, height: contentHeight })
  dimsRef.current = { width: contentWidth, height: contentHeight }

  const onManualZoomRef = useRef(onManualZoom)
  onManualZoomRef.current = onManualZoom

  const labelRefsRef = useRef(zoomLabelRefs)
  labelRefsRef.current = zoomLabelRefs

  useEffect(() => {
    if (!enabled) return
    const container = containerRef.current
    if (!container) return

    let activeTouchPinch = false
    let startDistance = 0
    let startZoom = zoomRef.current
    let anchorX = 0
    let anchorY = 0
    let latestMidX = 0
    let latestMidY = 0
    let pendingZoom: number | null = null
    let touchRafId: number | null = null

    // Smooth damped animation state for trackpad pinch (ctrl + wheel)
    let wheelTargetZoom = zoomRef.current
    let wheelAnchorX = 0
    let wheelAnchorY = 0
    let wheelOffsetX = 0
    let wheelOffsetY = 0
    let wheelRafId: number | null = null
    let wheelActive = false

    const clamp = (val: number) => Math.min(maxZoom, Math.max(minZoom, val))

    const setPinchingClasses = (active: boolean) => {
      const frame = frameRef.current
      const transform = transformRef.current
      if (frame) frame.classList.toggle('is-pinching', active)
      if (transform) transform.classList.toggle('is-pinching', active)
    }

    const applyDirectZoomDom = (nextZoom: number, focalOffsetX: number, focalOffsetY: number, contentX: number, contentY: number) => {
      const frame = frameRef.current
      const transform = transformRef.current
      const { width, height } = dimsRef.current

      if (transform) {
        transform.style.transform = `scale3d(${nextZoom}, ${nextZoom}, 1)`
      }
      if (frame) {
        frame.style.width = `${width * nextZoom}px`
        frame.style.height = `${height * nextZoom}px`
      }

      container.scrollLeft = Math.max(0, contentX * nextZoom - focalOffsetX)
      container.scrollTop = Math.max(0, contentY * nextZoom - focalOffsetY)

      const labelText = `${Math.round(nextZoom * 100)}%`
      labelRefsRef.current?.forEach((ref) => {
        if (ref.current) ref.current.textContent = labelText
      })
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // Cancel any running wheel animation cleanly
        if (wheelRafId !== null) {
          cancelAnimationFrame(wheelRafId)
          wheelRafId = null
          wheelActive = false
        }

        const t1 = e.touches[0]
        const t2 = e.touches[1]
        const dist = getTouchDistance(t1, t2)
        if (dist <= 0) return

        const rect = container.getBoundingClientRect()
        const mid = getTouchMidpoint(t1, t2)

        activeTouchPinch = true
        startDistance = dist
        startZoom = zoomRef.current
        latestMidX = mid.x - rect.left
        latestMidY = mid.y - rect.top
        anchorX = (container.scrollLeft + latestMidX) / Math.max(0.01, startZoom)
        anchorY = (container.scrollTop + latestMidY) / Math.max(0.01, startZoom)
        pendingZoom = startZoom

        setPinchingClasses(true)
        setIsPinching(true)
        onManualZoomRef.current?.()
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!activeTouchPinch || e.touches.length !== 2) return

      // Prevent browser page zoom only during two-finger pinch inside preview container
      e.preventDefault()

      const t1 = e.touches[0]
      const t2 = e.touches[1]
      const dist = getTouchDistance(t1, t2)
      if (startDistance <= 0) return

      const rect = container.getBoundingClientRect()
      const mid = getTouchMidpoint(t1, t2)
      latestMidX = mid.x - rect.left
      latestMidY = mid.y - rect.top

      pendingZoom = clamp(startZoom * (dist / startDistance))

      if (touchRafId === null) {
        touchRafId = requestAnimationFrame(() => {
          touchRafId = null
          if (!activeTouchPinch || pendingZoom === null) return
          const nextZoom = Number(pendingZoom.toFixed(4))
          zoomRef.current = nextZoom
          applyDirectZoomDom(nextZoom, latestMidX, latestMidY, anchorX, anchorY)
        })
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (activeTouchPinch && e.touches.length < 2) {
        activeTouchPinch = false
        if (touchRafId !== null) {
          cancelAnimationFrame(touchRafId)
          touchRafId = null
        }

        const finalZoom = Number((pendingZoom ?? zoomRef.current).toFixed(3))
        zoomRef.current = finalZoom
        applyDirectZoomDom(finalZoom, latestMidX, latestMidY, anchorX, anchorY)

        setPinchingClasses(false)
        setIsPinching(false)
        setZoom(finalZoom)
      }
    }

    const stepWheelZoom = () => {
      const current = zoomRef.current
      const diff = wheelTargetZoom - current

      if (Math.abs(diff) < 0.0015) {
        const finalZoom = Number(wheelTargetZoom.toFixed(3))
        zoomRef.current = finalZoom
        applyDirectZoomDom(finalZoom, wheelOffsetX, wheelOffsetY, wheelAnchorX, wheelAnchorY)
        wheelRafId = null
        wheelActive = false
        setPinchingClasses(false)
        setIsPinching(false)
        setZoom(finalZoom)
        return
      }

      // Smooth exponential interpolation toward target zoom at display refresh rate
      const nextZoom = current + diff * 0.28
      zoomRef.current = nextZoom
      applyDirectZoomDom(nextZoom, wheelOffsetX, wheelOffsetY, wheelAnchorX, wheelAnchorY)
      wheelRafId = requestAnimationFrame(stepWheelZoom)
    }

    const handleWheel = (e: WheelEvent) => {
      // Desktop trackpad pinch fires ctrlKey + wheel
      if (!e.ctrlKey) return
      e.preventDefault()

      const rect = container.getBoundingClientRect()
      wheelOffsetX = e.clientX - rect.left
      wheelOffsetY = e.clientY - rect.top

      const baseZoom = wheelActive ? wheelTargetZoom : zoomRef.current
      const currentVisibleZoom = zoomRef.current

      wheelAnchorX = (container.scrollLeft + wheelOffsetX) / Math.max(0.01, currentVisibleZoom)
      wheelAnchorY = (container.scrollTop + wheelOffsetY) / Math.max(0.01, currentVisibleZoom)

      const factor = Math.exp(-e.deltaY * 0.0045)
      wheelTargetZoom = clamp(baseZoom * factor)

      if (!wheelActive) {
        wheelActive = true
        setPinchingClasses(true)
        setIsPinching(true)
        onManualZoomRef.current?.()
      }

      if (wheelRafId === null) {
        wheelRafId = requestAnimationFrame(stepWheelZoom)
      }
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true })
    container.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      if (touchRafId !== null) cancelAnimationFrame(touchRafId)
      if (wheelRafId !== null) cancelAnimationFrame(wheelRafId)
      setPinchingClasses(false)
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
      container.removeEventListener('touchcancel', handleTouchEnd)
      container.removeEventListener('wheel', handleWheel)
    }
  }, [containerRef, frameRef, transformRef, enabled, minZoom, maxZoom, setZoom])

  return { isPinching }
}
