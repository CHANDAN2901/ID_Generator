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
  Layout, Sparkles, X
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  ID Card Generator
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Professional ID card creation made simple
                </p>
              </div>
            </div>
            {cmykSupport && (
              <Badge variant={cmykSupport.cmykSupported ? 'success' : 'warning'}>
                {cmykSupport.cmykSupported ? (
                  <><Palette className="w-3 h-3 mr-1" /> CMYK Ready</>
                ) : (
                  <><Monitor className="w-3 h-3 mr-1" /> RGB Only</>
                )}
              </Badge>
            )}
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-1 space-y-6">
            {/* Template Upload Card */}
            <Card className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                <CardTitle className="flex items-center gap-2">
                  <FileImage className="w-5 h-5" />
                  Template Upload
                </CardTitle>
                <CardDescription>
                  Upload your ID card template image
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <label className="relative block">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => e.target.files?.[0] && onUploadTemplate(e.target.files[0])}
                      className="hidden"
                      disabled={isProcessing}
                    />
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      asChild
                      disabled={isProcessing}
                    >
                      <span className="cursor-pointer">
                        <Upload className="w-4 h-4 mr-2" />
                        Choose Template Image
                      </span>
                    </Button>
                  </label>
                  
                  {template && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">Template loaded</span>
                      </div>
                      <div className="mt-2 space-y-1">
                        <a 
                          className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1" 
                          href={toAbsoluteUrl(template.image?.url)} 
                          target="_blank"
                        >
                          <Eye className="w-3 h-3" />
                          View full image
                        </a>
                        {template.imageMeta?.width && template.imageMeta?.height && (
                          <div className="text-xs text-gray-600">
                            Dimensions: {template.imageMeta.width} × {template.imageMeta.height}px
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-700">
                      <strong>Tip:</strong> After uploading, drag fields on the template to position them and resize by dragging edges.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Excel Upload Card */}
            <Card className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  Data Source
                </CardTitle>
                <CardDescription>
                  Upload Excel file with ID card data
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <label className="relative block">
                    <input 
                      type="file" 
                      accept=".xlsx,.csv" 
                      onChange={(e) => e.target.files?.[0] && onUploadDataset(e.target.files[0])}
                      className="hidden"
                      disabled={isProcessing}
                    />
                    <Button 
                      variant="outline" 
                      className="w-full"
                      asChild
                      disabled={isProcessing}
                    >
                      <span className="cursor-pointer">
                        <Upload className="w-4 h-4 mr-2" />
                        Choose Excel/CSV File
                      </span>
                    </Button>
                  </label>
                  
                  {dataset && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-green-700">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">Data loaded</span>
                        </div>
                        <Badge variant="secondary">{dataset.rowCount} rows</Badge>
                      </div>
                    </div>
                  )}
                  
                  {fieldsDirty && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center gap-2 text-amber-700">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-xs font-medium">You have unsaved layout changes</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Preview & Generate Card */}
            <Card className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Preview & Generate
                </CardTitle>
                <CardDescription>
                  Preview and export your ID cards
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {/* Preview Image */}
                  {previewUrl ? (
                    <div className="relative group">
                      <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="w-full rounded-lg border shadow-sm" 
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setPreviewUrl('')}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="h-48 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center">
                      <p className="text-sm text-gray-400">No preview generated</p>
                    </div>
                  )}
                  
                  {/* PDF Format Selection */}
                  <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                    <Label className="text-sm font-medium">Export Format</Label>
                    <RadioGroup value={pdfFormat} onValueChange={setPdfFormat}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem 
                          value="cmyk" 
                          id="cmyk" 
                          disabled={!cmykSupport?.cmykSupported}
                        />
                        <Label htmlFor="cmyk" className="flex items-center gap-2 cursor-pointer">
                          <Palette className="w-4 h-4" />
                          CMYK (Print-ready)
                          {cmykSupport?.cmykSupported ? (
                            <Badge variant="success" className="text-xs py-0">Available</Badge>
                          ) : (
                            <Badge variant="warning" className="text-xs py-0">Requires setup</Badge>
                          )}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="rgb" id="rgb" />
                        <Label htmlFor="rgb" className="flex items-center gap-2 cursor-pointer">
                          <Monitor className="w-4 h-4" />
                          RGB (Screen/Web)
                        </Label>
                      </div>
                    </RadioGroup>
                    
                    {cmykSupport && !cmykSupport.cmykSupported && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-xs text-amber-700 mb-2">{cmykSupport.message}</p>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setShowCmykGuide(true)}
                          >
                            Setup Guide
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={async () => {
                              const support = await checkCMYKSupport()
                              setCmykSupport(support)
                              if (support.cmykSupported) {
                                setPdfFormat('cmyk')
                                setStatus('CMYK support detected! 🎉')
                              }
                            }}
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Recheck
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={onPreview}
                      disabled={!template || !dataset || isProcessing}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Generate Preview
                    </Button>
                    
                    <Button 
                      className="w-full"
                      onClick={() => onDownloadPDF(pdfFormat)}
                      disabled={!template || !dataset || isProcessing}
                    >
                      {pdfFormat === 'cmyk' ? (
                        <><Palette className="w-4 h-4 mr-2" /> Download CMYK PDF</>
                      ) : (
                        <><Monitor className="w-4 h-4 mr-2" /> Download RGB PDF</>
                      )}
                    </Button>
                    
                    {/* Quick switch button */}
                    {template && dataset && (
                      <div className="flex gap-2">
                        {cmykSupport?.cmykSupported && pdfFormat === 'rgb' && (
                          <Button 
                            variant="secondary" 
                            size="sm"
                            className="flex-1"
                            onClick={() => onDownloadPDF('cmyk')}
                            disabled={isProcessing}
                          >
                            <Palette className="w-3 h-3 mr-1" />
                            Quick CMYK
                          </Button>
                        )}
                        {pdfFormat === 'cmyk' && (
                          <Button 
                            variant="secondary" 
                            size="sm"
                            className="flex-1"
                            onClick={() => onDownloadPDF('rgb')}
                            disabled={isProcessing}
                          >
                            <Monitor className="w-3 h-3 mr-1" />
                            Quick RGB
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Status Message */}
                  {status && (
                    <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs text-blue-700">{status}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Field Editor */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden h-full">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50">
                <CardTitle className="flex items-center gap-2">
                  <Layout className="w-5 h-5" />
                  Template Designer
                </CardTitle>
                <CardDescription>
                  Arrange data fields on your template
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                  {/* Column list */}
                  <div className="xl:col-span-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Available Columns</Label>
                      {dataset?.headers?.length > 0 ? (
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                          {dataset.headers.map((h) => (
                            <div 
                              key={h} 
                              className="flex items-center gap-2 p-2 rounded-lg border bg-white hover:bg-blue-50 hover:border-blue-300 transition-all cursor-move"
                            >
                              <div className="w-2 h-2 rounded-full bg-blue-500" />
                              <span className="text-sm font-medium truncate">{h}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                          <p className="text-xs text-gray-400 text-center">
                            Upload an Excel file to see available columns
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Field Editor */}
                  <div className="xl:col-span-8">
                    <FieldEditor 
                      imageUrl={toAbsoluteUrl(template?.image?.url)} 
                      fields={fields} 
                      onChange={handleFieldsChange}
                      width={450}
                    />
                    
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button 
                        onClick={onSaveLayout}
                        disabled={!template || (!fieldsDirty && !mappingChanged) || isProcessing}
                        className="flex-1 sm:flex-initial"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save Layout
                      </Button>
                      
                      {!template && (
                        <Badge variant="outline" className="text-xs">
                          Upload template first
                        </Badge>
                      )}
                      
                      {template && !fieldsDirty && !mappingChanged && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Saved
                        </Badge>
                      )}
                      
                      {fieldsDirty && (
                        <Badge variant="warning" className="text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Unsaved changes
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      <CMYKSetupGuide 
        isOpen={showCmykGuide} 
        onClose={() => setShowCmykGuide(false)} 
      />
    </div>
  )
}

