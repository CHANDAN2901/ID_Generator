import React from 'react'
import {
  uploadTemplate, saveLayout,
  uploadDataset, getDataset, previewGenerate, batchGenerate,
  checkCMYKSupport, toAbsoluteUrl
} from './lib/api'
import FieldEditor from './components/FieldEditor'
import CMYKSetupGuide from './components/CMYKSetupGuide'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import { RadioGroup, RadioGroupItem } from './components/ui/radio-group'
import { Label } from './components/ui/label'
import { 
  Upload, Download, Eye, Save, FileImage, FileSpreadsheet,
  Palette, Monitor, AlertCircle, RefreshCw, CheckCircle,
  Layout, Sparkles, X, Loader2
} from 'lucide-react'

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
  const [isProcessing, setIsProcessing] = React.useState(false)

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
    try {
      setIsProcessing(true)
      setStatus('Uploading template...')
      const t = await uploadTemplate(file)
      setTemplate(t)
      setFields(t.fields || [])
      setMapping(t.mapping || {})
      setFieldsDirty(false)
      setStatus('Template uploaded successfully')
    } catch (error) {
      setStatus(`Error: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const onUploadDataset = async (file) => {
    try {
      setIsProcessing(true)
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
        setStatus('Dataset uploaded successfully')
      }
    } catch (error) {
      setStatus(`Error: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }



  const onSaveLayout = async () => {
    if (!template || isProcessing) return
    try {
      setIsProcessing(true)
      setStatus('Saving layout...')
      const t = await saveLayout(template._id, { fields, mapping })
      setTemplate(t)
      setFieldsDirty(false)
      setStatus('Layout saved successfully!')
      setTimeout(() => setStatus(''), 3000)
    } catch (error) {
      setStatus(`Error: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const onPreview = async () => {
    if (!template || !dataset || isProcessing) return
    try {
      setIsProcessing(true)
      setStatus(fieldsDirty ? 'Saving layout and generating preview...' : 'Generating preview...')
      
      if (fieldsDirty) {
        const t = await saveLayout(template._id, { fields, mapping })
        setTemplate(t)
        setFieldsDirty(false)
      }
    
      const first = dataset.sampleRows?.[0] || {}
      
      const { previewUrl } = await previewGenerate(template._id, first)
      setPreviewUrl(toAbsoluteUrl(previewUrl))
      setStatus('Preview ready!')
      setTimeout(() => setStatus(''), 3000)
    } catch (error) {
      setStatus(`Error: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const onDownloadPDF = async (format = pdfFormat) => {
    if (!template || !dataset || isProcessing) return
    
    const isCmyk = format === 'cmyk'
    const formatLabel = isCmyk ? 'CMYK PDF' : 'RGB PDF'
    
    try {
      setIsProcessing(true)
      setStatus(fieldsDirty ? `Saving layout and generating ${formatLabel}...` : `Generating ${formatLabel}...`)
      
      if (fieldsDirty) {
        const t = await saveLayout(template._id, { fields })
        setTemplate(t)
        setFieldsDirty(false)
      }
      
      const result = await batchGenerate(template._id, dataset._id, null, { cmyk: isCmyk })
      window.open(toAbsoluteUrl(result.pdfUrl), '_blank')
      
      const successMessage = isCmyk && result.cmykCompatible 
        ? 'CMYK PDF generated (print-ready)!' 
        : isCmyk && !result.cmykCompatible
        ? 'RGB PDF generated (CMYK conversion unavailable)'
        : 'RGB PDF generated!'
      
      setStatus(successMessage)
      setTimeout(() => setStatus(''), 5000)
    } catch (error) {
      setStatus(`Failed to generate ${formatLabel}: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFieldsChange = (updated) => {
    setFields(updated)
    setFieldsDirty(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 relative">
      {/* Compact Header */}
      <header className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="flex items-center gap-4">
                <h1 className="text-xl font-bold text-gray-900">ID Card Generator</h1>
                <div className="hidden sm:flex items-center gap-2">
                  {/* Workflow Progress Indicators */}
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${template ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="text-xs text-gray-600">Template</span>
                  </div>
                  <div className="w-4 h-[1px] bg-gray-300" />
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${dataset ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="text-xs text-gray-600">Data</span>
                  </div>
                  <div className="w-4 h-[1px] bg-gray-300" />
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${fields.length > 0 ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="text-xs text-gray-600">Design</span>
                  </div>
                  <div className="w-4 h-[1px] bg-gray-300" />
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${previewUrl ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="text-xs text-gray-600">Export</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Status Display */}
              {status && (
                <div className="hidden md:flex items-center gap-2 text-xs text-gray-600 bg-gray-50 px-3 py-1.5 rounded-full">
                  {isProcessing && <Loader2 className="w-3 h-3 animate-spin" />}
                  {status}
                </div>
              )}
              
              {/* CMYK Status */}
              {cmykSupport && (
                <Badge variant={cmykSupport.cmykSupported ? 'success' : 'warning'} className="text-xs">
                  {cmykSupport.cmykSupported ? (
                    <><Palette className="w-3 h-3 mr-1" /> CMYK</>
                  ) : (
                    <><Monitor className="w-3 h-3 mr-1" /> RGB</>
                  )}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>
      
      <div className="max-w-[1920px] mx-auto p-2">
        {/* Main Content - Optimized Layout */}
        <div className="grid grid-cols-12 gap-3 h-[calc(100vh-80px)]">
          {/* Left Sidebar - Inputs & Controls */}
          <div className="col-span-12 lg:col-span-3 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
            {/* Step 1: Template Upload - Compact */}
            <Card className="overflow-hidden">
              <CardHeader className="py-2 px-3 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">1</div>
                    Template
                  </CardTitle>
                  {template && <CheckCircle className="w-3 h-3 text-green-500" />}
                </div>
              </CardHeader>
              <CardContent className="p-2">
                <label className="block">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => e.target.files?.[0] && onUploadTemplate(e.target.files[0])}
                    className="hidden"
                    disabled={isProcessing}
                  />
                  <Button 
                    variant={template ? "secondary" : "default"}
                    size="sm"
                    className="w-full" 
                    asChild
                    disabled={isProcessing}
                  >
                    <span className="cursor-pointer">
                      <Upload className="w-3 h-3 mr-2" />
                      {template ? 'Change Template' : 'Upload Template'}
                    </span>
                  </Button>
                </label>
                {template && (
                  <div className="mt-2 text-xs text-gray-600">
                    <a 
                      href={toAbsoluteUrl(template.image?.url)} 
                      target="_blank"
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      View ({template.imageMeta?.width} × {template.imageMeta?.height}px)
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Step 2: Data Upload - Compact */}
            <Card className="overflow-hidden">
              <CardHeader className="py-2 px-3 bg-gradient-to-r from-green-50 to-emerald-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-green-500 text-white text-[10px] flex items-center justify-center font-bold">2</div>
                    Data Source
                  </CardTitle>
                  {dataset && <CheckCircle className="w-3 h-3 text-green-500" />}
                </div>
              </CardHeader>
              <CardContent className="p-2">
                <label className="block">
                  <input 
                    type="file" 
                    accept=".xlsx,.csv" 
                    onChange={(e) => e.target.files?.[0] && onUploadDataset(e.target.files[0])}
                    className="hidden"
                    disabled={isProcessing}
                  />
                  <Button 
                    variant={dataset ? "secondary" : "default"}
                    size="sm"
                    className="w-full"
                    asChild
                    disabled={isProcessing}
                  >
                    <span className="cursor-pointer">
                      <Upload className="w-3 h-3 mr-2" />
                      {dataset ? 'Change Data' : 'Upload Excel/CSV'}
                    </span>
                  </Button>
                </label>
                {dataset && (
                  <div className="mt-2 flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">{dataset.rowCount} rows</Badge>
                    <Badge variant="outline" className="text-xs">{dataset.headers?.length} columns</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Available Columns - Compact List */}
            {dataset && (
              <Card className="overflow-hidden flex-1">
                <CardHeader className="py-2 px-3 bg-gray-50">
                  <CardTitle className="text-xs">Available Columns</CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                    {dataset.headers.map((h) => (
                      <div 
                        key={h} 
                        className="flex items-center gap-2 p-2 text-xs rounded border bg-white hover:bg-blue-50 hover:border-blue-300 transition-all cursor-move"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        <span className="truncate font-medium">{h}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Drag columns to template →
                  </p>
                </CardContent>
              </Card>
            )}
            
            {/* Export Options - Compact */}
            <Card className="overflow-hidden">
              <CardHeader className="py-2 px-3 bg-gradient-to-r from-purple-50 to-pink-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-purple-500 text-white text-[10px] flex items-center justify-center font-bold">3</div>
                    Export
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-2 space-y-2">
                {/* PDF Format Selection - Compact */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Format</Label>
                  <RadioGroup value={pdfFormat} onValueChange={setPdfFormat} className="flex flex-row gap-3">
                    <div className="flex items-center space-x-1">
                      <RadioGroupItem value="cmyk" id="cmyk" disabled={!cmykSupport?.cmykSupported} />
                      <Label htmlFor="cmyk" className="text-xs cursor-pointer">
                        CMYK
                      </Label>
                    </div>
                    <div className="flex items-center space-x-1">
                      <RadioGroupItem value="rgb" id="rgb" />
                      <Label htmlFor="rgb" className="text-xs cursor-pointer">
                        RGB
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                
                {/* Action Buttons - Compact */}
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-full"
                    onClick={onPreview}
                    disabled={!template || !dataset || isProcessing}
                  >
                    {isProcessing && status?.includes('preview') ? (
                      <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> Generating...</>
                    ) : (
                      <><Eye className="w-3 h-3 mr-2" /> Preview</>
                    )}
                  </Button>
                  
                  <Button 
                    size="sm"
                    className="w-full"
                    onClick={() => onDownloadPDF(pdfFormat)}
                    disabled={!template || !dataset || isProcessing}
                  >
                    {isProcessing && (status?.includes('PDF') || status?.includes('pdf')) ? (
                      <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> Generating...</>
                    ) : (
                      <><Download className="w-3 h-3 mr-2" /> Generate PDF</>
                    )}
                  </Button>
                </div>
                
                {!cmykSupport?.cmykSupported && pdfFormat === 'cmyk' && (
                  <Button 
                    variant="link" 
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setShowCmykGuide(true)}
                  >
                    Setup CMYK →
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Center - Main Workspace */}
          <div className="col-span-12 lg:col-span-6 h-full overflow-hidden">
            <Card className="h-full flex flex-col">
              <CardHeader className="py-2 px-3 bg-gradient-to-r from-indigo-50 to-blue-50 flex-row items-center justify-between flex-shrink-0">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Layout className="w-4 h-4" />
                  Template Designer
                </CardTitle>
                <div className="flex items-center gap-2">
                  {fieldsDirty && (
                    <Badge variant="warning" className="text-xs">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Unsaved
                    </Badge>
                  )}
                  <Button 
                    onClick={onSaveLayout}
                    disabled={!template || (!fieldsDirty && !mappingChanged) || isProcessing}
                    size="sm"
                    variant={fieldsDirty ? "default" : "outline"}
                  >
                    {isProcessing ? (
                      <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Saving...</>
                    ) : (
                      <><Save className="w-3 h-3 mr-1" /> Save</>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-2 flex-1 overflow-auto">
                <div className="h-full w-full flex items-center justify-center">
                  <FieldEditor 
                    imageUrl={toAbsoluteUrl(template?.image?.url)} 
                    fields={fields} 
                    onChange={handleFieldsChange}
                    maxHeight={window.innerHeight - 200}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Right - Preview Panel */}
          <div className="col-span-12 lg:col-span-3 h-full overflow-hidden">
            <Card className="h-full flex flex-col">
              <CardHeader className="py-2 px-3 bg-gradient-to-r from-purple-50 to-pink-50 flex-shrink-0">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Live Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 flex-1 overflow-y-auto custom-scrollbar">
                {previewUrl ? (
                  <div className="space-y-3">
                    <div className="relative group">
                      <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="w-full rounded-lg border shadow-sm" 
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80"
                        onClick={() => setPreviewUrl('')}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    
                    {/* Sample Data Display */}
                    {dataset?.sampleRows?.[0] && (
                      <div className="border rounded-lg p-3 bg-gray-50">
                        <p className="text-xs font-medium text-gray-700 mb-2">Preview Data (Row 1):</p>
                        <div className="space-y-1">
                          {Object.entries(dataset.sampleRows[0]).slice(0, 5).map(([key, value]) => (
                            <div key={key} className="flex justify-between text-xs">
                              <span className="text-gray-600">{key}:</span>
                              <span className="font-medium text-gray-900 truncate ml-2 max-w-[120px]">
                                {value || '-'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-6">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <Eye className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-500 text-center mb-4">
                      No preview generated yet
                    </p>
                    {template && dataset && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={onPreview}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> Generating...</>
                        ) : (
                          <><Eye className="w-3 h-3 mr-2" /> Generate Preview</>
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      <CMYKSetupGuide 
        isOpen={showCmykGuide} 
        onClose={() => setShowCmykGuide(false)} 
      />
      
      {/* Global Loading Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 flex flex-col items-center space-y-3 max-w-sm">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-900">
                {status || 'Processing...'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Please wait while we process your request
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

