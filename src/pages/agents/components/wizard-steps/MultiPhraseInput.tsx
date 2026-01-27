import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Plus } from 'lucide-react';

interface MultiPhraseInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function MultiPhraseInput({ value, onChange, placeholder }: MultiPhraseInputProps) {
  const [newPhrase, setNewPhrase] = useState('');

  // Parse phrases from "||" separated string
  const phrases = value ? value.split('||').map(p => p.trim()).filter(Boolean) : [];

  const addPhrase = () => {
    if (!newPhrase.trim()) return;
    
    const updatedPhrases = [...phrases, newPhrase.trim()];
    onChange(updatedPhrases.join('||'));
    setNewPhrase('');
  };

  const removePhrase = (index: number) => {
    const updatedPhrases = phrases.filter((_, i) => i !== index);
    onChange(updatedPhrases.join('||'));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addPhrase();
    }
  };

  return (
    <div className="space-y-2">
      {/* List of existing phrases */}
      {phrases.length > 0 && (
        <div className="space-y-1">
          {phrases.map((phrase, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 bg-muted rounded-md group"
            >
              <span className="flex-1 text-sm">{phrase}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removePhrase(index)}
                className="h-6 w-6 p-0 opacity-50 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Input for new phrase */}
      <div className="flex gap-2">
        <Input
          value={newPhrase}
          onChange={(e) => setNewPhrase(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Digite uma frase e pressione Enter"}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addPhrase}
          disabled={!newPhrase.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
