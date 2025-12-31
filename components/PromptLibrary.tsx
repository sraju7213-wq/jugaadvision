
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Prompt } from '../types';
import { CopyIcon, CheckIcon, TrashIcon, XIcon, FolderIcon } from './icons';

interface PromptLibraryProps {
    prompts: Prompt[];
    setPrompts: React.Dispatch<React.SetStateAction<Prompt[]>>;
    onUsePrompt: (prompt: Prompt) => void;
}

const PromptCard: React.FC<{
    prompt: Prompt;
    onUse: (prompt: Prompt) => void;
    onDelete: (id: string) => void;
    onUpdateTags: (id: string, tags: string[]) => void;
}> = ({ prompt, onUse, onDelete, onUpdateTags }) => {
    const [copied, setCopied] = useState(false);
    const [isEditingTags, setIsEditingTags] = useState(false);
    const [tagsInput, setTagsInput] = useState(prompt.tags?.join(', ') || '');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditingTags && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditingTags]);

    const handleCopy = () => {
        navigator.clipboard.writeText(prompt.text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSaveTags = () => {
        const newTags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
        onUpdateTags(prompt.id, newTags);
        setIsEditingTags(false);
    };

    return (
        <div className="group bg-md-surface-container rounded-3xl border border-md-outline/10 flex flex-col justify-between h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-md-primary/20 overflow-hidden">
            
            {prompt.imageUrl && (
                <div className="w-full h-40 overflow-hidden relative bg-black/5">
                    <img src={prompt.imageUrl} alt="Saved result" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
            )}

            <div className="p-6 flex-grow flex flex-col">
                <div className="flex justify-between items-start mb-3">
                    <span className="px-3 py-1 rounded-lg bg-md-surface-container-high text-[10px] font-bold tracking-wider uppercase text-md-on-surface-variant">
                        {prompt.platform}
                    </span>
                    <span className="text-[10px] text-md-on-surface-variant font-mono">
                        {new Date(prompt.createdAt).toLocaleDateString()}
                    </span>
                </div>
                
                <p className="text-md-on-surface text-sm leading-relaxed line-clamp-3 font-medium flex-grow">
                    {prompt.text}
                </p>

                {isEditingTags ? (
                     <div className="mt-4 animate-pop">
                        <input
                            ref={inputRef}
                            type="text"
                            value={tagsInput}
                            onChange={(e) => setTagsInput(e.target.value)}
                            onBlur={handleSaveTags}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveTags()}
                            placeholder="Add tags, comma-separated"
                            className="w-full text-xs bg-md-surface-container-high/50 border border-md-primary/50 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-md-primary"
                        />
                    </div>
                ) : (
                    <div className="flex gap-2 flex-wrap mt-4">
                        {prompt.tags?.map(tag => (
                            <span key={tag} className="px-2 py-1 rounded-md bg-md-primary/10 text-[10px] font-bold text-md-primary">
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>
            
            <div className="p-4 bg-md-surface-container-low border-t border-md-outline/5 flex items-center justify-between gap-2 mt-auto">
                <div className="flex gap-1">
                    <button onClick={handleCopy} className="p-2.5 rounded-xl text-md-on-surface-variant hover:bg-md-surface-container-high hover:text-green-500 transition-colors" title="Copy">{copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}</button>
                    <button onClick={() => setIsEditingTags(!isEditingTags)} className="p-2.5 rounded-xl text-md-on-surface-variant hover:bg-md-surface-container-high hover:text-md-primary transition-colors" title="Edit Tags">
                        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                    </button>
                    <button onClick={() => onDelete(prompt.id)} className="p-2.5 rounded-xl text-md-on-surface-variant hover:bg-red-100 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors" title="Delete"><TrashIcon className="h-4 w-4"/></button>
                </div>
                <button onClick={() => onUse(prompt)} className="px-4 py-2 text-xs font-bold uppercase tracking-wide rounded-xl bg-md-primary text-md-on-primary hover:bg-opacity-90 transition-colors shadow-sm">Load</button>
            </div>
        </div>
    );
};

const PromptLibrary: React.FC<PromptLibraryProps> = ({ prompts, setPrompts, onUsePrompt }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTag, setSelectedTag] = useState<string | null>(null);

    const handleDelete = (id: string) => setPrompts(prompts.filter(p => p.id !== id));
    const handleUpdateTags = (id: string, tags: string[]) => {
        setPrompts(prompts.map(p => p.id === id ? { ...p, tags } : p));
    };

    const allTags = useMemo(() => Array.from(new Set(prompts.flatMap(p => p.tags || []))).sort(), [prompts]);

    const filteredPrompts = useMemo(() => {
        return prompts
            .filter(p => 
                p.text.toLowerCase().includes(searchTerm.toLowerCase()) &&
                (selectedTag ? p.tags?.includes(selectedTag) : true)
            )
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [prompts, searchTerm, selectedTag]);

    return (
        <div className="py-6 animate-slide-in h-[calc(100vh-8rem)] flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-md-on-surface flex items-center gap-3"><FolderIcon className="text-md-primary w-8 h-8" />My Library</h2>
                    <p className="text-md-on-surface-variant text-sm mt-1">Manage your collection of {prompts.length} saved prompts.</p>
                </div>
                <div className="relative w-full md:w-96">
                    <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search your ideas..." className="w-full pl-5 pr-12 py-3 bg-md-surface-container rounded-full border border-md-outline/10 focus:border-md-primary/50 focus:outline-none focus:ring-2 focus:ring-md-primary/20 text-md-on-surface placeholder-md-on-surface-variant/50 transition-all" />
                    {searchTerm ? <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-md-surface-variant text-md-on-surface-variant"><XIcon className="h-4 w-4"/></button> : <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none"><svg className="w-4 h-4 text-md-on-surface-variant" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg></div>}
                </div>
            </div>

            {allTags.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-4 mb-2 custom-scrollbar -mx-1 px-1">
                    <button onClick={() => setSelectedTag(null)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${selectedTag === null ? 'bg-md-on-surface text-md-surface shadow-md' : 'bg-md-surface-container border border-md-outline/10 text-md-on-surface-variant hover:bg-md-surface-container-high hover:text-md-on-surface'}`}>All</button>
                    {allTags.map(tag => <button key={tag} onClick={() => setSelectedTag(selectedTag === tag ? null : tag)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${selectedTag === tag ? 'bg-md-primary text-md-on-primary border-transparent shadow-md' : 'bg-md-surface-container border-md-outline/10 text-md-on-surface-variant hover:bg-md-surface-container-high hover:text-md-primary hover:border-md-primary/30'}`}>#{tag}</button>)}
                </div>
            )}
            
            {prompts.length === 0 ? (
                <div className="flex-grow flex flex-col items-center justify-center text-center p-12 bg-md-surface-container-low rounded-4xl border border-dashed border-md-outline/20">
                    <div className="w-20 h-20 bg-md-surface-container rounded-full flex items-center justify-center mb-4"><FolderIcon className="w-10 h-10 text-md-on-surface-variant" /></div>
                    <p className="text-xl font-medium text-md-on-surface mb-2">Your library is empty</p>
                    <p className="text-md-on-surface-variant max-w-sm">Create some magic in the Prompt Builder and save it here for later access.</p>
                </div>
            ) : filteredPrompts.length === 0 ? (
                 <div className="flex-grow flex items-center justify-center text-md-on-surface-variant bg-md-surface-container/20 rounded-3xl border border-dashed border-md-outline/10">
                    <p>No prompts match "{searchTerm}" {selectedTag ? `with tag #${selectedTag}` : ''}.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto pb-12 custom-scrollbar pr-2 flex-grow">
                    {filteredPrompts.map(prompt => <PromptCard key={prompt.id} prompt={prompt} onUse={onUsePrompt} onDelete={handleDelete} onUpdateTags={handleUpdateTags} />)}
                </div>
            )}
        </div>
    );
};

export default PromptLibrary;