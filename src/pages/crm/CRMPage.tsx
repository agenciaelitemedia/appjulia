import { useState, useMemo } from 'react';
import { CRMHeader } from './components/CRMHeader';
import { CRMTotalizers } from './components/CRMTotalizers';
import { CRMPipeline } from './components/CRMPipeline';
import { CRMLeadDetailsDialog } from './components/CRMLeadDetailsDialog';
import { useCRMStages, useCRMCards } from './hooks/useCRMData';
import { CRMCard } from './types';
import { Skeleton } from '@/components/ui/skeleton';

export default function CRMPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCard, setSelectedCard] = useState<CRMCard | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: stages = [], isLoading: stagesLoading } = useCRMStages();
  const { data: cards = [], isLoading: cardsLoading, refetch } = useCRMCards();

  const isLoading = stagesLoading || cardsLoading;

  const filteredCards = useMemo(() => {
    if (!searchTerm) return cards;

    const search = searchTerm.toLowerCase();
    return cards.filter(
      (card) =>
        card.contact_name?.toLowerCase().includes(search) ||
        card.whatsapp?.includes(searchTerm) ||
        card.business_name?.toLowerCase().includes(search)
    );
  }, [cards, searchTerm]);

  const handleCardClick = (card: CRMCard) => {
    setSelectedCard(card);
    setDialogOpen(true);
  };

  const handleRefresh = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-5 w-72" />
          </div>
          <Skeleton className="h-10 w-64" />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>

        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-96 min-w-[280px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CRMHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onRefresh={handleRefresh}
        isLoading={cardsLoading}
      />

      <CRMTotalizers cards={cards} stages={stages} />

      <CRMPipeline
        stages={stages}
        cards={filteredCards}
        onCardClick={handleCardClick}
      />

      <CRMLeadDetailsDialog
        card={selectedCard}
        stages={stages}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
