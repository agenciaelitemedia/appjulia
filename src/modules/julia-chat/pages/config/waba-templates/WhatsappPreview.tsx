import { Image as ImageIcon, Video, FileText, MapPin, ChevronRight, Phone, Link2, Copy } from "lucide-react";
import type { WabaTemplateComponent } from "./types";

interface Props {
  components: WabaTemplateComponent[];
  headerMediaPreview?: string | null;
  headerMediaType?: string | null;
}

function renderWaText(text: string) {
  // *bold* _italic_ ~strike~ ```mono```
  return text
    .replace(/```([\s\S]+?)```/g, '<code class="bg-muted px-1 rounded">$1</code>')
    .replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>")
    .replace(/_([^_\n]+)_/g, "<em>$1</em>")
    .replace(/~([^~\n]+)~/g, "<s>$1</s>")
    .replace(/\n/g, "<br/>");
}

export function WhatsappPreview({ components, headerMediaPreview, headerMediaType }: Props) {
  const header = components.find((c) => c.type === "HEADER");
  const body = components.find((c) => c.type === "BODY");
  const footer = components.find((c) => c.type === "FOOTER");
  const buttons = components.find((c) => c.type === "BUTTONS")?.buttons || [];

  return (
    <div className="rounded-lg border bg-[#e5ddd5] p-3 min-h-[400px]">
      <div className="bg-white rounded-lg shadow-sm max-w-sm overflow-hidden">
        {header && header.format && header.format !== "TEXT" && (
          <div className="bg-muted aspect-video flex items-center justify-center text-muted-foreground overflow-hidden">
            {header.format === "IMAGE" && headerMediaPreview ? (
              <img src={headerMediaPreview} alt="Prévia" className="w-full h-full object-cover" />
            ) : header.format === "VIDEO" && headerMediaPreview ? (
              <video src={headerMediaPreview} className="w-full h-full object-cover" controls />
            ) : header.format === "DOCUMENT" && headerMediaPreview ? (
              <iframe src={headerMediaPreview} className="w-full h-full" title="Prévia do documento" />
            ) : (
              <>
                {header.format === "IMAGE" && <ImageIcon className="h-10 w-10" />}
                {header.format === "VIDEO" && <Video className="h-10 w-10" />}
                {header.format === "DOCUMENT" && <FileText className="h-10 w-10" />}
                {header.format === "LOCATION" && <MapPin className="h-10 w-10" />}
              </>
            )}
          </div>
        )}
        <div className="p-3 space-y-2">
          {header?.format === "TEXT" && header.text && (
            <div
              className="font-bold text-sm"
              dangerouslySetInnerHTML={{ __html: renderWaText(header.text) }}
            />
          )}
          {body?.text && (
            <div
              className="text-sm whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: renderWaText(body.text) }}
            />
          )}
          {footer?.text && (
            <div className="text-xs text-muted-foreground">{footer.text}</div>
          )}
        </div>
        {buttons.length > 0 && (
          <div className="border-t divide-y">
            {buttons.slice(0, 3).map((b, i) => (
              <div
                key={i}
                className="px-3 py-2 text-center text-sm text-[#00a5f4] flex items-center justify-center gap-2"
              >
                {b.type === "PHONE_NUMBER" && <Phone className="h-3.5 w-3.5" />}
                {b.type === "URL" && <Link2 className="h-3.5 w-3.5" />}
                {b.type === "COPY_CODE" && <Copy className="h-3.5 w-3.5" />}
                {b.text}
              </div>
            ))}
            {buttons.length > 3 && (
              <div className="px-3 py-2 text-center text-sm text-[#00a5f4] flex items-center justify-center gap-1">
                <ChevronRight className="h-3.5 w-3.5" />
                Ver todas as opções
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}