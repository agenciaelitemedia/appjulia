import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTelefoniaData } from '../hooks/useTelefoniaData';
import { DiscadorPad } from './DiscadorPad';

interface Props {
  codAgent: string;
}

export function DiscadorTab({ codAgent }: Props) {
  const { extensions, dial } = useTelefoniaData(codAgent);
  const [selectedExtension, setSelectedExtension] = useState<string>('');
  const [number, setNumber] = useState('');

  const activeExtensions = extensions.filter((e) => e.is_active);

  const handleDial = () => {
    if (!selectedExtension || !number) return;
    dial.mutate({
      extension: selectedExtension,
      phone: number,
    });
  };

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-center">Discador</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Ramal de origem</label>
            <Select value={selectedExtension} onValueChange={setSelectedExtension}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o ramal..." />
              </SelectTrigger>
              <SelectContent>
                {activeExtensions.map((ext) => (
                  <SelectItem key={ext.id} value={ext.extension_number}>
                    {ext.extension_number} {ext.label ? `(${ext.label})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DiscadorPad
            value={number}
            onChange={setNumber}
            onDial={handleDial}
            disabled={!selectedExtension || dial.isPending}
            isDialing={dial.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}
