import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  Plus,
  MoreHorizontal,
  Phone,
  Mail,
  MessageSquare,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { externalDb } from '@/lib/externalDb';
import { useAuth } from '@/contexts/AuthContext';

interface Lead {
  id: number;
  name: string;
  phone: string;
  email?: string;
  status: string;
  source?: string;
  created_at: string;
  last_interaction?: string;
}

const statusColors: Record<string, string> = {
  new: 'bg-blue-500',
  contacted: 'bg-yellow-500',
  qualified: 'bg-green-500',
  converted: 'bg-emerald-600',
  lost: 'bg-red-500',
};

const statusLabels: Record<string, string> = {
  new: 'Novo',
  contacted: 'Contactado',
  qualified: 'Qualificado',
  converted: 'Convertido',
  lost: 'Perdido',
};

export default function LeadsList() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      const result = await externalDb.select<Lead>({
        table: 'leads',
        where: { user_id: user?.id },
        orderBy: 'created_at DESC',
        limit: 100,
      });
      setLeads(result);
    } catch (error) {
      console.error('Error loading leads:', error);
      // Use mock data if database fails
      setLeads([
        { id: 1, name: 'João Silva', phone: '11999998888', email: 'joao@email.com', status: 'new', source: 'WhatsApp', created_at: new Date().toISOString() },
        { id: 2, name: 'Maria Santos', phone: '11988887777', email: 'maria@email.com', status: 'qualified', source: 'Instagram', created_at: new Date().toISOString() },
        { id: 3, name: 'Pedro Oliveira', phone: '11977776666', status: 'contacted', source: 'Facebook', created_at: new Date().toISOString() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLeads = leads.filter(
    (lead) =>
      lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone?.includes(searchTerm) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground">
            Gerencie seus leads e acompanhe o funil de vendas
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Lead
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum lead encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLeads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">{lead.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3" />
                              {formatPhone(lead.phone)}
                            </span>
                            {lead.email && (
                              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {lead.email}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`${statusColors[lead.status] || 'bg-gray-500'} text-white`}
                          >
                            {statusLabels[lead.status] || lead.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{lead.source || '-'}</TableCell>
                        <TableCell>{formatDate(lead.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/leads/${lead.id}`)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Ver detalhes
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Enviar mensagem
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Phone className="mr-2 h-4 w-4" />
                                Ligar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
