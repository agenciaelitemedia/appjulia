import { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Search, Users, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { useContactsList, useContactsCount } from './hooks/useContactsList';
import { useDebounce } from '@/hooks/useDebounce';
import { ContactsTable } from './components/ContactsTable';

export default function ContatosPage() {
  const [tab, setTab] = useState<'contacts' | 'groups'>('contacts');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);

  const isGroup = tab === 'groups';
  const { data: contacts = [], isLoading } = useContactsList(isGroup);
  const { data: counts } = useContactsCount();

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q),
    );
  }, [contacts, debouncedSearch]);

  const handleExport = () => {
    const rows = filtered.map((c) => ({
      Nome: c.name || '',
      Telefone: c.phone || '',
      Fila: c.queue_name || '',
      'Data de cadastro': c.created_at ? format(new Date(c.created_at), 'dd/MM/yyyy HH:mm') : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 32 }, { wch: 18 }, { wch: 24 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isGroup ? 'Grupos' : 'Contatos');
    const fileName = `${isGroup ? 'grupos' : 'contatos'}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Contatos</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie contatos e grupos sincronizados com o chat
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nome ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isLoading || filtered.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'contacts' | 'groups')}>
        <TabsList>
          <TabsTrigger value="contacts">
            Contatos {counts ? `(${counts.contacts.toLocaleString('pt-BR')})` : ''}
          </TabsTrigger>
          <TabsTrigger value="groups">
            Grupos {counts ? `(${counts.groups.toLocaleString('pt-BR')})` : ''}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="contacts" className="mt-4">
          <ContactsTable contacts={filtered} isLoading={isLoading} isGroup={false} />
        </TabsContent>
        <TabsContent value="groups" className="mt-4">
          <ContactsTable contacts={filtered} isLoading={isLoading} isGroup={true} />
        </TabsContent>
      </Tabs>
    </div>
  );
}