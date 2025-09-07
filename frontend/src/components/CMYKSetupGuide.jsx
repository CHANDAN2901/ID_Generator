import React from 'react'

export default function CMYKSetupGuide({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-neutral-900">🎨 Enable CMYK PDF Generation</h2>
            <button 
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-600 text-xl"
            >
              ×
            </button>
          </div>
          
          <div className="space-y-4 text-sm text-neutral-700">
            <p>
              CMYK PDFs are required for professional printing. To enable this feature, 
              Ghostscript must be installed on your server.
            </p>
            
            <div className="bg-neutral-50 rounded-lg p-4">
              <h3 className="font-medium mb-2">Quick Setup (Backend)</h3>
              <div className="bg-neutral-900 text-green-400 p-3 rounded font-mono text-xs">
                cd backend<br/>
                npm run setup-cmyk
              </div>
            </div>
            
            <div className="space-y-3">
              <h3 className="font-medium">Manual Installation:</h3>
              
              <div>
                <h4 className="font-medium text-neutral-800">macOS:</h4>
                <div className="bg-neutral-900 text-green-400 p-2 rounded font-mono text-xs mt-1">
                  brew install ghostscript
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-neutral-800">Ubuntu/Debian:</h4>
                <div className="bg-neutral-900 text-green-400 p-2 rounded font-mono text-xs mt-1">
                  sudo apt-get install ghostscript
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-neutral-800">Windows:</h4>
                <p className="text-xs text-neutral-600 mt-1">
                  Download from: <a href="https://www.ghostscript.com/download/gsdnld.html" target="_blank" className="text-blue-600 underline">ghostscript.com</a>
                </p>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h4 className="font-medium text-blue-800 mb-1">Why CMYK?</h4>
              <p className="text-xs text-blue-700">
                CMYK color space ensures accurate colors when printing ID cards professionally. 
                RGB colors may appear different when printed.
              </p>
            </div>
            
            <div className="text-xs text-neutral-500">
              After installation, restart your backend server and refresh this page.
            </div>
          </div>
          
          <div className="mt-6 flex justify-end">
            <button 
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}