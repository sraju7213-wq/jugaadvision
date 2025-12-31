import React from 'react';

const Loading: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="relative w-16 h-16">
                <div className="absolute top-0 left-0 w-full h-full border-4 border-purple-200 dark:border-purple-900 rounded-full"></div>
                <div className="absolute top-0 left-0 w-full h-full border-4 border-t-purple-600 rounded-full animate-spin"></div>
            </div>
            <p className="mt-4 text-gray-500 dark:text-gray-400 font-medium animate-pulse">
                Loading creative tools...
            </p>
        </div>
    );
};

export default Loading;
