import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, Delete } from 'lucide-react';
import { cn } from '@/lib/utils';
import { maskPhone } from '@/lib/inputMasks';

interface DiscadorPadProps {
  value: string;
  onChange: (value: string) => void;
  onDial: () => void;
  disabled?: boolean;
  isDialing?: boolean;
}

const keys = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

export function DiscadorPad({ value, onChange, onDial, disabled, isDialing }: DiscadorPadProps) {
  const handleKey = (key: string) => {
    onChange(value + key);
  };

  const handleDelete = () => {
    onChange(value.slice(0, -1));
  };

  return (
    <div className="space-y-4">
      {/* Display */}
      <Input
        value={maskPhone(value)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        placeholder="Digite o número..."
        className="text-center text-2xl font-mono tracking-widest h-14"
      />

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-2">
        {keys.flat().map((key) => (
          <Button
            key={key}
            variant="outline"
            className="h-14 text-xl font-medium hover:bg-primary/10"
            onClick={() => handleKey(key)}
          >
            {key}
          </Button>
        ))}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="h-12"
          onClick={handleDelete}
          disabled={!value}
        >
          <Delete className="h-5 w-5" />
        </Button>
        <Button
          className={cn(
            "h-12 text-lg font-medium",
            isDialing && "animate-pulse"
          )}
          onClick={onDial}
          disabled={disabled || !value}
        >
          <Phone className="h-5 w-5 mr-2" />
          {isDialing ? 'Discando...' : 'Ligar'}
        </Button>
      </div>
    </div>
  );
}
