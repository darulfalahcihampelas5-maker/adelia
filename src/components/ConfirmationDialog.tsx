import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmationDialog({ isOpen, title, message, onConfirm, onCancel }: ConfirmationDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
      />
      
      {/* Dialog Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 opacity-100 animate-in fade-in zoom-in duration-200">
        
        {/* Header Ribbon */}
        <div className="h-2 bg-red-500 w-full"></div>
        
        <div className="p-6 sm:p-8">
          <div className="flex items-start gap-4 sm:gap-5">
            {/* Icon Container */}
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-50 flex items-center justify-center border border-red-100">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            
            {/* Content */}
            <div className="flex-1 mt-1">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {message}
              </p>
            </div>
            
            {/* Close Button */}
            <button 
              onClick={onCancel}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Action Buttons */}
          <div className="mt-8 flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4">
            <button 
              onClick={onCancel} 
              className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-300 focus:ring-4 focus:ring-gray-100 transition-all duration-200 w-full sm:w-auto"
            >
              Batal
            </button>
            <button 
              onClick={onConfirm} 
              className="px-5 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 focus:ring-4 focus:ring-red-100 shadow-sm shadow-red-500/30 transition-all duration-200 w-full sm:w-auto flex items-center justify-center gap-2"
            >
              Ya, Hapus
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
