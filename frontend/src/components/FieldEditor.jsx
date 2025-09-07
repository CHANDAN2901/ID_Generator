import React from 'react'
import { Stage, Layer, Rect, Text, Group, Transformer } from 'react-konva'

export default function FieldEditor({ imageUrl, fields, onChange, width=350 }) {
  const [imgDim, setImgDim] = React.useState({ width: 0, height: 0 })
  const [img] = React.useState(() => new window.Image())
  const [selectedId, setSelectedId] = React.useState(null)
  const trRef = React.useRef(null)
  const nodeRefs = React.useRef({})

  React.useEffect(() => {
    if (!imageUrl) return
    img.src = imageUrl
    img.onload = () => setImgDim({ width: img.width, height: img.height })
  }, [imageUrl])

  const scale = imgDim.width ? width / imgDim.width : 1
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
    <div className="space-y-3">
      <div className="rounded-lg border bg-white">
        {imageUrl ? (
          <Stage width={stageW} height={stageH} className="rounded-lg"
                 onMouseDown={(e)=>{ if (e.target === e.target.getStage()) setSelectedId(null) }}>
            <Layer>
              {/* background image via CSS */}
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
                        stroke="#2563eb" dash={[6,4]} cornerRadius={6}
                        onTransformEnd={()=>handleTransformEnd(i, f.id)}
                  />
                  <Text
                        x={6} y={4}
                        text={String(f.name || '')}
                        fontSize={12}
                        fill="#2563eb"
                        listening={false} />
                </Group>
              ))}
              <Transformer
                ref={trRef}
                rotateEnabled={false}
                ignoreStroke
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
          <div className="p-10 text-sm text-neutral-500">Upload a template and an Excel sheet to start arranging columns.</div>
        )}
      </div>
    </div>
  )
}

