import React from 'react'
import { Stage, Layer, Rect, Text, Group, Transformer } from 'react-konva'
import { Info } from 'lucide-react'

export default function FieldEditor({ imageUrl, fields, onChange, maxHeight }) {
  const [imgDim, setImgDim] = React.useState({ width: 0, height: 0 })
  const [img] = React.useState(() => new window.Image())
  const [selectedId, setSelectedId] = React.useState(null)
  const trRef = React.useRef(null)
  const nodeRefs = React.useRef({})
  const containerRef = React.useRef(null)
  const [containerWidth, setContainerWidth] = React.useState(0)

  React.useEffect(() => {
    if (!imageUrl) return
    img.src = imageUrl
    img.onload = () => setImgDim({ width: img.width, height: img.height })
  }, [imageUrl])

  React.useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth - 20)
      }
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // Calculate scale to fit both width and height constraints
  const getOptimalScale = () => {
    if (!imgDim.width || !imgDim.height) return 1
    
    const maxW = containerWidth || 600
    const maxH = maxHeight || 600
    
    const scaleW = maxW / imgDim.width
    const scaleH = maxH / imgDim.height
    
    // Use the smaller scale to ensure it fits in both dimensions
    return Math.min(scaleW, scaleH, 1) // Cap at 1 to avoid upscaling
  }

  const scale = getOptimalScale()
  const stageW = imgDim.width * scale
  const stageH = imgDim.height * scale

  const handleDragMove = (i, e) => {
    const { x, y } = e.target.position()
    const updated = [...fields]
    updated[i] = { ...updated[i], x: Math.round(x/scale), y: Math.round(y/scale) }
    onChange(updated)
  }

  const handleTransformEnd = (i, id) => {
    const node = nodeRefs.current[id]
    if (!node) return

    // If user resized from top/left anchors, Konva shifts node.x/y.
    // Capture that shift and apply it to the field's absolute position.
    const deltaX = node.x() / scale
    const deltaY = node.y() / scale

    const newW = Math.max(10, (node.width() * node.scaleX()) / scale)
    const newH = Math.max(10, (node.height() * node.scaleY()) / scale)

    // Reset transforms so our data stays in image-space without residual scale/offset
    node.scaleX(1)
    node.scaleY(1)
    node.x(0)
    node.y(0)

    const updated = [...fields]
    const prev = updated[i]
    updated[i] = {
      ...prev,
      x: Math.round((prev.x || 0) + deltaX),
      y: Math.round((prev.y || 0) + deltaY),
      width: Math.round(newW),
      height: Math.round(newH)
    }
    onChange(updated)
  }

  React.useEffect(() => {
    const node = selectedId ? nodeRefs.current[selectedId] : null
    if (trRef.current) {
      if (node) trRef.current.nodes([node])
      else trRef.current.nodes([])
      trRef.current.getLayer() && trRef.current.getLayer().batchDraw()
    }
  }, [selectedId, fields, scale])

  return (
    <div className="w-full h-full" ref={containerRef}>
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden inline-block">
        {imageUrl ? (
          <Stage width={stageW} height={stageH} className="rounded-lg cursor-move"
                 onMouseDown={(e)=>{ if (e.target === e.target.getStage()) setSelectedId(null) }}>
            <Layer>
              {/* background image */}
              <Rect x={0} y={0} width={stageW} height={stageH} fillPatternImage={img} fillPatternScaleX={scale} fillPatternScaleY={scale} listening={false} />
              {fields.map((f, i) => (
                <Group key={f.id}
                       x={f.x*scale}
                       y={f.y*scale}
                       draggable
                       onDragEnd={(e)=>handleDragMove(i,e)}
                       onClick={()=>setSelectedId(f.id)}>
                  <Rect
                        ref={(node)=>{ if (node) nodeRefs.current[f.id] = node }}
                        x={0} y={0}
                        width={Math.max(40, f.width*scale)} height={Math.max(20, f.height*scale)}
                        fill={selectedId === f.id ? "rgba(59, 130, 246, 0.1)" : "rgba(255, 255, 255, 0.8)"}
                        stroke={selectedId === f.id ? "#3b82f6" : "#6b7280"}
                        strokeWidth={selectedId === f.id ? 2 : 1}
                        dash={[6, 3]}
                        cornerRadius={8}
                        shadowBlur={selectedId === f.id ? 10 : 0}
                        shadowColor="rgba(0, 0, 0, 0.1)"
                        onTransformEnd={()=>handleTransformEnd(i, f.id)}
                  />
                  <Text
                        x={8} y={6}
                        text={String(f.name || '')}
                        fontSize={13}
                        fontFamily="system-ui, -apple-system, sans-serif"
                        fill={selectedId === f.id ? "#1e40af" : "#374151"}
                        fontStyle={selectedId === f.id ? "bold" : "normal"}
                        listening={false} />
                </Group>
              ))}
              <Transformer
                ref={trRef}
                rotateEnabled={false}
                ignoreStroke
                borderStroke="#3b82f6"
                borderStrokeWidth={2}
                borderDash={[4, 4]}
                anchorStroke="#3b82f6"
                anchorFill="white"
                anchorSize={8}
                anchorCornerRadius={2}
                enabledAnchors={[
                  "top-left",
                  "top-center",
                  "top-right",
                  "middle-left",
                  "middle-right",
                  "bottom-left",
                  "bottom-center",
                  "bottom-right",
                ]}
              />
            </Layer>
          </Stage>
        ) : (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
              <Info className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-sm text-gray-500">
              Upload a template and data source to start designing
            </p>
          </div>
        )}
      </div>
      
      {imageUrl && fields.length > 0 && (
        <div className="mt-2 p-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded border border-blue-200 inline-block">
          <p className="text-xs text-blue-700">
            <strong>Tips:</strong> Click to select • Drag to move • Resize from corners • {fields.length} field{fields.length !== 1 && 's'} on template
          </p>
        </div>
      )}
    </div>
  )
}

