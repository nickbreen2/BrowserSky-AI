'use client'

import React, { useRef } from 'react'
import {
  motion,
  useMotionValue,
  useMotionTemplate,
  useAnimationFrame,
} from 'framer-motion'

export function InfiniteGridBg() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mouseX = useMotionValue(-9999)
  const mouseY = useMotionValue(-9999)

  const gridOffsetX = useMotionValue(0)
  const gridOffsetY = useMotionValue(0)

  useAnimationFrame(() => {
    gridOffsetX.set((gridOffsetX.get() + 0.4) % 40)
    gridOffsetY.set((gridOffsetY.get() + 0.4) % 40)
  })

  const maskImage = useMotionTemplate`radial-gradient(280px circle at ${mouseX}px ${mouseY}px, black, transparent)`

  // Listen on the window so pointer events on child elements still work
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      const el = containerRef.current
      if (!el) return
      const { left, top } = el.getBoundingClientRect()
      mouseX.set(e.clientX - left)
      mouseY.set(e.clientY - top)
    }
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [mouseX, mouseY])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {/* Static dim grid */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.025 }}>
        <GridPattern offsetX={gridOffsetX} offsetY={gridOffsetY} />
      </div>

      {/* Mouse-reveal bright grid */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.22,
          maskImage,
          WebkitMaskImage: maskImage,
        }}
      >
        <GridPattern offsetX={gridOffsetX} offsetY={gridOffsetY} />
      </motion.div>

      {/* Colour blobs */}
      <div
        style={{
          position: 'absolute',
          right: '-10%',
          top: '-15%',
          width: '35%',
          height: '35%',
          borderRadius: '50%',
          background: 'rgba(99,102,241,0.18)',
          filter: 'blur(100px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: '20%',
          bottom: '-10%',
          width: '20%',
          height: '20%',
          borderRadius: '50%',
          background: 'rgba(99,102,241,0.1)',
          filter: 'blur(80px)',
        }}
      />
    </div>
  )
}

function GridPattern({
  offsetX,
  offsetY,
}: {
  offsetX: ReturnType<typeof useMotionValue<number>>
  offsetY: ReturnType<typeof useMotionValue<number>>
}) {
  return (
    <svg width="100%" height="100%">
      <defs>
        <motion.pattern
          id="grid-pattern"
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
          x={offsetX}
          y={offsetY}
        >
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke="#6366f1"
            strokeWidth="1"
          />
        </motion.pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid-pattern)" />
    </svg>
  )
}
