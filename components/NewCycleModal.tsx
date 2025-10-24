import React, { useState, useEffect, useRef } from 'react';
import CloseIcon from './icons/CloseIcon';

interface NewCycleModalProps {
  onClose: () => void;
  onStartCycle: (budget: number, startDate: string, endDate: string) => void;
}

const NewCycleModal: React.FC<NewCycleModalProps> = ({ onClose, onStartCycle }) => {
  const [budget, setBudget] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusableElementRef = useRef<HTMLInputElement>(null);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if(parseFloat(budget) > 0 && startDate && endDate && startDate <= endDate) {
      onStartCycle(parseFloat(budget), startDate, endDate);
    } else {
        alert("Please fill in all fields correctly. End date must be after start date.");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-cycle-modal-title"
    >
      <div ref={modalRef} className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6 border-b flex justify-between items-center">
          <h3 id="new-cycle-modal-title" className="text-2xl font-bold text-gray-900">Start New Spending Cycle</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors duration-200" aria-label="Close modal">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="budget" className="block text-sm font-medium text-gray-700">Total Budget for Cycle</label>
              <input ref={firstFocusableElementRef} type="number" id="budget" value={budget} onChange={e => setBudget(e.target.value)} required placeholder="1000.00" step="0.01" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Start Date</label>
                <input type="date" id="startDate" value={startDate} onChange={e => setStartDate(e.target.value)} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
              </div>
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">End Date</label>
                <input type="date" id="endDate" value={endDate} onChange={e => setEndDate(e.target.value)} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
              </div>
            </div>
          </div>
          <div className="p-6 bg-gray-50 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200">Cancel</button>
            <button type="submit" className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors duration-200">Start Cycle</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewCycleModal;