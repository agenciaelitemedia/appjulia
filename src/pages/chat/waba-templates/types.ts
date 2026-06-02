export type WabaCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";
export type WabaStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "PAUSED"
  | "DISABLED"
  | "IN_APPEAL";

export type WabaHeaderFormat = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";

export type WabaButton =
  | { type: "QUICK_REPLY"; text: string }
  | { type: "URL"; text: string; url: string; example?: string[] }
  | { type: "PHONE_NUMBER"; text: string; phone_number: string }
  | { type: "COPY_CODE"; text: string; example?: string[] };

export interface WabaTemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";
  text?: string;
  example?: {
    header_text?: string[];
    header_handle?: string[];
    body_text?: string[][];
  };
  buttons?: WabaButton[];
}

export interface WabaTemplateRow {
  id: string;
  client_id: string;
  queue_id: string;
  waba_id: string;
  meta_template_id: string;
  name: string;
  language: string;
  category: WabaCategory;
  sub_category: string | null;
  status: WabaStatus;
  rejection_reason: string | null;
  quality_score: any;
  components: WabaTemplateComponent[];
  last_edited_at: string | null;
  synced_at: string;
  created_at: string;
}

export const WABA_LANGUAGES: { code: string; label: string }[] = [
  { code: "pt_BR", label: "Português (BR)" },
  { code: "pt_PT", label: "Português (PT)" },
  { code: "en_US", label: "English (US)" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "es_ES", label: "Español (ES)" },
  { code: "es_AR", label: "Español (AR)" },
  { code: "es_MX", label: "Español (MX)" },
  { code: "fr", label: "Français" },
  { code: "it", label: "Italiano" },
  { code: "de", label: "Deutsch" },
];