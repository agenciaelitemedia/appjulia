import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";
import { WhatsappPreview } from "./WhatsappPreview";
import type { WabaTemplateComponent } from "./types";

type HeaderType = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";

interface HeaderSpec {
  type: HeaderType;
  title: string;
  description: string;
  limits: string;
  bodyExample: string;
  headerText?: string;
}

const HEADERS: HeaderSpec[] = [
  {
    type: "NONE",
    title: "Sem cabeçalho",
    description: "O template começa direto pelo corpo da mensagem. Ideal para textos curtos, confirmações e mensagens transacionais.",
    limits: "Nenhum elemento no topo. Apenas BODY (e opcionalmente FOOTER e BUTTONS).",
    bodyExample: "Olá! Sua consulta foi confirmada para amanhã às 14h. Até lá!",
  },
  {
    type: "TEXT",
    title: "Cabeçalho de texto",
    description: "Linha de destaque em negrito acima do corpo. Pode conter uma variável dinâmica como {{1}}.",
    limits: "Até 60 caracteres. Suporta no máximo 1 variável.",
    headerText: "Olá, {{1}}! 👋",
    bodyExample: "Recebemos sua solicitação e em breve um de nossos especialistas entrará em contato.",
  },
  {
    type: "IMAGE",
    title: "Cabeçalho de imagem",
    description: "Imagem fixa exibida no topo da mensagem. Útil para banners, promoções e identidade visual.",
    limits: "Formatos JPG ou PNG. Tamanho máximo de 5 MB. Proporção recomendada 1.91:1.",
    bodyExample: "Aproveite nossa nova promoção para clientes Julia: 20% de desconto na primeira consulta.",
  },
  {
    type: "VIDEO",
    title: "Cabeçalho de vídeo",
    description: "Vídeo curto no topo. Ótimo para boas-vindas, demonstrações ou apresentações.",
    limits: "Formato MP4 (codec H.264 + AAC). Tamanho máximo de 16 MB.",
    bodyExample: "Assista à apresentação da nossa equipe e conheça como podemos te ajudar.",
  },
  {
    type: "DOCUMENT",
    title: "Cabeçalho de documento",
    description: "Anexa um documento PDF no topo. Indicado para contratos, boletos, propostas e comprovantes.",
    limits: "Formato PDF. Tamanho máximo de 100 MB.",
    bodyExample: "Segue em anexo o contrato para sua análise. Qualquer dúvida estamos à disposição.",
  },
  {
    type: "LOCATION",
    title: "Cabeçalho de localização",
    description: "Exibe um ponto no mapa (latitude/longitude) preenchido no momento do envio.",
    limits: "Coordenadas e endereço enviados em runtime, por mensagem. Sem amostra fixa.",
    bodyExample: "Confira o endereço do nosso escritório para sua audiência presencial.",
  },
];

function buildComponents(h: HeaderSpec): WabaTemplateComponent[] {
  const list: WabaTemplateComponent[] = [];
  if (h.type !== "NONE") {
    if (h.type === "TEXT") {
      list.push({ type: "HEADER", format: "TEXT", text: h.headerText || "" });
    } else {
      list.push({ type: "HEADER", format: h.type });
    }
  }
  list.push({ type: "BODY", text: h.bodyExample });
  return list;
}

export function HeaderTypesReferenceDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <HelpCircle className="h-4 w-4" />
          Tipos de cabeçalho
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tipos de cabeçalho (HEADER) em templates WABA</DialogTitle>
          <DialogDescription>
            Referência dos 6 formatos suportados pela Meta para o componente HEADER, com exemplo visual de cada um.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {HEADERS.map((h) => (
            <Card key={h.type} className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono">{h.type}</Badge>
                <h3 className="font-semibold text-sm">{h.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{h.description}</p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Limites:</span> {h.limits}
              </p>
              <div className="pt-1">
                <WhatsappPreview components={buildComponents(h)} />
              </div>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}