import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/painel" });
  },
  head: () => ({
    meta: [
      { title: "Financeiro TOPSeg Solar" },
      { name: "description", content: "Prestação de contas compartilhada entre Eu e Hellios." },
      { property: "og:title", content: "Financeiro TOPSeg Solar" },
      { property: "og:description", content: "Prestação de contas compartilhada entre Eu e Hellios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
