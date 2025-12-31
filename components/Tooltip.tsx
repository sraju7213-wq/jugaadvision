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
      <div className={`absolute ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} left-1/2 -translate-x-1/2 scale-0 transition-all duration-200 rounded-lg bg-gray-900 dark:bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-white dark:text-gray-900 opacity-0 group-hover:scale-100 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-md`}>
        {content}
        <div className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${position === 'top' ? 'top-full border-t-gray-900 dark:border-t-gray-100' : 'bottom-full border-b-gray-900 dark:border-b-gray-100'}`}></div>
      </div>
    </div>
  );
};

export default Tooltip;