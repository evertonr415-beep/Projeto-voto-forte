import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Colinha Voto Forte",
  description: "Monte sua colinha para o dia da votação.",
  openGraph: {
    title: "Colinha Voto Forte",
    description: "Monte sua colinha para o dia da votação.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Colinha Voto Forte",
    description: "Monte sua colinha para o dia da votação.",
  },
};

export default function ColinhaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
