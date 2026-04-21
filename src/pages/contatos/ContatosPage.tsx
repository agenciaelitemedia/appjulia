import { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Search, Users } from 'lucide-react';
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
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
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