'use client';

export type AppTab = 'emitir' | 'historial';

interface BottomNavProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-md grid-cols-2">
        <button
          type="button"
          onClick={() => onTabChange('emitir')}
          className={`min-h-[56px] px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'emitir'
              ? 'text-blue-600 border-t-2 border-blue-600 bg-blue-50'
              : 'text-gray-500 border-t-2 border-transparent'
          }`}
        >
          Emitir
        </button>
        <button
          type="button"
          onClick={() => onTabChange('historial')}
          className={`min-h-[56px] px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'historial'
              ? 'text-blue-600 border-t-2 border-blue-600 bg-blue-50'
              : 'text-gray-500 border-t-2 border-transparent'
          }`}
        >
          Historial
        </button>
      </div>
    </nav>
  );
}
