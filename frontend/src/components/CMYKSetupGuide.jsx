import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Terminal, Palette, Info, ExternalLink } from 'lucide-react'

export default function CMYKSetupGuide({ isOpen, onClose }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-purple-600" />
            Enable CMYK PDF Generation
          </DialogTitle>
          <DialogDescription>
            Set up professional print-ready PDF generation with CMYK color space
          </DialogDescription>
        </DialogHeader>
          
        <div className="space-y-4">
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm text-blue-900">
                    CMYK PDFs are required for professional printing. To enable this feature, 
                    Ghostscript must be installed on your server.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Quick Setup */}
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-purple-100 to-pink-100 px-6 py-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                Quick Setup (Backend)
              </h3>
            </div>
            <CardContent className="pt-4">
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                <div>cd backend</div>
                <div>npm run setup-cmyk</div>
              </div>
            </CardContent>
          </Card>
            
          {/* Manual Installation */}
          <Card>
            <div className="bg-gradient-to-r from-gray-100 to-gray-200 px-6 py-3">
              <h3 className="font-semibold">Manual Installation</h3>
            </div>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">macOS</Badge>
                  </div>
                  <div className="bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-sm">
                    brew install ghostscript
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">Ubuntu/Debian</Badge>
                  </div>
                  <div className="bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-sm">
                    sudo apt-get install ghostscript
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">Windows</Badge>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    asChild
                  >
                    <a 
                      href="https://www.ghostscript.com/download/gsdnld.html" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Download from ghostscript.com
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
            
          {/* Why CMYK */}
          <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Palette className="w-5 h-5 text-purple-600 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="font-semibold text-purple-900">Why CMYK?</h4>
                  <p className="text-sm text-purple-700">
                    CMYK color space ensures accurate colors when printing ID cards professionally. 
                    RGB colors may appear different when printed, potentially causing color shifts 
                    in your final printed cards.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-700">
              <strong>Note:</strong> After installation, restart your backend server and refresh this page to detect CMYK support.
            </p>
          </div>
          
          <div className="flex justify-end">
            <Button onClick={onClose}>
              Got it
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
