'use client'

import { EdgeProps, getBezierPath, useReactFlow } from '@xyflow/react'
import { useState } from 'react'

export default function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false)
  const { setEdges } = useReactFlow()

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const deleteEdge = () => {
    setEdges((edges) => edges.filter((e) => e.id !== id))
  }

  return (
    <>
      {/* Invisible wide hit area for easier hover */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ cursor: 'pointer' }}
      />
      {/* Visible edge line */}
      <path
        d={edgePath}
        fill="none"
        style={{
          ...style,
          stroke: hovered ? 'hsl(0, 0%, 40%)' : (style?.stroke as string ?? 'hsl(0, 0%, 60%)'),
          strokeWidth: hovered ? 2 : (style?.strokeWidth as number ?? 1.5),
          transition: 'stroke 0.15s, stroke-width 0.15s',
          pointerEvents: 'none',
        }}
        markerEnd={markerEnd}
      />
      {/* Delete button at midpoint */}
      {hovered && (
        <g
          transform={`translate(${labelX}, ${labelY})`}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={deleteEdge}
          style={{ cursor: 'pointer' }}
        >
          <circle r={9} fill="hsl(0, 0%, 100%)" stroke="hsl(0, 0%, 80%)" strokeWidth={1} />
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={10}
            fill="hsl(0, 0%, 45%)"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            ✕
          </text>
        </g>
      )}
    </>
  )
}
