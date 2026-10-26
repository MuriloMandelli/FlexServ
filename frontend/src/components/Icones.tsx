import type { ReactNode } from "react";

// Icones em SVG (traco), no estilo do prototipo
function Svg({ children, tamanho = 20 }: { children: ReactNode; tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

type P = { tamanho?: number };

export const Icone = {
  inicio: (p: P) => (
    <Svg {...p}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M10 21v-6h4v6" />
    </Svg>
  ),
  os: (p: P) => (
    <Svg {...p}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </Svg>
  ),
  ferramenta: (p: P) => (
    <Svg {...p}>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />
    </Svg>
  ),
  venda: (p: P) => (
    <Svg {...p}>
      <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" />
      <circle cx="10" cy="20" r="1.3" />
      <circle cx="17" cy="20" r="1.3" />
    </Svg>
  ),
  clientes: (p: P) => (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.4 3.4-5 6.5-5s5.7 1.6 6.5 5" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 15.3c1.9.6 3.1 2.2 3.5 4.7" />
    </Svg>
  ),
  vendedores: (p: P) => (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2" />
      <path d="M6 16c.5-1.5 1.6-2.2 3-2.2s2.5.7 3 2.2M15 10h3M15 13h3" />
    </Svg>
  ),
  itens: (p: P) => (
    <Svg {...p}>
      <path d="M21 8 12 3 3 8l9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </Svg>
  ),
  lojas: (p: P) => (
    <Svg {...p}>
      <path d="M4 10v10h16V10" />
      <path d="M3 10l2-6h14l2 6z" />
      <path d="M10 20v-5h4v5" />
    </Svg>
  ),
  relatorios: (p: P) => (
    <Svg {...p}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Svg>
  ),
  status: (p: P) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </Svg>
  ),
  mais: (p: P) => (
    <Svg {...p}>
      <circle cx="5" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="19" cy="12" r="1.3" />
    </Svg>
  ),
  sair: (p: P) => (
    <Svg {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </Svg>
  ),
  pdf: (p: P) => (
    <Svg {...p}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M12 12v6M9.5 15.5 12 18l2.5-2.5" />
    </Svg>
  ),
  imprimir: (p: P) => (
    <Svg {...p}>
      <path d="M6 9V3h12v6" />
      <rect x="3" y="9" width="18" height="8" rx="2" />
      <path d="M6 14h12v7H6z" />
    </Svg>
  ),
  whatsapp: (p: P) => (
    <Svg {...p}>
      <path d="M3.5 20.5l1.3-4A8.5 8.5 0 1 1 8 19.6z" />
      <path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 1c-1.2-.4-2.5-1.7-2.9-2.9l1-1-1-2z" />
    </Svg>
  ),
  assinatura: (p: P) => (
    <Svg {...p}>
      <path d="M3 17c3-1 4-6 6-6s1 6 3 6 3-3 4-3 1 2 2 2h3" />
      <path d="M3 21h18" />
    </Svg>
  ),
  check: (p: P) => (
    <Svg {...p}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  ),
  campo: (p: P) => (
    <Svg {...p}>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </Svg>
  ),
  ordenar: (p: P) => (
    <Svg {...p}>
      <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
    </Svg>
  ),
  seta: (p: P) => (
    <Svg {...p}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  ),
  voltar: (p: P) => (
    <Svg {...p}>
      <path d="M15 6l-6 6 6 6" />
    </Svg>
  ),
  mais_sinal: (p: P) => (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  ),
  compartilhar: (p: P) => (
    <Svg {...p}>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" />
    </Svg>
  ),
  olho: (p: P) => (
    <Svg {...p}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  ),
  olhoFechado: (p: P) => (
    <Svg {...p}>
      <path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.6 3.4M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
    </Svg>
  ),
  copiar: (p: P) => (
    <Svg {...p}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </Svg>
  ),
  termos: (p: P) => (
    <Svg {...p}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M8 13h8M8 17h5" />
    </Svg>
  ),
};
