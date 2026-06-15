'use client';

import { ReactNode } from 'react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md rounded-t-2xl bg-white shadow-2xl max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-center py-3">
          <div className="h-1.5 w-12 rounded-full bg-gray-300" />
        </div>
        <div className="px-6 pb-2">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        </div>
        <div className="overflow-y-auto overscroll-contain px-6 pb-8">{children}</div>
      </div>
    </div>
  );
}
