import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SearchType } from '../types';
import { applyMask, getPlaceholder, detectSearchType } from '../utils';

interface SearchBarProps {
  searchType: SearchType;
  onSearchTypeChange: (type: SearchType) => void;
  onSearch: (query: string) => void;
  isSearching: boolean;
  disabled?: boolean;
}

export function SearchBar({
  searchType,
  onSearchTypeChange,
  onSearch,
  isSearching,
  disabled,
}: SearchBarProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-detect search type as user types
  useEffect(() => {
    if (inputValue.length >= 3) {
      const detected = detectSearchType(inputValue);
      if (detected !== searchType) {
        onSearchTypeChange(detected);
      }
    }
  }, [inputValue, searchType, onSearchTypeChange]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const masked = applyMask(raw, searchType);
      setInputValue(masked);
    },
    [searchType]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (inputValue.trim() && !isSearching) {
        onSearch(inputValue.trim());
      }
    },
    [inputValue, isSearching, onSearch]
  );

  const handleClear = useCallback(() => {
    setInputValue('');
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClear();
      }
    },
    [handleClear]
  );

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative group">
        {/* Glow effect on focus */}
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
        
        <div className="relative flex items-center">
          {/* Search icon */}
          <div className="absolute left-4 z-10 pointer-events-none">
            {isSearching ? (
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            ) : (
              <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            )}
          </div>

          {/* Input */}
          <Input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder(searchType)}
            disabled={disabled || isSearching}
            className={cn(
              'pl-12 pr-24 h-14 text-lg rounded-xl border-2',
              'bg-card/50 backdrop-blur-sm',
              'placeholder:text-muted-foreground/60',
              'focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary',
              'transition-all duration-200'
            )}
          />

          {/* Clear button */}
          {inputValue && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-24 p-1 rounded-md hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}

          {/* Submit button */}
          <Button
            type="submit"
            disabled={!inputValue.trim() || isSearching || disabled}
            className={cn(
              'absolute right-2 h-10 px-6 rounded-lg',
              'bg-primary hover:bg-primary/90',
              'shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30',
              'transition-all duration-200'
            )}
          >
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Buscando...
              </>
            ) : (
              'Buscar'
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
