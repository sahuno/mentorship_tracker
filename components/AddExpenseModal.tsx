import React, { useState, useEffect, useRef } from 'react';
import { Expense } from '../types';
import CloseIcon from './icons/CloseIcon';
import { analyzeReceipt, openProtectedReceipt } from '../src/lib/receiptOcr';

interface AddExpenseModalProps {
  onClose: () => void;
  onSave: (expense: Expense | Omit<Expense, 'id'>) => void;
  expenseToEdit?: Expense | null;
  cycleId?: string;
}

type OcrResult = {
  item: string;
  amount: number;
  date?: string;
};

const AddExpenseModal: React.FC<AddExpenseModalProps> = ({ onClose, onSave, expenseToEdit, cycleId }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [contact, setContact] = useState('');
  const [remarks, setRemarks] = useState('');
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [storedReceiptUrl, setStoredReceiptUrl] = useState<string | null>(expenseToEdit?.receiptUrl || null);
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(expenseToEdit?.receiptUrl || null);

  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrResults, setOcrResults] = useState<OcrResult[]>([]);

  const isEditing = !!expenseToEdit;
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusableElementRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expenseToEdit) {
      setDate(expenseToEdit.date.split('T')[0]);
      setItem(expenseToEdit.item);
      setAmount(String(expenseToEdit.amount));
      setContact(expenseToEdit.contact || '');
      setRemarks(expenseToEdit.remarks || '');
      setReceiptPreview(null);
      setStoredReceiptUrl(expenseToEdit.receiptUrl || null);
      setExistingReceiptUrl(expenseToEdit.receiptUrl || null);
      setOcrResults([]);
      setOcrError(null);
    } else {
      setReceiptPreview(null);
      setStoredReceiptUrl(null);
      setExistingReceiptUrl(null);
      setOcrResults([]);
      setOcrError(null);
    }
  }, [expenseToEdit]);

  useEffect(() => {
    return () => {
      if (receiptPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(receiptPreview);
      }
    };
  }, [receiptPreview]);

  // Accessibility: Focus trapping and Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
      // Basic focus trapping
      if (event.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) { // Shift+Tab
          if (document.activeElement === firstElement) {
            lastElement.focus();
            event.preventDefault();
          }
        } else { // Tab
          if (document.activeElement === lastElement) {
            firstElement.focus();
            event.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Focus the first input element on mount
    firstFocusableElementRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);


  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (receiptPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(receiptPreview);
      }

      setReceiptPreview(URL.createObjectURL(file));
      // Clear only the pending new-upload URL. Do NOT clear existingReceiptUrl:
      // the previously-attached receipt must survive until the replacement upload
      // actually succeeds, so a failed re-upload never destroys the prior receipt.
      setStoredReceiptUrl(null);
      setOcrError(null);
      setOcrResults([]);

      setIsOcrLoading(true);
      void analyzeReceipt(file, cycleId)
        .then((result) => {
          if (result.receiptUrl) {
            // New upload succeeded: it replaces the previous receipt on save.
            setStoredReceiptUrl(result.receiptUrl);
          }
          setOcrResults(result.ocrResults);
          setOcrError(result.analysisError || null);
        })
        .catch((err: unknown) => {
          console.error('OCR Error:', err);
          // Upload/analysis failed: keep existingReceiptUrl intact so saving falls
          // back to the original receipt instead of persisting an empty value.
          setOcrError(err instanceof Error ? err.message : 'Failed to analyze receipt. Please try again or enter details manually.');
        })
        .finally(() => {
          setIsOcrLoading(false);
        });
    }
  };
  
  const handleOcrResultClick = (result: OcrResult) => {
    setItem(result.item);
    setAmount(String(result.amount));
    if (result.date) {
      try {
        const validDate = new Date(result.date).toISOString().split('T')[0];
        setDate(validDate);
      } catch (e) {
        // Ignore invalid dates from OCR
      }
    }
  };

  const handleOpenExistingReceipt = async () => {
    if (!existingReceiptUrl) {
      return;
    }

    try {
      await openProtectedReceipt(existingReceiptUrl);
    } catch (error) {
      console.error('Failed to open receipt:', error);
      setOcrError(error instanceof Error ? error.message : 'Failed to open receipt.');
    }
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Guard: never save while a receipt upload/OCR is still in flight, otherwise the
    // expense persists with receiptUrl: undefined despite the visible preview.
    if (isOcrLoading) {
      return;
    }
    const expenseData = {
      date,
      item,
      amount: parseFloat(amount),
      contact,
      remarks,
      receiptUrl: storedReceiptUrl || existingReceiptUrl || undefined,
    };

    if (isEditing) {
      onSave({ ...expenseData, id: expenseToEdit.id });
    } else {
      onSave(expenseData);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div ref={modalRef} className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-full overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h3 id="modal-title" className="text-2xl font-bold text-gray-900">{isEditing ? 'Edit Expense' : 'Add New Expense'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors duration-200" aria-label="Close modal">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700">Date</label>
                <input ref={firstFocusableElementRef} type="date" id="date" value={date} onChange={e => setDate(e.target.value)} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
              </div>
              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Amount</label>
                <input type="number" id="amount" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0.00" step="0.01" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
              </div>
            </div>
            <div>
              <label htmlFor="item" className="block text-sm font-medium text-gray-700">Item / Description</label>
              <input type="text" id="item" value={item} onChange={e => setItem(e.target.value)} required placeholder="e.g., Piano Lessons" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
            </div>
            <div>
              <label htmlFor="contact" className="block text-sm font-medium text-gray-700">Contact (Optional)</label>
              <input type="text" id="contact" value={contact} onChange={e => setContact(e.target.value)} placeholder="e.g., Music School" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
            </div>
            <div>
              <label htmlFor="remarks" className="block text-sm font-medium text-gray-700">Remarks (Optional)</label>
              <textarea id="remarks" value={remarks} onChange={e => setRemarks(e.target.value)} rows={3} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Upload Receipt (Optional)</label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  {receiptPreview ? (
                    <img src={receiptPreview} alt="Receipt Preview" className="mx-auto h-24 w-auto"/>
                  ) : existingReceiptUrl ? (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">A receipt is already attached to this expense.</p>
                      <button
                        type="button"
                        onClick={handleOpenExistingReceipt}
                        className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                      >
                        Open existing receipt
                      </button>
                    </div>
                  ) : (
                    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                  )}
                  <div className="flex text-sm text-gray-600">
                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                      <span>Upload a file</span>
                      <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleReceiptChange} accept="image/*"/>
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">PNG, JPG, GIF, WEBP up to 10MB</p>
                </div>
              </div>
              {isOcrLoading && <p className="mt-2 text-center text-sm text-indigo-600 animate-pulse">Analyzing receipt...</p>}
              {ocrError && <p className="mt-2 text-center text-sm text-red-600">{ocrError}</p>}
              {ocrResults.length > 0 && (
                <div className="mt-4 p-4 bg-indigo-50 rounded-md">
                  <h4 className="font-bold text-gray-800">Detected Expenses</h4>
                  <p className="text-sm text-gray-600 mb-2">Click an item to auto-fill the form.</p>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {ocrResults.map((result, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleOcrResultClick(result)}
                        className="w-full text-left p-2 bg-white rounded shadow hover:bg-indigo-100 transition-colors duration-200 flex justify-between items-center"
                      >
                        <span className="truncate pr-2">{result.item}</span>
                        <span className="font-semibold text-indigo-800">${result.amount.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="p-6 bg-gray-50 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200">Cancel</button>
            <button type="submit" disabled={isOcrLoading} aria-busy={isOcrLoading} title={isOcrLoading ? 'Please wait for the receipt to finish uploading' : undefined} className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-600">{isOcrLoading ? 'Uploading receipt...' : isEditing ? 'Save Changes' : 'Add Expense'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddExpenseModal;
