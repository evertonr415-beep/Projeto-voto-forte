"use client";

import { useEffect } from "react";

const HERO_CLASS = "vf-agenda-mobile-hero";

function normalizedText(element: Element | null) {
  return (element?.textContent || "").replace(/\s+/g, " ").trim();
}

function findSmallestAgendaCard() {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>("section, article, div"),
  ).filter((element) => {
    const text = normalizedText(element);
    return (
      text.includes("Agenda Inteligente") &&
      text.includes("Lista") &&
      text.includes("Calendário") &&
      text.includes("Novo Evento") &&
      text.includes("Opções")
    );
  });

  return candidates
    .filter(
      (candidate) =>
        !candidates.some(
          (other) =>
            other !== candidate &&
            candidate.contains(other) &&
            normalizedText(other).includes("Agenda Inteligente"),
        ),
    )
    .sort((a, b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height)[0] || null;
}

function markAgendaParts(card: HTMLElement) {
  card.classList.add(HERO_CLASS);

  const headings = card.querySelectorAll<HTMLElement>("h1, h2, h3, h4, strong");
  Array.from(headings)
    .find((element) => normalizedText(element).includes("Agenda Inteligente"))
    ?.setAttribute("data-vf-agenda-heading", "true");

  const paragraphs = card.querySelectorAll<HTMLElement>("p, small");
  Array.from(paragraphs)
    .find((element) => normalizedText(element).includes("Cronograma operacional"))
    ?.setAttribute("data-vf-agenda-subtitle", "true");

  const icon = Array.from(card.querySelectorAll<HTMLImageElement>("img")).find((image) => {
    const rect = image.getBoundingClientRect();
    return rect.width <= 140 && rect.height <= 140;
  });
  icon?.setAttribute("data-vf-agenda-icon", "true");

  const tabContainers = Array.from(
    card.querySelectorAll<HTMLElement>("nav, [role='tablist'], div"),
  );
  tabContainers
    .filter((element) => {
      const text = normalizedText(element);
      return text.includes("Lista") && text.includes("Quadro Fases") && text.includes("Calendário");
    })
    .sort((a, b) => a.childElementCount - b.childElementCount)[0]
    ?.setAttribute("data-vf-agenda-tabs", "true");

  const actionContainers = Array.from(card.querySelectorAll<HTMLElement>("div, section"));
  actionContainers
    .filter((element) => {
      const text = normalizedText(element);
      return text.includes("Novo Evento") && text.includes("Opções");
    })
    .sort((a, b) => a.childElementCount - b.childElementCount)[0]
    ?.setAttribute("data-vf-agenda-actions", "true");
}

function clearAgendaMarks() {
  document.querySelectorAll<HTMLElement>(`.${HERO_CLASS}`).forEach((element) =>
    element.classList.remove(HERO_CLASS),
  );
  document
    .querySelectorAll<HTMLElement>(
      "[data-vf-agenda-heading], [data-vf-agenda-subtitle], [data-vf-agenda-icon], [data-vf-agenda-tabs], [data-vf-agenda-actions]",
    )
    .forEach((element) => {
      element.removeAttribute("data-vf-agenda-heading");
      element.removeAttribute("data-vf-agenda-subtitle");
      element.removeAttribute("data-vf-agenda-icon");
      element.removeAttribute("data-vf-agenda-tabs");
      element.removeAttribute("data-vf-agenda-actions");
    });
}

export default function AgendaMobileCompactEnhancer() {
  useEffect(() => {
    let frame = 0;
    let stopped = false;

    const sync = () => {
      frame = 0;
      if (stopped) return;

      const isMobile = window.matchMedia("(max-width: 760px)").matches;
      if (!isMobile) {
        clearAgendaMarks();
        return;
      }

      const card = findSmallestAgendaCard();
      if (!card) return;

      document.querySelectorAll<HTMLElement>(`.${HERO_CLASS}`).forEach((element) => {
        if (element !== card) element.classList.remove(HERO_CLASS);
      });
      markAgendaParts(card);
    };

    const schedule = () => {
      if (stopped || frame) return;
      frame = window.requestAnimationFrame(sync);
    };

    sync();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);

    return () => {
      stopped = true;
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      clearAgendaMarks();
    };
  }, []);

  return null;
}
