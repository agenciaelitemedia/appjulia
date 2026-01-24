import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { JuliaContrato } from '../../types';

interface ContratosSummaryProps {
  contratos: JuliaContrato[];
  isLoading?: boolean;
}

export function ContratosSummary({ contratos, isLoading }: ContratosSummaryProps) {
  const summary = useMemo(() => {
    if (!contratos.length) {
      return {
        totalContratos: 0,
        contratosAssinados: 0,
        contratosEmCurso: 0,
        taxaAssinatura: 0,
      };
    }

    const assinados = contratos.filter((c) => c.status_document === 'SIGNED').length;
    const emCurso = contratos.filter((c) => c.situacao === 'EM CURSO').length;

    return {
      totalContratos: contratos.length,
      contratosAssinados: assinados,
      contratosEmCurso: emCurso,
      taxaAssinatura: contratos.length > 0 ? Math.round((assinados / contratos.length) * 100) : 0,
    };
  }, [contratos]);

  const cards = [
    {
      title: 'Total Contratos',
      value: summary.totalContratos.toLocaleString('pt-BR'),
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Assinados',
      value: summary.contratosAssinados.toLocaleString('pt-BR'),
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Em Curso',
      value: summary.contratosEmCurso.toLocaleString('pt-BR'),
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
    {
      title: 'Taxa Assinatura',
      value: `${summary.taxaAssinatura}%`,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{isLoading ? '-' : card.value}</p>
                <p className="text-xs text-muted-foreground">{card.title}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
