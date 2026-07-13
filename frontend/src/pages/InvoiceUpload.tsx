import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, File, FileText, X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import api from '../utils/api';

export const InvoiceUpload: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];

  const validateFile = (file: File): boolean => {
    if (!allowedTypes.includes(file.type)) {
      setError('Unsupported file type. Please upload a PDF, PNG, or JPEG file.');
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File is too large. Maximum size allowed is 10MB.');
      return false;
    }
    return true;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    setError('');

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (validateFile(droppedFile)) {
        setFile(droppedFile);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
      }
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setProgress(0);
    setError('');
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleUploadSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setProgress(15); // Start fake progress trigger while server uploads and parses

    const formData = new FormData();
    formData.append('invoice', file);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) {
          clearInterval(interval);
          return 85;
        }
        return prev + 10;
      });
    }, 400);

    try {
      const response = await api.post('/invoices/upload', formData, true);
      clearInterval(interval);
      setProgress(100);
      setSuccess(true);

      // Wait for success checkmark animation, then navigate
      setTimeout(() => {
        navigate(`/invoices/${response.invoice.id}`);
      }, 1500);
    } catch (err: any) {
      clearInterval(interval);
      setLoading(false);
      setProgress(0);
      console.error('[Upload Error]', err);
      setError(
        err.message || 'An error occurred during invoice extraction. Make sure OCR credentials are set.'
      );
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Upload Invoice
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
          Process real invoices using Document AI OCR. Extracted data will automatically populate forms.
        </p>
      </div>

      {/* Main Container */}
      <div className="glass-card p-8 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-800/80">
        <AnimatePresence mode="wait">
          {!file && !loading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              onClick={triggerFileInput}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 text-center ${
                isDragActive
                  ? 'border-primary bg-primary/5 ring-4 ring-primary/10'
                  : 'border-slate-300 dark:border-slate-700 hover:border-primary dark:hover:border-primary bg-slate-50/50 dark:bg-slate-900/20'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
              />
              <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 mb-4 transition-transform group-hover:scale-110">
                <UploadCloud size={32} className="text-primary" />
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-white text-base">
                Drag & drop your invoice here
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Supports PDF, PNG, JPG, or JPEG (Max 10MB)
              </p>
              <button
                type="button"
                className="mt-6 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
              >
                Browse Files
              </button>
            </motion.div>
          )}

          {file && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="border border-slate-200 dark:border-slate-800 rounded-xl p-6 bg-slate-50/50 dark:bg-slate-900/10 flex items-center justify-between"
            >
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-primary/10 rounded-lg text-primary">
                  {file.type === 'application/pdf' ? <FileText size={24} /> : <File size={24} />}
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 dark:text-white text-sm max-w-md truncate">
                    {file.name}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatSize(file.size)} • {file.type.split('/')[1].toUpperCase()}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-red-50 hover:text-red-500 text-slate-500 dark:text-slate-400 transition-colors"
                >
                  <X size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleUploadSubmit}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-semibold shadow-md shadow-primary/15 transition-all hover:-translate-y-0.5"
                >
                  Extract with AI
                </button>
              </div>
            </motion.div>
          )}

          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-12 flex flex-col items-center justify-center text-center"
            >
              {success ? (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200 }}
                  className="flex flex-col items-center"
                >
                  <div className="w-16 h-16 rounded-full bg-success/15 text-success flex items-center justify-center mb-4">
                    <CheckCircle2 size={36} />
                  </div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-lg">
                    AI Extraction Complete!
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Redirecting to verified editor...</p>
                </motion.div>
              ) : (
                <div className="w-full max-w-md">
                  <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
                  <h3 className="font-bold text-slate-800 dark:text-white text-base">
                    AI Document OCR in progress...
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 mb-6">
                    Reading layout, extracting line items, mapping values
                  </p>
                  
                  {/* Progress bar */}
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-500 mt-2 block">
                    {progress}% Complete
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="mt-6 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 flex items-start space-x-3 text-red-600 dark:text-red-400 text-sm font-medium">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Extraction Error</span>
              <p className="text-xs mt-1 leading-relaxed">{error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
