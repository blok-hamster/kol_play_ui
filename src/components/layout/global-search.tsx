'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Search, X, TrendingUp } from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'token' | 'kol';
  name: string;
  symbol?: string;
  description: string;
  image?: string;
}

// Mock search results for demonstration
const mockResults: SearchResult[] = [
  {
    id: '1',
    type: 'token',
    name: 'Solana',
    symbol: 'SOL',
    description: 'Native token of the Solana blockchain',
  },
  {
    id: '2',
    type: 'token',
    name: 'Wrapped SOL',
    symbol: 'WSOL',
    description: 'Wrapped version of SOL for DeFi protocols',
  },
  {
    id: '3',
    type: 'kol',
    name: 'Crypto Influencer',
    description: 'Top performing trader in DeFi space',
  },
];

interface GlobalSearchProps {
  className?: string;
  placeholder?: string;
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({
  className,
  placeholder = 'Search tokens, KOLs...',
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mock search function
  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    const filteredResults = mockResults.filter(
      result =>
        result.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        result.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        result.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    setResults(filteredResults);
    setIsLoading(false);
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) {
        performSearch(query);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setIsOpen(true);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleResultClick(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleResultClick = (result: SearchResult) => {
    console.log('Selected result:', result);
    setQuery('');
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.blur();

    // Here you would navigate to the result or perform action
    // For now, just log the selection
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  return (
    <div ref={searchRef} className={cn('relative w-full', className)}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-muted-foreground" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query && setIsOpen(true)}
          className="w-full h-9 pl-9 pr-9 py-2 bg-muted/50 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 focus:border-transparent transition-colors"
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />

        {query && (
          <button
            onClick={clearSearch}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && (query || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-lg shadow-lg z-[60] max-h-80 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
              <span className="ml-2 text-sm text-muted-foreground">
                Searching...
              </span>
            </div>
          )}

          {!isLoading && results.length === 0 && query && (
            <div className="px-4 py-6 text-center">
              <Search className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No results found for "{query}"
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Try searching for tokens or KOLs
              </p>
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <>
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Results for "{query}"
                </p>
              </div>

              {results.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => handleResultClick(result)}
                  className={cn(
                    'w-full px-4 py-3 text-left flex items-center space-x-3 hover:bg-muted transition-colors',
                    selectedIndex === index && 'bg-muted'
                  )}
                >
                  <div className="flex-shrink-0">
                    {result.type === 'token' ? (
                      <div className="w-8 h-8 bg-accent-gradient rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-white">
                          {result.symbol?.charAt(0) || result.name.charAt(0)}
                        </span>
                      </div>
                    ) : (
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                        <TrendingUp className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {result.name}
                      </p>
                      {result.symbol && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                          {result.symbol}
                        </span>
                      )}
                      <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground capitalize">
                        {result.type}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {result.description}
                    </p>
                  </div>
                </button>
              ))}
            </>
          )}

          {!query && !isLoading && (
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground mb-3">
                Quick suggestions
              </p>
              <div className="space-y-1">
                <button className="w-full text-left px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors">
                  Trending tokens
                </button>
                <button className="w-full text-left px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors">
                  Top KOLs
                </button>
                <button className="w-full text-left px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors">
                  Recent searches
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
