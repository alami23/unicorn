'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  X,
  Camera,
  RefreshCw,
  QrCode,
  Volume2,
  VolumeX,
  AlertCircle,
  CheckCircle2,
  Zap,
  ZapOff,
  Scan,
  ShieldAlert,
  SwitchCamera,
  Sparkles,
  Pin
} from 'lucide-react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'

export interface BarcodeScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onScanResult: (result: string) => void
  targetInputRef?: React.RefObject<HTMLInputElement | null>
  title?: string
  subtitle?: string
}

/**
 * Helper utility to insert value into an HTML input element
 * and dispatch synthetic React input & change events.
 */
export function triggerInputChange(inputElement: HTMLInputElement | null, value: string) {
  if (!inputElement) return
  try {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set
    
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(inputElement, value)
    } else {
      inputElement.value = value
    }

    // Dispatch input event for React controlled inputs
    const inputEvent = new Event('input', { bubbles: true })
    inputElement.dispatchEvent(inputEvent)

    // Dispatch change event for standard listeners
    const changeEvent = new Event('change', { bubbles: true })
    inputElement.dispatchEvent(changeEvent)
  } catch (err) {
    console.error('Error dispatching input change event:', err)
  }
}

export function BarcodeScannerModal({
  isOpen,
  onClose,
  onScanResult,
  targetInputRef,
  title = 'Barcode & QR Scanner',
  subtitle = 'Scan 1D barcodes or QR codes directly using your device camera'
}: BarcodeScannerModalProps) {
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('scannerSoundEnabled')
      return saved !== null ? saved === 'true' : true
    }
    return true
  })
  const [lastScanned, setLastScanned] = useState<string | null>(null)
  const [engineUsed, setEngineUsed] = useState<string>('')

  // Save sound preference to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('scannerSoundEnabled', String(soundEnabled))
    }
  }, [soundEnabled])

  // Multi-camera support & torch states
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('defaultCameraId') || ''
    }
    return ''
  })
  const [isDefaultCamera, setIsDefaultCamera] = useState<boolean>(false)
  const [isTorchSupported, setIsTorchSupported] = useState(false)
  const [isTorchOn, setIsTorchOn] = useState(false)

  // Update isDefaultCamera state whenever selectedDeviceId changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDefaultId = localStorage.getItem('defaultCameraId')
      setIsDefaultCamera(!!selectedDeviceId && savedDefaultId === selectedDeviceId)
    }
  }, [selectedDeviceId])

  // Refs for managing media stream and scan loops
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const videoTrackRef = useRef<MediaStreamTrack | null>(null)
  const animFrameIdRef = useRef<number | null>(null)
  const zxingControlsRef = useRef<any>(null)
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null)
  const isScanningActiveRef = useRef<boolean>(false)

  // Soft beep feedback sound on successful detection
  const playBeep = useCallback(() => {
    if (!soundEnabled) return
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const audioCtx = new AudioCtx()
      
      // Dual-tone pleasant success beep
      const osc1 = audioCtx.createOscillator()
      const osc2 = audioCtx.createOscillator()
      const gain = audioCtx.createGain()

      osc1.type = 'sine'
      osc2.type = 'triangle'
      osc1.frequency.setValueAtTime(880, audioCtx.currentTime) // A5
      osc2.frequency.setValueAtTime(1760, audioCtx.currentTime) // A6

      gain.gain.setValueAtTime(0.15, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.22)

      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(audioCtx.destination)

      osc1.start()
      osc2.start()
      osc1.stop(audioCtx.currentTime + 0.22)
      osc2.stop(audioCtx.currentTime + 0.22)
    } catch (e) {
      // Audio context block or not allowed before user gesture ignored
    }
  }, [soundEnabled])

  // Stop camera stream & cleanup all resources
  const stopCamera = useCallback(() => {
    isScanningActiveRef.current = false

    // Cancel animation frame loop if running
    if (animFrameIdRef.current !== null) {
      cancelAnimationFrame(animFrameIdRef.current)
      animFrameIdRef.current = null
    }

    // Stop ZXing controls if active
    if (zxingControlsRef.current) {
      try {
        zxingControlsRef.current.stop()
      } catch (e) {
        // ignore cleanup error
      }
      zxingControlsRef.current = null
    }

    zxingReaderRef.current = null

    // Stop all media stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch (e) {
          // ignore
        }
      })
      streamRef.current = null
    }

    videoTrackRef.current = null

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setIsTorchOn(false)
    setIsTorchSupported(false)
  }, [])

  // Handle successful barcode detection
  const handleScanSuccess = useCallback(
    (decodedText: string) => {
      if (!isScanningActiveRef.current) return
      isScanningActiveRef.current = false

      setLastScanned(decodedText)
      playBeep()

      // Stop camera immediately
      stopCamera()

      // Automatically populate target input field if passed
      if (targetInputRef && targetInputRef.current) {
        triggerInputChange(targetInputRef.current, decodedText)
      }

      // Return result callback and close modal after brief visual feedback
      setTimeout(() => {
        onScanResult(decodedText)
        onClose()
      }, 350)
    },
    [playBeep, stopCamera, targetInputRef, onScanResult, onClose]
  )

  // Enumerate available video input devices (front/rear cameras)
  const enumerateCameras = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoInputs = devices.filter((device) => device.kind === 'videoinput')
      setVideoDevices(videoInputs)

      // Select back camera by default if device ID not yet set or no longer valid
      const isCurrentDeviceValid = videoInputs.some((d) => d.deviceId === selectedDeviceId)
      if ((!selectedDeviceId || !isCurrentDeviceValid) && videoInputs.length > 0) {
        // Try to match the saved ID or label first
        const savedDefaultId = typeof window !== 'undefined' ? localStorage.getItem('defaultCameraId') : null
        const savedDefaultLabel = typeof window !== 'undefined' ? localStorage.getItem('defaultCameraLabel') : null

        let matchedDevice = null
        if (savedDefaultId) {
          matchedDevice = videoInputs.find((d) => d.deviceId === savedDefaultId)
        }
        if (!matchedDevice && savedDefaultLabel) {
          matchedDevice = videoInputs.find((d) => d.label && d.label === savedDefaultLabel)
        }

        if (matchedDevice) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('defaultCameraId', matchedDevice.deviceId)
          }
          setSelectedDeviceId(matchedDevice.deviceId)
        } else {
          const backCamera = videoInputs.find(
            (d) =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('rear') ||
              d.label.toLowerCase().includes('environment')
          )
          if (backCamera) {
            setSelectedDeviceId(backCamera.deviceId)
          } else {
            setSelectedDeviceId(videoInputs[videoInputs.length - 1].deviceId)
          }
        }
      }
    } catch (e) {
      console.warn('Could not enumerate camera devices:', e)
    }
  }, [selectedDeviceId])

  // Toggle Torch/Flashlight if supported by camera track
  const toggleTorch = async () => {
    if (!videoTrackRef.current || !isTorchSupported) return
    try {
      const nextState = !isTorchOn
      await videoTrackRef.current.applyConstraints({
        advanced: [{ torch: nextState } as any]
      })
      setIsTorchOn(nextState)
    } catch (err) {
      // Silently ignore torch errors
    }
  }

  // Switch between available camera devices
  const switchCamera = () => {
    if (videoDevices.length <= 1) return
    const currentIndex = videoDevices.findIndex((d) => d.deviceId === selectedDeviceId)
    const nextIndex = (currentIndex + 1) % videoDevices.length
    setSelectedDeviceId(videoDevices[nextIndex].deviceId)
  }

  // Save current selected camera as default in localStorage
  const handleSetDefaultCamera = () => {
    if (selectedDeviceId) {
      if (isDefaultCamera) {
        localStorage.removeItem('defaultCameraId')
        localStorage.removeItem('defaultCameraLabel')
        setIsDefaultCamera(false)
      } else {
        const selectedDevice = videoDevices.find((d) => d.deviceId === selectedDeviceId)
        localStorage.setItem('defaultCameraId', selectedDeviceId)
        if (selectedDevice && selectedDevice.label) {
          localStorage.setItem('defaultCameraLabel', selectedDevice.label)
        }
        setIsDefaultCamera(true)
      }
    }
  }

  // Check pin status whenever selectedDeviceId or videoDevices update
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDefaultId = localStorage.getItem('defaultCameraId')
      const savedDefaultLabel = localStorage.getItem('defaultCameraLabel')
      const currentDevice = videoDevices.find((d) => d.deviceId === selectedDeviceId)

      const isPinned =
        (!!savedDefaultId && savedDefaultId === selectedDeviceId) ||
        (!!savedDefaultLabel && !!currentDevice?.label && savedDefaultLabel === currentDevice.label)

      setIsDefaultCamera(isPinned)
    }
  }, [selectedDeviceId, videoDevices])

  // Initialize camera & barcode detector (BarcodeDetector API with ZXing fallback)
  useEffect(() => {
    if (!isOpen) {
      stopCamera()
      return
    }

    let isComponentMounted = true
    setIsInitializing(true)
    setCameraError(null)
    setLastScanned(null)
    isScanningActiveRef.current = true

    const startScanner = async () => {
      try {
        if (!navigator?.mediaDevices?.getUserMedia || !navigator?.mediaDevices?.enumerateDevices) {
          setCameraError('Camera access is unavailable.')
          setIsInitializing(false)
          return
        }

        // Clean up any existing stream first
        stopCamera()
        isScanningActiveRef.current = true

        // First check if any camera devices exist to prevent getUserMedia errors on devices without cameras
        let devices: MediaDeviceInfo[] = []
        try {
          devices = await navigator.mediaDevices.enumerateDevices()
        } catch (e) {
          // ignore enumeration error
        }
        
        const videoInputs = devices.filter((d) => d.kind === 'videoinput')
        if (videoInputs.length === 0 && devices.length > 0) {
          // Devices exist but no video inputs
          setCameraError('Camera access is unavailable.')
          setIsInitializing(false)
          return
        }

        // Configure video constraints preferring ideal deviceId or rear camera
        const constraints: MediaStreamConstraints = {
          video: selectedDeviceId
            ? { deviceId: { ideal: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 }
              },
          audio: false
        }

        let stream: MediaStream | null = null
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints)
        } catch (mediaError: any) {
          // Fallback 1: try rear facing mode if specific deviceId failed
          try {
            const fallbackConstraints: MediaStreamConstraints = {
              video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
              audio: false
            }
            stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints)
          } catch (fallbackError) {
            // Fallback 2: try any video input
            try {
              stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
            } catch (anyError) {
              setCameraError('Camera access is unavailable.')
              setIsInitializing(false)
              return
            }
          }
        }

        if (!stream) {
          setCameraError('Camera access is unavailable.')
          setIsInitializing(false)
          return
        }

        if (!isComponentMounted || !isScanningActiveRef.current) {
          stream.getTracks().forEach((t) => {
            try { t.stop() } catch (e) {}
          })
          return
        }

        streamRef.current = stream
        const videoTrack = stream.getVideoTracks()[0]
        videoTrackRef.current = videoTrack

        // Check torch capability
        setIsTorchSupported(false)
        if (videoTrack && typeof videoTrack.getCapabilities === 'function') {
          try {
            const capabilities: any = videoTrack.getCapabilities()
            if (capabilities && capabilities.torch) {
              setIsTorchSupported(true)
            }
          } catch (e) {
            // Silently ignore capability check errors
          }
        }

        // Attach stream to video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          try {
            await videoRef.current.play()
          } catch (e) {}
        }

        // Refresh camera device list after permission is granted
        await enumerateCameras().catch(() => {})

        if (!isComponentMounted) return
        setIsInitializing(false)

        // --- STEP 1: Attempt native BarcodeDetector API ---
        let nativeDetector: any = null
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          try {
            const BarcodeDetectorClass = (window as any).BarcodeDetector
            const supportedFormats: string[] = (await BarcodeDetectorClass.getSupportedFormats?.().catch(() => [])) || []
            const requestedFormats = [
              'code_128',
              'code_39',
              'ean_13',
              'ean_8',
              'upc_a',
              'upc_e',
              'qr_code',
              'data_matrix',
              'aztec',
              'pdf417'
            ]
            const validFormats =
              supportedFormats.length > 0
                ? requestedFormats.filter((fmt) => supportedFormats.includes(fmt))
                : requestedFormats

            nativeDetector = new BarcodeDetectorClass({
              formats: validFormats.length > 0 ? validFormats : ['code_128', 'qr_code']
            })
            setEngineUsed('Native BarcodeDetector')
          } catch (e) {
            nativeDetector = null
          }
        }

        if (nativeDetector) {
          // Frame scanner loop using BarcodeDetector
          const detectLoop = async () => {
            if (!isComponentMounted || !isScanningActiveRef.current || !videoRef.current) return
            if (videoRef.current.readyState >= 2) {
              try {
                const barcodes = await nativeDetector.detect(videoRef.current)
                if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                  handleScanSuccess(barcodes[0].rawValue)
                  return
                }
              } catch (err) {
                // Ignore transient frame detection errors
              }
            }
            if (isScanningActiveRef.current) {
              animFrameIdRef.current = requestAnimationFrame(detectLoop)
            }
          }
          detectLoop()
        } else {
          // --- STEP 2: Fallback to ZXing (@zxing/browser) ---
          setEngineUsed('ZXing Browser Fallback')

          const hints = new Map()
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.CODE_128,
            BarcodeFormat.CODE_39,
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
            BarcodeFormat.QR_CODE,
            BarcodeFormat.DATA_MATRIX,
            BarcodeFormat.ITF
          ])

          try {
            const codeReader = new BrowserMultiFormatReader(hints)
            zxingReaderRef.current = codeReader

            if (videoRef.current) {
              zxingControlsRef.current = await codeReader.decodeFromVideoElement(
                videoRef.current,
                (result, error) => {
                  if (result && isScanningActiveRef.current) {
                    handleScanSuccess(result.getText())
                  }
                }
              )
            }
          } catch (e) {
            // Silently ignore ZXing errors
          }
        }
      } catch (err: any) {
        if (!isComponentMounted) return
        setIsInitializing(false)
        setCameraError('Camera access is unavailable.')
      }
    }

    startScanner()

    return () => {
      isComponentMounted = false
      stopCamera()
    }
  }, [
    isOpen,
    selectedDeviceId,
    handleScanSuccess,
    stopCamera,
    enumerateCameras
  ])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 relative animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-amber-500/20 to-amber-600/20 text-amber-500 rounded-2xl border border-amber-500/30 shrink-0">
              <QrCode size={22} />
            </div>
            <div>
              <h3 className="font-display font-bold text-slate-900 dark:text-slate-100 text-base sm:text-lg">
                {title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold ${
                soundEnabled
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/40 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700'
              }`}
              title={soundEnabled ? 'Speaker On (Click to mute)' : 'Speaker Muted (Click to enable)'}
            >
              {soundEnabled ? <Volume2 size={16} className="text-amber-500 shrink-0" /> : <VolumeX size={16} className="shrink-0" />}
              <span className="hidden sm:inline font-semibold">{soundEnabled ? 'Speaker: ON' : 'Speaker: OFF'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Live Camera Viewfinder */}
        <div className="space-y-3">
          <div className="relative aspect-[4/3] sm:aspect-square w-full rounded-2xl bg-slate-950 overflow-hidden border-2 border-amber-500/40 shadow-inner flex items-center justify-center">
              {/* HTML5 Video Element */}
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Target Framing Overlay */}
              {!cameraError && !isInitializing && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                  {/* Framing Reticle */}
                  <div className="relative w-3/4 max-w-[260px] aspect-square rounded-2xl border-2 border-dashed border-amber-400/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.65)] flex items-center justify-center">
                    {/* Corner Accent Brackets */}
                    <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-amber-500 rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-amber-500 rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-amber-500 rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-amber-500 rounded-br-lg" />

                    {/* Animated Red Laser Beam */}
                    <div className="w-full h-0.5 bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,1)] animate-pulse" />
                  </div>
                </div>
              )}

              {/* Camera Controls Overlay (Flashlight / Torch & Switch Camera) */}
              {!cameraError && !isInitializing && (
                <div className="absolute top-3 right-3 flex flex-col items-center gap-2 z-10">
                  {videoDevices.length > 1 && (
                    <button
                      type="button"
                      onClick={switchCamera}
                      className="p-2.5 rounded-full bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-900 backdrop-blur-md shadow-lg transition-all active:scale-95"
                      title="Switch Camera Device"
                    >
                      <SwitchCamera size={18} />
                    </button>
                  )}

                  {isTorchSupported && (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      className={`p-2.5 rounded-full transition-all backdrop-blur-md shadow-lg ${
                        isTorchOn
                          ? 'bg-amber-500 text-white shadow-amber-500/50 scale-105'
                          : 'bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-900'
                      }`}
                      title={isTorchOn ? 'Turn Flashlight Off' : 'Turn Flashlight On'}
                    >
                      {isTorchOn ? <Zap size={18} /> : <ZapOff size={18} />}
                    </button>
                  )}

                  {selectedDeviceId && (
                    <button
                      type="button"
                      onClick={handleSetDefaultCamera}
                      className={`p-2.5 rounded-full transition-all backdrop-blur-md shadow-lg ${
                        isDefaultCamera
                          ? 'bg-emerald-600 text-white shadow-emerald-600/50 scale-105'
                          : 'bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-900'
                      }`}
                      title={isDefaultCamera ? 'This is your default camera' : 'Set as default camera'}
                    >
                      <Pin size={18} className={isDefaultCamera ? 'rotate-45 text-white' : 'text-slate-300 group-hover:text-white'} />
                    </button>
                  )}
                </div>
              )}

              {/* Initializing Loading State */}
              {isInitializing && !cameraError && (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-center p-6 space-y-3 z-20">
                  <RefreshCw size={32} className="text-amber-500 animate-spin" />
                  <p className="text-sm font-semibold text-slate-200">Starting Camera Stream...</p>
                  <p className="text-xs text-slate-400 max-w-xs">
                    Please allow camera permission if requested by your browser.
                  </p>
                </div>
              )}

              {/* Camera Error Display */}
              {cameraError && (
                <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center text-center p-6 space-y-3 z-20">
                  <div className="p-3 bg-rose-500/20 text-rose-400 rounded-full">
                    <ShieldAlert size={32} />
                  </div>
                  <p className="text-sm font-bold text-slate-200">Camera Unavailable</p>
                  <p className="text-xs text-slate-400 max-w-xs leading-relaxed">{cameraError}</p>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setCameraError(null)
                        setIsInitializing(true)
                        // Trigger re-mount restart
                        const prev = selectedDeviceId
                        setSelectedDeviceId('')
                        setTimeout(() => setSelectedDeviceId(prev), 100)
                      }}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-colors cursor-pointer"
                    >
                      Retry Camera
                    </button>
                  </div>
                </div>
              )}

              {/* Success Banner Overlay */}
              {lastScanned && (
                <div className="absolute inset-0 bg-emerald-950/95 flex flex-col items-center justify-center text-center p-6 space-y-2 animate-in fade-in duration-150 z-30">
                  <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-full animate-bounce">
                    <CheckCircle2 size={40} />
                  </div>
                  <p className="text-base font-bold text-emerald-200">Barcode Detected!</p>
                  <p className="text-sm font-mono font-bold bg-slate-900/90 px-4 py-2 rounded-xl text-emerald-400 border border-emerald-500/40 shadow-lg">
                    {lastScanned}
                  </p>
                </div>
              )}
            </div>

            {/* Footer Status & Camera Switcher Bar */}
            {!cameraError && (
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 pt-1">
                <span className="flex items-center gap-1.5 font-medium truncate">
                  <Sparkles size={14} className="text-amber-500 shrink-0" />
                  <span className="truncate">
                    {engineUsed ? `Active: ${engineUsed}` : 'Auto-focusing barcode stream'}
                  </span>
                </span>

                {videoDevices.length > 1 && (
                  <button
                    type="button"
                    onClick={switchCamera}
                    className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 hover:underline font-bold shrink-0 cursor-pointer"
                  >
                    <RefreshCw size={12} />
                    Switch Camera
                  </button>
                )}
              </div>
            )}
          </div>
      </div>
    </div>
  )
}

/**
 * Reusable "Scan Barcode" Button Component
 */
export interface BarcodeScannerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string
  showLabel?: boolean
  variant?: 'primary' | 'secondary' | 'outline'
}

export function BarcodeScannerButton({
  label = 'Scan Barcode',
  showLabel = true,
  variant = 'primary',
  className = '',
  ...props
}: BarcodeScannerButtonProps) {
  const baseStyle =
    'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0'
  const variants = {
    primary:
      'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-sm hover:shadow-md',
    secondary:
      'bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-white text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700',
    outline:
      'border border-amber-500/50 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white'
  }

  return (
    <button
      type="button"
      className={`${baseStyle} ${variants[variant]} ${className}`}
      title={label}
      {...props}
    >
      <Scan size={16} className="shrink-0" />
      {showLabel && <span>{label}</span>}
    </button>
  )
}

/**
 * Reusable Composite Component: Input field with an attached "Scan Barcode" button.
 */
export interface BarcodeScannerInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onScanResult?: (scannedText: string) => void
  buttonLabel?: string
  containerClassName?: string
}

export function BarcodeScannerInput({
  value,
  onChange,
  onScanResult,
  buttonLabel = 'Scan Barcode',
  containerClassName = '',
  className = '',
  placeholder = 'Scan or enter barcode...',
  ...inputProps
}: BarcodeScannerInputProps) {
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleScanResult = (scannedText: string) => {
    if (inputRef.current) {
      triggerInputChange(inputRef.current, scannedText)
    }
    if (onScanResult) {
      onScanResult(scannedText)
    }
  }

  return (
    <div className={`relative flex items-center gap-2 w-full ${containerClassName}`}>
      <div className="relative w-full flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full pr-28 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm font-medium ${className}`}
          {...inputProps}
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
          <BarcodeScannerButton
            label={buttonLabel}
            onClick={() => setIsScannerOpen(true)}
            variant="primary"
          />
        </div>
      </div>

      {isScannerOpen && (
        <BarcodeScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScanResult={handleScanResult}
          targetInputRef={inputRef}
        />
      )}
    </div>
  )
}
