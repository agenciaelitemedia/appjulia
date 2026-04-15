import { useState, useCallback } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StartConversationDialog } from './StartConversationDialog';

interface StartConversationFooterProps {
  codAgent: string | null;
  onConversationStarted: (whatsappNumber: string) => void;
}

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function StartConversationFooter({ codAgent, onConversationStarted }: StartConversationFooterProps) {
  const [countryCode, setCountryCode] = useState('55');
  const [phone, setPhone] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const phoneDigits = phone.replace(/\D/g, '');
  const isValid = phoneDigits.length >= 10;

  // Format number based on DDD rules
  const getFormattedNumber = useCallback(() => {
    const ddd = phoneDigits.slice(0, 2);
    const dddNum = parseInt(ddd, 10);
    let localDigits = phoneDigits.slice(2);
    
    // If DDD > 30 and number has 9 digits, remove the leading 9
    if (dddNum > 30 && localDigits.length === 9 && localDigits.startsWith('9')) {
      localDigits = localDigits.slice(1);
    }
    
    return `${countryCode}${ddd}${localDigits}`;
  }, [phoneDigits, countryCode]);

  const fullNumber = getFormattedNumber();

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneInput(e.target.value));
  }, []);

  const handleConversarClick = useCallback(() => {
    if (isValid && codAgent) {
      setDialogOpen(true);
    }
  }, [isValid, codAgent]);

  const handleConversationStarted = useCallback(() => {
    setDialogOpen(false);
    onConversationStarted(fullNumber);
    setPhone('');
  }, [fullNumber, onConversationStarted]);

  return (
    <>
      <div className="px-3 py-2 border-t bg-muted/30">
        <p className="text-[10px] text-muted-foreground mb-1.5">Iniciar nova conversa</p>
        <div className="flex items-center gap-1.5">
          <Select value={countryCode} onValueChange={setCountryCode}>
            <SelectTrigger className="h-8 w-[72px] text-xs shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="55" className="text-xs">+55</SelectItem>
              <SelectItem value="1" className="text-xs">+1</SelectItem>
              <SelectItem value="351" className="text-xs">+351</SelectItem>
              <SelectItem value="54" className="text-xs">+54</SelectItem>
              <SelectItem value="56" className="text-xs">+56</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={phone}
            onChange={handlePhoneChange}
            placeholder="(00) 00000-0000"
            className="h-8 text-xs flex-1"
          />
          <Button
            size="sm"
            className="h-8 text-xs px-3 shrink-0"
            disabled={!isValid || !codAgent}
            onClick={handleConversarClick}
          >
            <MessageSquarePlus className="h-3.5 w-3.5 mr-1" />
            Conversar
          </Button>
        </div>
      </div>

      <StartConversationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        whatsappNumber={fullNumber}
        codAgent={codAgent || ''}
        onSuccess={handleConversationStarted}
      />
    </>
  );
}
