import React, { ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom';
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top' }) => {
  return (
    <div className="group relative flex items-center justify-center">
      {children}
      <div className={`absolute ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} left-1/2 -translate-x-1/2 scale-95 transition-all duration-150 rounded-none bg-[var(--ui-ink)] border border-[var(--ui-border-strong)] px-2.5 py-1 text-[11px] font-mono font-medium text-[var(--ui-bg)] opacity-0 group-hover:scale-100 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-md`}>
        {content}
      </div>
    </div>
  );
};

export default Tooltip;