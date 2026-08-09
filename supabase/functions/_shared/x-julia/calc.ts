// ============================================
// X-Julia — motor de cálculos (nunca deixe o modelo calcular de cabeça)
// Todo cálculo citado ao lead deve passar por aqui.
// ============================================

/** Salário mínimo nacional usado como referência quando não informado. */
export const XJ_SALARIO_MINIMO_PADRAO = 1518;

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(value: number): string {
  return BRL.format(round2(value));
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Converte "1.234,56", "R$ 1.234,56", "1234.56" ou número em number. */
export function parseNumber(input: unknown): number {
  if (typeof input === "number") return Number.isFinite(input) ? input : NaN;
  let s = String(input ?? "").trim();
  if (!s) return NaN;
  s = s.replace(/r\$/i, "").replace(/\s/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) s = s.replace(/\./g, "").replace(",", ".");
  else if (hasComma) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

// ---------- Avaliador aritmético seguro (sem eval) ----------
type Token = { t: "num"; v: number } | { t: "op"; v: string } | { t: "par"; v: "(" | ")" };

function tokenize(raw: string): Token[] {
  const s = raw
    .replace(/r\$/gi, "")
    .replace(/[×x]/gi, "*")
    .replace(/÷/g, "/")
    .replace(/\s+/g, "");
  const tokens: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.,]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.,]/.test(s[j])) j++;
      const n = parseNumber(s.slice(i, j));
      if (!Number.isFinite(n)) throw new Error(`número inválido em "${s.slice(i, j)}"`);
      tokens.push({ t: "num", v: n });
      i = j;
      continue;
    }
    if ("+-*/^%".includes(c)) {
      tokens.push({ t: "op", v: c });
      i++;
      continue;
    }
    if (c === "(" || c === ")") {
      tokens.push({ t: "par", v: c });
      i++;
      continue;
    }
    throw new Error(`caractere não suportado: "${c}"`);
  }
  return tokens;
}

/** Avalia expressão aritmética simples: + - * / ^ % e parênteses. */
export function evaluateExpression(raw: string): number {
  const tokens = tokenize(raw);
  let pos = 0;

  const peek = () => tokens[pos];

  function parsePrimary(): number {
    const tk = peek();
    if (!tk) throw new Error("expressão incompleta");
    if (tk.t === "op" && (tk.v === "-" || tk.v === "+")) {
      pos++;
      const v = parsePrimary();
      return tk.v === "-" ? -v : v;
    }
    if (tk.t === "par" && tk.v === "(") {
      pos++;
      const v = parseSum();
      const close = peek();
      if (!close || close.t !== "par" || close.v !== ")") throw new Error("parêntese não fechado");
      pos++;
      return v;
    }
    if (tk.t === "num") {
      pos++;
      // sufixo de porcentagem: 10% => 0.1
      const next = peek();
      if (next && next.t === "op" && next.v === "%") {
        const after = tokens[pos + 1];
        const isModulo = after && (after.t === "num" || (after.t === "par" && after.v === "("));
        if (!isModulo) {
          pos++;
          return tk.v / 100;
        }
      }
      return tk.v;
    }
    throw new Error("expressão inválida");
  }

  function parsePower(): number {
    let base = parsePrimary();
    const tk = peek();
    if (tk && tk.t === "op" && tk.v === "^") {
      pos++;
      base = Math.pow(base, parsePower());
    }
    return base;
  }

  function parseProduct(): number {
    let acc = parsePower();
    for (;;) {
      const tk = peek();
      if (!tk || tk.t !== "op" || !["*", "/", "%"].includes(tk.v)) return acc;
      pos++;
      const rhs = parsePower();
      if (tk.v === "*") acc *= rhs;
      else if (tk.v === "/") {
        if (rhs === 0) throw new Error("divisão por zero");
        acc /= rhs;
      } else acc %= rhs;
    }
  }

  function parseSum(): number {
    let acc = parseProduct();
    for (;;) {
      const tk = peek();
      if (!tk || tk.t !== "op" || (tk.v !== "+" && tk.v !== "-")) return acc;
      pos++;
      const rhs = parseProduct();
      acc = tk.v === "+" ? acc + rhs : acc - rhs;
    }
  }

  const result = parseSum();
  if (pos !== tokens.length) throw new Error("expressão inválida (sobrou conteúdo)");
  if (!Number.isFinite(result)) throw new Error("resultado inválido");
  return result;
}

// ---------- Cálculos de negócio ----------
export interface PerCapitaResult {
  rendas: number[];
  total: number;
  pessoas: number;
  perCapita: number;
  salarioMinimo: number;
  limiteUmQuarto: number;
  limiteMeio: number;
  dentroUmQuarto: boolean;
  dentroMeio: boolean;
}

export function rendaPerCapita(
  rendas: unknown[],
  pessoas: unknown,
  salarioMinimo?: unknown,
): PerCapitaResult {
  const valores = (rendas ?? []).map(parseNumber).filter((n) => Number.isFinite(n));
  const qtd = Math.max(1, Math.round(parseNumber(pessoas) || 0));
  const sm = Number.isFinite(parseNumber(salarioMinimo)) && parseNumber(salarioMinimo) > 0
    ? parseNumber(salarioMinimo)
    : XJ_SALARIO_MINIMO_PADRAO;
  const total = valores.reduce((a, b) => a + b, 0);
  const perCapita = total / qtd;
  return {
    rendas: valores.map(round2),
    total: round2(total),
    pessoas: qtd,
    perCapita: round2(perCapita),
    salarioMinimo: round2(sm),
    limiteUmQuarto: round2(sm / 4),
    limiteMeio: round2(sm / 2),
    dentroUmQuarto: perCapita < sm / 4,
    dentroMeio: perCapita < sm / 2,
  };
}

export function parcelamento(valor: unknown, parcelas: unknown, jurosMensal?: unknown) {
  const v = parseNumber(valor);
  const n = Math.max(1, Math.round(parseNumber(parcelas) || 1));
  const i = Number.isFinite(parseNumber(jurosMensal)) ? parseNumber(jurosMensal) / 100 : 0;
  const parcela = i > 0 ? (v * i) / (1 - Math.pow(1 + i, -n)) : v / n;
  return { valor: round2(v), parcelas: n, jurosMensal: round2(i * 100), parcela: round2(parcela), total: round2(parcela * n) };
}

export function percentual(valor: unknown, taxa: unknown) {
  const v = parseNumber(valor);
  const p = parseNumber(taxa);
  const parte = (v * p) / 100;
  return { valor: round2(v), percentual: round2(p), parte: round2(parte), restante: round2(v - parte) };
}
