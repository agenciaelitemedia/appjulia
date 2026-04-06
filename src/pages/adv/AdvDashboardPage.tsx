import { useAuth } from '@/contexts/AuthContext';
import { Scale, FileText, Bell, Calendar } from 'lucide-react';

export default function AdvDashboardPage() {
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0] || 'Advogado';

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Olá, {firstName}! 👋
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Bem-vindo ao painel do advogado
        </p>
      </div>

      {/* Quick access cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Scale, label: 'Processos', color: 'text-blue-500', bg: 'bg-blue-500/10', soon: true },
          { icon: FileText, label: 'Documentos', color: 'text-emerald-500', bg: 'bg-emerald-500/10', soon: true },
          { icon: Bell, label: 'Notificações', color: 'text-amber-500', bg: 'bg-amber-500/10', soon: true },
          { icon: Calendar, label: 'Agenda', color: 'text-purple-500', bg: 'bg-purple-500/10', soon: true },
        ].map((item) => (
          <div
            key={item.label}
            className="relative rounded-xl border bg-card p-4 flex flex-col items-center gap-2 text-center"
          >
            <div className={`w-10 h-10 rounded-full ${item.bg} flex items-center justify-center`}>
              <item.icon className={`h-5 w-5 ${item.color}`} />
            </div>
            <span className="text-sm font-medium text-foreground">{item.label}</span>
            {item.soon && (
              <span className="absolute top-2 right-2 text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                Em breve
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Info card */}
      <div className="rounded-xl border bg-card p-4">
        <h2 className="font-semibold text-foreground text-sm mb-2">Sobre este painel</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Este é o seu painel exclusivo para acompanhar processos, documentos e notificações
          do seu escritório. Novas funcionalidades serão adicionadas em breve.
        </p>
      </div>
    </div>
  );
}
