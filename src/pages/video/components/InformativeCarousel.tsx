import { useState, useEffect, useCallback } from 'react';
import { FileText, Lightbulb, Wifi, Heart, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface InformativeItem {
  type: 'text' | 'video';
  content: string;
  icon: keyof typeof iconMap;
}

const iconMap = {
  FileText,
  Lightbulb,
  Wifi,
  Heart,
} as const;

const DEFAULT_INFORMATIVES: InformativeItem[] = [
  {
    type: 'text',
    content: 'Tenha seus documentos em mãos para agilizar o atendimento.',
    icon: 'FileText',
  },
  {
    type: 'text',
    content: 'Fique em um ambiente silencioso e bem iluminado.',
    icon: 'Lightbulb',
  },
  {
    type: 'text',
    content: 'Verifique sua conexão com a internet para uma melhor experiência.',
    icon: 'Wifi',
  },
  {
    type: 'text',
    content: 'Em breve você será atendido. Obrigado pela paciência!',
    icon: 'Heart',
  },
];

interface InformativeCarouselProps {
  items?: InformativeItem[];
  autoRotateInterval?: number;
}

export function InformativeCarousel({ 
  items = DEFAULT_INFORMATIVES, 
  autoRotateInterval = 8000 
}: InformativeCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  }, [items.length]);

  useEffect(() => {
    const timer = setInterval(goToNext, autoRotateInterval);
    return () => clearInterval(timer);
  }, [goToNext, autoRotateInterval]);

  const currentItem = items[currentIndex];
  const IconComponent = iconMap[currentItem.icon];

  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-secondary rounded-lg shrink-0">
            <IconComponent className="h-5 w-5 text-secondary-foreground" />
          </div>
          
          <div className="flex-1 min-h-[60px] flex items-center">
            <p className="text-sm text-foreground leading-relaxed">
              {currentItem.content}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={goToPrev}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={goToNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Pagination dots */}
        <div className="flex justify-center gap-1.5 mt-3">
          {items.map((_, index) => (
            <button
              key={index}
              className={`h-1.5 rounded-full transition-all ${
                index === currentIndex 
                  ? 'w-4 bg-primary' 
                  : 'w-1.5 bg-muted-foreground/30'
              }`}
              onClick={() => setCurrentIndex(index)}
            />
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-2">
          Dica {currentIndex + 1} de {items.length}
        </p>
      </CardContent>
    </Card>
  );
}
