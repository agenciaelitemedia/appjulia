import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Check, Plus, X, Bold, Italic, Strikethrough, Code as CodeIcon, Loader2, Upload } from "lucide-react";
import { WhatsappPreview } from "./WhatsappPreview";
import { WABA_LANGUAGES, type WabaButton, type WabaTemplateComponent } from "./types";
import { useCreateTemplate, useUploadMediaHandle } from "./useWabaTemplates";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  queueId: string;
}

type Step = 1 | 2 | 3;
type HeaderType = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";

const NAME_REGEX = /^[a-z0-9_]{1,512}$/;
const VAR_REGEX = /\{\{(\d+)\}\}/g;

export function TemplateBuilderDialog({ open, onOpenChange, queueId }: Props) {
  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [category, setCategory] = useState<"MARKETING" | "UTILITY" | "AUTHENTICATION">("MARKETING");

  // Step 2
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("pt_BR");
  const [headerType, setHeaderType] = useState<HeaderType>("NONE");
  const [headerText, setHeaderText] = useState("");
  const [headerHandle, setHeaderHandle] = useState<string | null>(null);
  const [headerMediaPreview, setHeaderMediaPreview] = useState<string | null>(null);
  const [headerMediaType, setHeaderMediaType] = useState<string | null>(null);
  const [bodyText, setBodyText] = useState("");
  const [bodyExamples, setBodyExamples] = useState<string[]>([]);
  const [footerText, setFooterText] = useState("");
  const [buttons, setButtons] = useState<WabaButton[]>([]);

  const create = useCreateTemplate();
  const upload = useUploadMediaHandle();

  const reset = () => {
    setStep(1);
    setCategory("MARKETING");
    setName("");
    setLanguage("pt_BR");
    setHeaderType("NONE");
    setHeaderText("");
    setHeaderHandle(null);
    setHeaderMediaPreview(null);
    setHeaderMediaType(null);
    setBodyText("");
    setBodyExamples([]);
    setFooterText("");
    setButtons([]);
  };

  const bodyVarCount = useMemo(() => {
    const nums = new Set<number>();
    let m: RegExpExecArray | null;
    const re = /\{\{(\d+)\}\}/g;
    while ((m = re.exec(bodyText))) nums.add(Number(m[1]));
    return nums.size;
  }, [bodyText]);

  // Sync example array length with var count
  useMemo(() => {
    if (bodyExamples.length !== bodyVarCount) {
      setBodyExamples((prev) => {
        const next = [...prev];
        while (next.length < bodyVarCount) next.push("");
        return next.slice(0, bodyVarCount);
      });
    }
  }, [bodyVarCount]); // eslint-disable-line

  const components = useMemo<WabaTemplateComponent[]>(() => {
    const list: WabaTemplateComponent[] = [];
    if (headerType !== "NONE") {
      if (headerType === "TEXT") {
        list.push({ type: "HEADER", format: "TEXT", text: headerText || " " });
      } else if (headerType === "LOCATION") {
        list.push({ type: "HEADER", format: "LOCATION" });
      } else {
        const c: WabaTemplateComponent = { type: "HEADER", format: headerType };
        if (headerHandle) c.example = { header_handle: [headerHandle] };
        list.push(c);
      }
    }
    const body: WabaTemplateComponent = { type: "BODY", text: bodyText || " " };
    if (bodyVarCount > 0 && bodyExamples.length > 0) {
      body.example = { body_text: [bodyExamples] };
    }
    list.push(body);
    if (footerText) list.push({ type: "FOOTER", text: footerText });
    if (buttons.length > 0) list.push({ type: "BUTTONS", buttons });
    return list;
  }, [headerType, headerText, headerHandle, bodyText, bodyExamples, bodyVarCount, footerText, buttons]);

  const validateStep2 = (): string | null => {
    if (!NAME_REGEX.test(name))
      return "Nome inválido: use apenas letras minúsculas, números e _ (1-512 caracteres).";
    if (!language) return "Selecione um idioma.";
    if (headerType === "TEXT" && headerText.length > 60) return "Cabeçalho excede 60 caracteres.";
    if (headerType !== "NONE" && headerType !== "TEXT" && headerType !== "LOCATION" && !headerHandle)
      return "Envie a amostra de mídia do cabeçalho.";
    if (!bodyText.trim()) return "Corpo da mensagem é obrigatório.";
    if (bodyText.length > 1024) return "Corpo excede 1024 caracteres.";
    // Validar variáveis sequenciais começando em 1
    const matches = [...bodyText.matchAll(VAR_REGEX)].map((m) => Number(m[1])).sort();
    const unique = [...new Set(matches)];
    for (let i = 0; i < unique.length; i++)
      if (unique[i] !== i + 1)
        return "Variáveis devem ser sequenciais começando em {{1}}.";
    if (bodyVarCount > 0 && bodyExamples.some((e) => !e.trim()))
      return "Preencha um exemplo para cada variável.";
    if (footerText.length > 60) return "Rodapé excede 60 caracteres.";
    if (buttons.length > 10) return "Máximo de 10 botões.";
    if (buttons.filter((b) => b.type === "PHONE_NUMBER").length > 1)
      return "Apenas 1 botão de telefone permitido.";
    if (buttons.filter((b) => b.type === "URL").length > 2)
      return "Máximo de 2 botões de URL.";
    if (buttons.filter((b) => b.type === "COPY_CODE").length > 1)
      return "Apenas 1 botão de copiar código permitido.";
    for (const b of buttons) {
      if (!b.text.trim()) return "Todos os botões precisam de texto.";
      if (b.text.length > 25) return "Texto de botão excede 25 caracteres.";
      if (b.type === "URL" && !b.url.trim()) return "URL do botão é obrigatória.";
      if (b.type === "PHONE_NUMBER" && !b.phone_number.trim()) return "Telefone do botão é obrigatório.";
    }
    return null;
  };

  const onAddButton = (t: WabaButton["type"]) => {
    if (buttons.length >= 10) return;
    if (t === "QUICK_REPLY") setButtons([...buttons, { type: "QUICK_REPLY", text: "" }]);
    else if (t === "URL") setButtons([...buttons, { type: "URL", text: "", url: "" }]);
    else if (t === "PHONE_NUMBER")
      setButtons([...buttons, { type: "PHONE_NUMBER", text: "", phone_number: "" }]);
    else if (t === "COPY_CODE") setButtons([...buttons, { type: "COPY_CODE", text: "Copiar código" }]);
  };

  const insertFormat = (chars: [string, string]) => {
    setBodyText((t) => t + `${chars[0]}texto${chars[1]}`);
  };

  const insertVariable = () => {
    setBodyText((t) => t + `{{${bodyVarCount + 1}}}`);
  };

  const onUpload = async (file: File) => {
    try {
      const url = URL.createObjectURL(file);
      setHeaderMediaPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setHeaderMediaType(file.type);
      const h = await upload.mutateAsync({ queue_id: queueId, file });
      setHeaderHandle(h);
      toast.success("Amostra enviada");
    } catch (e: any) {
      toast.error(e.message || "Erro no upload");
    }
  };

  useEffect(() => {
    return () => {
      if (headerMediaPreview) URL.revokeObjectURL(headerMediaPreview);
    };
  }, [headerMediaPreview]);

  const onSubmit = async () => {
    const err = validateStep2();
    if (err) {
      toast.error(err);
      setStep(2);
      return;
    }
    try {
      await create.mutateAsync({
        queue_id: queueId,
        name,
        language,
        category,
        components,
      });
      onOpenChange(false);
      reset();
    } catch {
      /* toast já no hook */
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar modelo</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-4 text-sm">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  step === n
                    ? "bg-primary text-primary-foreground"
                    : step > n
                    ? "bg-green-600 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step > n ? <Check className="h-3 w-3" /> : n}
              </div>
              <span className={step === n ? "font-medium" : "text-muted-foreground"}>
                {n === 1 ? "Configurar" : n === 2 ? "Editar" : "Enviar para análise"}
              </span>
              {n < 3 && <div className="w-8 h-px bg-border" />}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-4">
            {step === 1 && (
              <div className="space-y-4">
                <h3 className="font-semibold">Configure seu modelo</h3>
                <p className="text-sm text-muted-foreground">
                  Escolha a categoria que melhor descreve seu modelo de mensagem.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(["MARKETING", "UTILITY", "AUTHENTICATION"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={`p-3 rounded-lg border text-sm ${
                        category === c
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      {c === "MARKETING" ? "📣 Marketing" : c === "UTILITY" ? "🔔 Utilidade" : "🔐 Autenticação"}
                    </button>
                  ))}
                </div>
                <div className="rounded-lg border p-3 bg-muted/30">
                  <div className="text-sm font-medium">
                    {category === "MARKETING" && "Padrão · Mensagens com mídia e botões para engajar clientes."}
                    {category === "UTILITY" && "Mensagens transacionais como confirmações, atualizações e lembretes."}
                    {category === "AUTHENTICATION" && "Códigos de verificação (OTP) e autenticação de dois fatores."}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nome do modelo</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                      placeholder="meu_template"
                      maxLength={512}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Apenas minúsculas, números e _
                    </p>
                  </div>
                  <div>
                    <Label>Idioma</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WABA_LANGUAGES.map((l) => (
                          <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Cabeçalho · Opcional</Label>
                  <Select value={headerType} onValueChange={(v) => setHeaderType(v as HeaderType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Nenhum</SelectItem>
                      <SelectItem value="TEXT">Texto</SelectItem>
                      <SelectItem value="IMAGE">Imagem</SelectItem>
                      <SelectItem value="VIDEO">Vídeo</SelectItem>
                      <SelectItem value="DOCUMENT">Documento</SelectItem>
                      <SelectItem value="LOCATION">Localização</SelectItem>
                    </SelectContent>
                  </Select>
                  {headerType === "TEXT" && (
                    <Input
                      className="mt-2"
                      value={headerText}
                      onChange={(e) => setHeaderText(e.target.value)}
                      maxLength={60}
                      placeholder="Cabeçalho da sua mensagem"
                    />
                  )}
                  {(headerType === "IMAGE" || headerType === "VIDEO" || headerType === "DOCUMENT") && (
                    <div className="mt-2 flex items-center gap-2">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          className="hidden"
                          accept={
                            headerType === "IMAGE" ? "image/*"
                              : headerType === "VIDEO" ? "video/*"
                              : "application/pdf"
                          }
                          onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
                        />
                        <Button type="button" variant="outline" size="sm" asChild>
                          <span>
                            {upload.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                            Enviar amostra
                          </span>
                        </Button>
                      </label>
                      {headerHandle && <Badge variant="secondary">Amostra enviada</Badge>}
                    </div>
                  )}
                </div>

                <div>
                  <Label>Corpo</Label>
                  <Textarea
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    maxLength={1024}
                    rows={6}
                    placeholder="Digite a mensagem do template..."
                  />
                  <div className="flex items-center gap-1 mt-1">
                    <Button type="button" size="sm" variant="ghost" onClick={() => insertFormat(["*", "*"])}><Bold className="h-3.5 w-3.5" /></Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => insertFormat(["_", "_"])}><Italic className="h-3.5 w-3.5" /></Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => insertFormat(["~", "~"])}><Strikethrough className="h-3.5 w-3.5" /></Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => insertFormat(["```", "```"])}><CodeIcon className="h-3.5 w-3.5" /></Button>
                    <Button type="button" size="sm" variant="ghost" onClick={insertVariable}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Variável
                    </Button>
                    <span className="ml-auto text-xs text-muted-foreground">{bodyText.length}/1024</span>
                  </div>
                  {bodyVarCount > 0 && (
                    <div className="mt-2 space-y-1">
                      <Label className="text-xs">Exemplos das variáveis</Label>
                      {bodyExamples.map((ex, i) => (
                        <Input
                          key={i}
                          value={ex}
                          onChange={(e) => {
                            const next = [...bodyExamples];
                            next[i] = e.target.value;
                            setBodyExamples(next);
                          }}
                          placeholder={`Exemplo para {{${i + 1}}}`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label>Rodapé · Opcional</Label>
                  <Input
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    maxLength={60}
                    placeholder="Texto curto no rodapé"
                  />
                </div>

                <div>
                  <Label>Botões · Opcional ({buttons.length}/10)</Label>
                  <div className="flex gap-1 flex-wrap mt-1">
                    <Button type="button" size="sm" variant="outline" onClick={() => onAddButton("QUICK_REPLY")}><Plus className="h-3 w-3 mr-1" />Resposta rápida</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => onAddButton("URL")}><Plus className="h-3 w-3 mr-1" />URL</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => onAddButton("PHONE_NUMBER")}><Plus className="h-3 w-3 mr-1" />Telefone</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => onAddButton("COPY_CODE")}><Plus className="h-3 w-3 mr-1" />Copiar código</Button>
                  </div>
                  <div className="space-y-2 mt-2">
                    {buttons.map((b, i) => (
                      <div key={i} className="border rounded-md p-2 space-y-2 bg-muted/30">
                        <div className="flex items-center justify-between">
                          <Badge>{b.type}</Badge>
                          <Button type="button" size="icon" variant="ghost" onClick={() => setButtons(buttons.filter((_, j) => j !== i))}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <Input
                          placeholder="Texto do botão"
                          value={b.text}
                          maxLength={25}
                          onChange={(e) => {
                            const next = [...buttons];
                            next[i] = { ...b, text: e.target.value };
                            setButtons(next);
                          }}
                        />
                        {b.type === "URL" && (
                          <Input
                            placeholder="https://exemplo.com"
                            value={b.url}
                            onChange={(e) => {
                              const next = [...buttons];
                              next[i] = { ...b, url: e.target.value } as WabaButton;
                              setButtons(next);
                            }}
                          />
                        )}
                        {b.type === "PHONE_NUMBER" && (
                          <Input
                            placeholder="+5511999999999"
                            value={b.phone_number}
                            onChange={(e) => {
                              const next = [...buttons];
                              next[i] = { ...b, phone_number: e.target.value } as WabaButton;
                              setButtons(next);
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <h3 className="font-semibold">Pronto para enviar</h3>
                <p className="text-sm text-muted-foreground">
                  Ao enviar, a Meta vai analisar o template. A aprovação pode levar de alguns minutos a algumas horas.
                </p>
                <div className="rounded-md border p-3 text-sm space-y-1">
                  <div><b>Nome:</b> {name}</div>
                  <div><b>Idioma:</b> {language}</div>
                  <div><b>Categoria:</b> {category}</div>
                  <div><b>Componentes:</b> {components.length}</div>
                </div>
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label className="text-xs uppercase">Prévia do modelo</Label>
            <WhatsappPreview
              components={components}
              headerMediaPreview={headerMediaPreview}
              headerMediaType={headerMediaType}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t mt-4">
          <Button
            variant="ghost"
            onClick={() => (step > 1 ? setStep((step - 1) as Step) : onOpenChange(false))}
          >
            {step > 1 ? "Voltar" : "Cancelar"}
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => {
                if (step === 2) {
                  const err = validateStep2();
                  if (err) { toast.error(err); return; }
                }
                setStep((step + 1) as Step);
              }}
            >
              Avançar
            </Button>
          ) : (
            <Button onClick={onSubmit} disabled={create.isPending}>
              {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enviar para análise
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}