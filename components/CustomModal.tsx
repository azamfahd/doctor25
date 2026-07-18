import React from 'react';
import { AlertCircle, CheckCircle2, HelpCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message: string;
  type?: 'alert' | 'confirm' | 'success' | 'error';
  confirmText?: string;
  cancelText?: string;
}

const CustomModal: React.FC<CustomModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'alert',
  confirmText = 'موافق',
  cancelText = 'إلغاء'
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'confirm': return <HelpCircle className="w-12 h-12 text-blue-500" />;
      case 'success': return <CheckCircle2 className="w-12 h-12 text-emerald-500" />;
      case 'error': return <AlertCircle className="w-12 h-12 text-rose-500" />;
      default: return <AlertCircle className="w-12 h-12 text-amber-500" />;
    }
  };

  const getButtonClass = () => {
    switch (type) {
      case 'error': return 'bg-rose-600 hover:bg-rose-700 shadow-rose-200';
      case 'success': return 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200';
      default: return 'bg-blue-600 hover:bg-blue-700 shadow-blue-200';
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100"
        >
          <div className="p-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-slate-50 rounded-full">
                {getIcon()}
              </div>
            </div>
            
            <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">
              {title}
            </h3>
            
            <p className="text-slate-500 font-medium leading-relaxed mb-8">
              {message}
            </p>

            <div className="flex flex-col sm:flex-row-reverse gap-3">
              <button
                onClick={() => {
                  onConfirm?.();
                  onClose();
                }}
                className={`flex-1 py-4 px-6 rounded-2xl text-white font-black transition-all shadow-lg active:scale-95 ${getButtonClass()}`}
              >
                {confirmText}
              </button>
              
              {type === 'confirm' && (
                <button
                  onClick={onClose}
                  className="flex-1 py-4 px-6 rounded-2xl bg-slate-100 text-slate-600 font-black hover:bg-slate-200 transition-all active:scale-95"
                >
                  {cancelText}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CustomModal;
