import React from 'react'
import {
  uploadTemplate, saveLayout,
  uploadDataset, getDataset, previewGenerate, batchGenerate,
  checkCMYKSupport, toAbsoluteUrl
} from './lib/api'
import FieldEditor from './components/FieldEditor'
import CMYKSetupGuide from './components/CMYKSetupGuide'

function Section({ title, children }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-gradient-to-b from-white to-neutral-50 p-6 shadow-sm">
      <h2 className="text-base font-semibold text-neutral-900 mb-4">{title}</h2>
      {children}
    </div>
  )
}

export default function App() {
  const [template, setTemplate] = React.useState(null)
  const [fields, setFields] = React.useState([])
  const [mapping, setMapping] = React.useState({})
  const [dataset, setDataset] = React.useState(null)
  const [previewUrl, setPreviewUrl] = React.useState('')
  const [status, setStatus] = React.useState('')
  const [fieldsDirty, setFieldsDirty] = React.useState(false)
  const [cmykSupport, setCmykSupport] = React.useState(null)
  const [pdfFormat, setPdfFormat] = React.useState('cmyk') // 'cmyk' or 'rgb'
  const [showCmykGuide, setShowCmykGuide] = React.useState(false)

  // Check CMYK support on component mount
  React.useEffect(() => {
    const checkSupport = async () => {
      try {
        const support = await checkCMYKSupport()
        setCmykSupport(support)
        // Default to RGB if CMYK not supported
        if (!support.cmykSupported) {
          setPdfFormat('rgb')
        }
      } catch (error) {
        console.warn('Failed to check CMYK support:', error)
        setCmykSupport({ cmykSupported: false, message: 'Unable to check CMYK support' })
        setPdfFormat('rgb')
      }
    }
    checkSupport()
  }, [])


  const mappingChanged = React.useMemo(() => {
    if (!template) return Object.keys(mapping || {}).length > 0
    try {
      return JSON.stringify(mapping || {}) !== JSON.stringify(template.mapping || {})
    } catch { return true }
  }, [mapping, template])

  const generateFieldsFromHeaders = (headers=[]) => {
    // Stack fields vertically on the left, draggable later
    const defaultW = 180
    const defaultH = 36
    return headers.map((h, idx) => ({
      id: crypto.randomUUID(),
      name: String(h),
      type: 'text',
      x: 20,
      y: 20 + idx * (defaultH + 14),
      width: defaultW,
      height: defaultH,
      zIndex: 0,
      style: { fontSize: 18, color: '#111', align: 'left' },
    }))
  }

  const onUploadTemplate = async (file) => {
    setStatus('Uploading template...')
    const t = await uploadTemplate(file)
    setTemplate(t)
    setFields(t.fields || [])
    setMapping(t.mapping || {})
    setFieldsDirty(false)
    setStatus('Template uploaded')
  }

  const onUploadDataset = async (file) => {
    setStatus('Uploading dataset...')
    const d = await uploadDataset(file)
    const ds = await getDataset(d._id)
    setDataset(ds)

    // Auto-generate fields + mapping from headers
    const newFields = generateFieldsFromHeaders(ds.headers)
    const newMapping = Object.fromEntries(newFields.map(f => [f.id, f.name]))

    if (!fields.length || window.confirm('Replace current fields with columns from the uploaded sheet?')) {
      setFields(newFields)
      setMapping(newMapping)
      setFieldsDirty(true)
      setStatus('Dataset uploaded; fields generated (unsaved)')
    } else {
      setStatus('Dataset uploaded')
    }
  }



  const onSaveLayout = async () => {
    if (!template) return
    setStatus('Saving layout...')
    const t = await saveLayout(template._id, { fields, mapping })
    setTemplate(t)
    setFieldsDirty(false)
    setStatus('Layout saved')
  }

  const onPreview = async () => {
    if (!template || !dataset) return
    setStatus(fieldsDirty ? 'Saving layout and generating preview...' : 'Generating preview...')
    
    if (fieldsDirty) {
      const t = await saveLayout(template._id, { fields, mapping })
      setTemplate(t)
      setFieldsDirty(false)
    }
  
    const first = dataset.sampleRows?.[0] || {}
    
    const { previewUrl } = await previewGenerate(template._id, first)
    setPreviewUrl(toAbsoluteUrl(previewUrl))
    setStatus('Preview ready')
  }

  const onDownloadPDF = async (format = pdfFormat) => {
    if (!template || !dataset) return
    
    const isCmyk = format === 'cmyk'
    const formatLabel = isCmyk ? 'CMYK PDF' : 'RGB PDF'
    
    setStatus(fieldsDirty ? `Saving layout and generating ${formatLabel}...` : `Generating ${formatLabel}...`)
    
    if (fieldsDirty) {
      const t = await saveLayout(template._id, { fields })
      setTemplate(t)
      setFieldsDirty(false)
    }
    
    try {
      const result = await batchGenerate(template._id, dataset._id, null, { cmyk: isCmyk })
      window.open(toAbsoluteUrl(result.pdfUrl), '_blank')
      
      const successMessage = isCmyk && result.cmykCompatible 
        ? 'CMYK PDF generated (print-ready)' 
        : isCmyk && !result.cmykCompatible
        ? 'RGB PDF generated (CMYK conversion unavailable)'
        : 'RGB PDF generated'
      
      setStatus(successMessage)
    } catch (error) {
      setStatus(`Failed to generate ${formatLabel}: ${error.message}`)
    }
  }

  const handleFieldsChange = (updated) => {
    setFields(updated)
    setFieldsDirty(true)
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="pt-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-neutral-900 to-neutral-600">ID Card Generator</h1>
          {cmykSupport && (
            <div className={`text-xs px-2 py-1 rounded-full ${
              cmykSupport.cmykSupported 
                ? 'bg-green-100 text-green-700' 
                : 'bg-amber-100 text-amber-700'
            }`}>
              {cmykSupport.cmykSupported ? '🎨 CMYK Ready' : '🖥️ RGB Only'}
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {/* Left panel */}
        <div className="col-span-12 md:col-span-4 space-y-6">
          <Section title="Upload Template">
            <input type="file" accept="image/*" onChange={(e)=>e.target.files?.[0] && onUploadTemplate(e.target.files[0])} />
            {template && (
              <div className="text-sm text-neutral-600 mt-2 space-y-1">
                <div>Uploaded: <a className="text-blue-600 underline" href={toAbsoluteUrl(template.image?.url)} target="_blank">view</a></div>
                {template.imageMeta?.width && template.imageMeta?.height && (
                  <div className="text-xs text-neutral-500">Size: {template.imageMeta.width} × {template.imageMeta.height}px</div>
                )}
              </div>
            )}
            <div className="mt-3 text-xs text-neutral-500">Tip: Drag fields on the template and drag edges to resize. Click "Save Layout" when done.</div>
          </Section>

          <Section title="Upload Excel Sheet">
            <input type="file" accept=".xlsx,.csv" onChange={(e)=>e.target.files?.[0] && onUploadDataset(e.target.files[0])} />
            {dataset && (
              <div className="text-sm text-neutral-600 mt-2">Rows: {dataset.rowCount}</div>
            )}

            {fieldsDirty && (
              <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">You have unsaved layout changes</div>
            )}
          </Section>

          <Section title="Preview & Generate">
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="rounded border max-h-72 object-contain" />
            ) : (
              <div className="text-sm text-neutral-500">No preview yet.</div>
            )}
            
            {/* PDF Format Selection */}
            <div className="mt-4 p-3 bg-neutral-50 rounded-lg border">
              <div className="text-sm font-medium text-neutral-700 mb-2">PDF Format</div>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input 
                    type="radio" 
                    name="pdfFormat" 
                    value="cmyk" 
                    checked={pdfFormat === 'cmyk'}
                    onChange={(e) => setPdfFormat(e.target.value)}
                    disabled={!cmykSupport?.cmykSupported}
                    className="text-blue-600"
                  />
                  <span className="text-sm">
                    CMYK (Print-ready)
                    {cmykSupport?.cmykSupported ? (
                      <span className="ml-1 text-xs text-green-600">✓ Available</span>
                    ) : (
                      <span className="ml-1 text-xs text-amber-600">⚠ Requires Ghostscript</span>
                    )}
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input 
                    type="radio" 
                    name="pdfFormat" 
                    value="rgb" 
                    checked={pdfFormat === 'rgb'}
                    onChange={(e) => setPdfFormat(e.target.value)}
                    className="text-blue-600"
                  />
                  <span className="text-sm">RGB (Screen/Web)</span>
                </label>
              </div>
              {cmykSupport && !cmykSupport.cmykSupported && (
                <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  <div className="flex items-center justify-between">
                    <span>{cmykSupport.message}</span>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => setShowCmykGuide(true)}
                        className="text-blue-600 underline hover:text-blue-800"
                      >
                        Setup Guide
                      </button>
                      <span className="text-amber-600">|</span>
                      <button 
                        onClick={async () => {
                          const support = await checkCMYKSupport()
                          setCmykSupport(support)
                          if (support.cmykSupported) {
                            setPdfFormat('cmyk')
                            setStatus('CMYK support detected! 🎉')
                          }
                        }}
                        className="text-blue-600 underline hover:text-blue-800"
                      >
                        Recheck
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button 
                className="px-3 py-1.5 bg-neutral-900 text-white rounded text-sm disabled:opacity-50" 
                onClick={onPreview} 
                disabled={!template || !dataset}
              >
                Generate Preview
              </button>
              
              <div className="flex gap-1">
                <button 
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50 flex items-center gap-1" 
                  onClick={() => onDownloadPDF(pdfFormat)} 
                  disabled={!template || !dataset}
                >
                  {pdfFormat === 'cmyk' ? '🎨' : '🖥️'} 
                  Download {pdfFormat.toUpperCase()} PDF
                </button>
                
                {/* Quick action buttons for both formats */}
                {cmykSupport?.cmykSupported && pdfFormat === 'rgb' && (
                  <button 
                    className="px-2 py-1.5 bg-purple-600 text-white rounded text-sm disabled:opacity-50" 
                    onClick={() => onDownloadPDF('cmyk')} 
                    disabled={!template || !dataset}
                    title="Generate CMYK PDF"
                  >
                    🎨
                  </button>
                )}
                
                {pdfFormat === 'cmyk' && (
                  <button 
                    className="px-2 py-1.5 bg-gray-600 text-white rounded text-sm disabled:opacity-50" 
                    onClick={() => onDownloadPDF('rgb')} 
                    disabled={!template || !dataset}
                    title="Generate RGB PDF"
                  >
                    🖥️
                  </button>
                )}
              </div>
              
              {previewUrl && (
                <button className="px-3 py-1.5 bg-neutral-100 text-neutral-700 rounded text-sm" onClick={()=>setPreviewUrl('')}>Clear Preview</button>
              )}
            </div>
            {status && <div className="text-xs text-neutral-500 mt-2">{status}</div>}
          </Section>
        </div>

        {/* Right panel */}
        <div className="col-span-12 md:col-span-8 space-y-6">
          <Section title="Arrange Columns on Template">
            <div className="grid grid-cols-12 gap-4">
              {/* Left: list of detected Excel columns */}
              <div className="col-span-12 lg:col-span-4">
                <div className="space-y-2">
                  {(dataset?.headers || []).map((h)=> (
                    <div key={h} className="flex items-center justify-between rounded-lg border border-neutral-200 px-2 py-1.5 bg-white hover:border-blue-500 hover:bg-blue-50/50 transition-colors">
                      <div className="text-sm font-medium">{h}</div>
                    </div>
                  ))}
                  {!dataset?.headers?.length && <div className="text-sm text-neutral-500">Upload an Excel sheet to load columns.</div>}
                </div>
              </div>

              {/* Right: field editor over template image */}
              <div className="col-span-12 lg:col-span-8">
                <FieldEditor imageUrl={toAbsoluteUrl(template?.image?.url)} fields={fields} onChange={handleFieldsChange} />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button className="px-3 py-1.5 bg-emerald-600 text-white rounded text-sm disabled:opacity-50" onClick={onSaveLayout} disabled={!template || (!fieldsDirty && !mappingChanged)}>
                    Save Layout & Mapping
                  </button>
                  {!template && <span className="text-xs text-neutral-500">Upload a template to enable saving</span>}
                  {(!fieldsDirty && !mappingChanged) && <span className="text-xs text-neutral-500">No changes</span>}
                </div>
              </div>
            </div>
          </Section>
        </div>
      </div>
      
      <CMYKSetupGuide 
        isOpen={showCmykGuide} 
        onClose={() => setShowCmykGuide(false)} 
      />
    </div>
  )
}

