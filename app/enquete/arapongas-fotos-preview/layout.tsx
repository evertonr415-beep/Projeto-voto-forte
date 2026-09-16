"use client";

import { useEffect } from "react";

const PHOTO_FIXES = [
  {
    label: "Lula",
    url: "https://live.staticflickr.com/65535/55450244258_b5195947f7.jpg",
  },
  {
    label: "Sandro Alex",
    url: "https://upload.wikimedia.org/wikipedia/commons/9/95/Sandro_Alex_em_fevereiro_de_2015.jpg",
  },
] as const;

const SENATOR_CANDIDATES = [
  {
    id: "alexandre_curi",
    name: "Alexandre Curi",
    party: "REPUBLICANOS",
    photo: "https://storage2.assembleia.pr.leg.br/img/y3n1sE1n35-E4-L_2B8B_P5U3qQ=/full-fit-in/300x300/deputados/alexandre-curi.png",
  },
  {
    id: "cristina_graeml",
    name: "Cristina Graeml",
    party: "PSD",
    photo: "https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/buscar/foto/2/160002005080/2024/75353",
  },
  {
    id: "deltan_dallagnol",
    name: "Deltan Dallagnol",
    party: "NOVO",
    photo: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/220705.jpg",
  },
  {
    id: "filipe_barros",
    name: "Filipe Barros",
    party: "PL",
    photo: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/204411.jpg",
  },
  {
    id: "gleisi",
    name: "Gleisi",
    party: "PT",
    photo: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/74416.jpg",
  },
  {
    id: "dr_rosinha",
    name: "Dr Rosinha",
    party: "PT",
    photo: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/73459.jpg",
  },
] as const;

const SENATOR_SPECIAL_OPTIONS = [
  { id: "outro", name: "Outro", initials: "+" },
  { id: "branco_nulo", name: "Branco/Nulo", initials: "—" },
  { id: "ainda_nao_sei", name: "Ainda não sei", initials: "?" },
] as const;

function candidateProxy(url: string) {
  return `/api/enquete/candidate-photo?url=${encodeURIComponent(url)}`;
}

function applyPhotoFixes() {
  for (const { label, url } of PHOTO_FIXES) {
    document.querySelectorAll<HTMLImageElement>(`img[alt="${label}"]`).forEach((img) => {
      if (img.dataset.photoFix === "1") return;
      img.dataset.photoFix = "1";
      img.src = url;
    });
  }

  // Fallback somente para o card imediato do candidato correto.
  // Não percorre mais ancestrais da página, evitando aplicar a foto em
  // opções genéricas como Outro, Branco/Nulo e Ainda não sei.
  document.querySelectorAll<HTMLElement>('div[aria-hidden="true"]').forEach((avatar) => {
    if (avatar.dataset.photoFix === "1") return;

    const card = avatar.parentElement;
    if (!card) return;

    const text = (card.textContent || "").replace(/\s+/g, " ").trim();
    const match = PHOTO_FIXES.find(({ label }) =>
      text === label ||
      text.startsWith(`${label} `) ||
      text.includes(`${label} (`) ||
      text.includes(`${label} PT`) ||
      text.includes(`${label} PSD`),
    );

    if (!match) return;

    avatar.dataset.photoFix = "1";
    avatar.textContent = "";
    avatar.style.backgroundImage = `url("${match.url}")`;
    avatar.style.backgroundSize = "cover";
    avatar.style.backgroundPosition = "center";
    avatar.style.backgroundRepeat = "no-repeat";
    avatar.style.color = "transparent";
  });
}

function senatorOptionMarkup(option: {
  id: string;
  name: string;
  party?: string;
  photo?: string;
  initials?: string;
}) {
  const avatar = option.photo
    ? `<img src="${candidateProxy(option.photo)}" alt="${option.name}" loading="lazy" style="width:52px;height:52px;min-width:52px;border-radius:50%;object-fit:cover;object-position:center;border:2px solid #fff;box-shadow:0 0 0 1px #cbd5e1,0 3px 10px rgba(15,23,42,.12);background:#e2e8f0" />`
    : `<div aria-hidden="true" style="width:52px;height:52px;min-width:52px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#eff6ff,#dbeafe);border:2px solid #fff;box-shadow:0 0 0 1px #bfdbfe;color:#1d4ed8;font-size:16px;font-weight:900">${option.initials || ""}</div>`;

  const party = option.party
    ? `<span style="display:inline-block;margin-top:4px;border-radius:999px;background:#f1f5f9;color:#64748b;padding:3px 7px;font-size:10px;line-height:1;font-weight:850">${option.party}</span>`
    : "";

  return `<label data-senator-option="${option.id}" style="position:relative;display:flex;align-items:center;gap:12px;min-height:68px;padding:9px 48px 9px 12px;border-radius:15px;border:1px solid #dde4ee;background:#fff;box-shadow:0 1px 2px rgba(15,23,42,.03);cursor:pointer;transition:border-color .15s ease,background .15s ease,box-shadow .15s ease">
    <input type="radio" name="q10" value="${option.id}" required style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none" />
    ${avatar}
    <div style="min-width:0;flex:1">
      <div data-senator-name style="color:#334155;font-size:14.5px;line-height:1.35;font-weight:700">${option.name}</div>
      ${party}
    </div>
    <span data-senator-check aria-hidden="true" style="position:absolute;right:13px;top:50%;transform:translateY(-50%);width:25px;height:25px;border-radius:50%;display:grid;place-items:center;border:1.5px solid #cbd5e1;background:#fff;color:#fff;font-size:14px;font-weight:900"></span>
  </label>`;
}

function syncSenatorSelection(section: HTMLElement) {
  section.querySelectorAll<HTMLLabelElement>("label[data-senator-option]").forEach((label) => {
    const input = label.querySelector<HTMLInputElement>('input[name="q10"]');
    const check = label.querySelector<HTMLElement>("[data-senator-check]");
    const name = label.querySelector<HTMLElement>("[data-senator-name]");
    if (!input || !check || !name) return;

    if (input.checked) {
      label.style.border = "2px solid #2563eb";
      label.style.background = "linear-gradient(135deg,#f5f9ff,#eef5ff)";
      label.style.boxShadow = "0 5px 16px rgba(37,99,235,.11)";
      name.style.color = "#153b80";
      name.style.fontWeight = "900";
      check.style.border = "2px solid #2563eb";
      check.style.background = "#2563eb";
      check.style.boxShadow = "0 3px 8px rgba(37,99,235,.2)";
      check.textContent = "✓";
    } else {
      label.style.border = "1px solid #dde4ee";
      label.style.background = "#fff";
      label.style.boxShadow = "0 1px 2px rgba(15,23,42,.03)";
      name.style.color = "#334155";
      name.style.fontWeight = "700";
      check.style.border = "1.5px solid #cbd5e1";
      check.style.background = "#fff";
      check.style.boxShadow = "none";
      check.textContent = "";
    }
  });
}

function applySenatorQuestion() {
  const form = document.querySelector<HTMLFormElement>("form");
  if (!form || form.querySelector('[data-senator-question="1"]')) return;

  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!submit) return;

  const section = document.createElement("section");
  section.dataset.senatorQuestion = "1";
  section.style.padding = "20px 0 4px";
  section.style.borderTop = "1px solid #eef2f7";
  section.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px">
      <span style="background:#e8f0ff;color:#1d4ed8;border-radius:999px;padding:5px 9px;font-size:10px;font-weight:900;letter-spacing:.06em">PERGUNTA 10</span>
    </div>
    <div style="color:#172033;font-weight:900;font-size:15px;margin-bottom:13px;line-height:1.48">EM QUEM VOCÊ VOTARIA PARA SENADOR PELO PARANÁ?</div>
    <div data-senator-options style="display:flex;flex-direction:column;gap:10px">
      ${SENATOR_CANDIDATES.map((candidate) => senatorOptionMarkup(candidate)).join("")}
      ${SENATOR_SPECIAL_OPTIONS.map((candidate) => senatorOptionMarkup(candidate)).join("")}
    </div>
  `;

  section.addEventListener("change", () => syncSenatorSelection(section));
  form.insertBefore(section, submit);
  syncSenatorSelection(section);
}

function applyRankingLayoutFixes() {
  document.querySelectorAll<HTMLElement>("strong").forEach((percentage) => {
    if (!/^\d+(?:[.,]\d+)?%$/.test((percentage.textContent || "").trim())) return;

    const header = percentage.parentElement as HTMLElement | null;
    const content = header?.parentElement as HTMLElement | null;
    const row = content?.parentElement as HTMLElement | null;
    const identity = header?.firstElementChild as HTMLElement | null;

    if (!header || !content || !row || !identity || row.children.length < 2) return;

    row.dataset.rankingLayoutFix = "1";
    row.style.display = "grid";
    row.style.gridTemplateColumns = row.children.length >= 3
      ? "48px minmax(0, 1fr) 24px"
      : "48px minmax(0, 1fr)";
    row.style.alignItems = "center";
    row.style.columnGap = "11px";
    row.style.width = "100%";
    row.style.boxSizing = "border-box";
    row.style.overflow = "hidden";

    content.style.minWidth = "0";
    content.style.width = "100%";
    content.style.overflow = "hidden";

    header.style.display = "grid";
    header.style.gridTemplateColumns = "minmax(0, 1fr) minmax(50px, auto)";
    header.style.alignItems = "start";
    header.style.columnGap = "8px";
    header.style.width = "100%";
    header.style.minWidth = "0";

    identity.style.display = "grid";
    identity.style.gridTemplateColumns = "minmax(0, 1fr)";
    identity.style.alignItems = "start";
    identity.style.minWidth = "0";
    identity.style.overflow = "hidden";

    const identityParts = Array.from(identity.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    );
    const candidateName = identityParts[0];
    const party = identityParts[1];

    if (candidateName) {
      candidateName.style.display = "block";
      candidateName.style.minWidth = "0";
      candidateName.style.maxWidth = "100%";
      candidateName.style.overflow = "hidden";
      candidateName.style.textOverflow = "ellipsis";
      candidateName.style.whiteSpace = "nowrap";
    }

    if (party) {
      party.style.justifySelf = "start";
      party.style.marginLeft = "0";
      party.style.marginTop = "3px";
      party.style.maxWidth = "100%";
      party.style.overflow = "hidden";
      party.style.textOverflow = "ellipsis";
      party.style.whiteSpace = "nowrap";
    }

    percentage.style.display = "block";
    percentage.style.minWidth = "50px";
    percentage.style.textAlign = "right";
    percentage.style.justifySelf = "end";
    percentage.style.whiteSpace = "nowrap";
    percentage.style.lineHeight = "1.25";

    if (row.children.length >= 3) {
      const trophy = row.lastElementChild as HTMLElement | null;
      if (trophy && trophy !== content) {
        trophy.style.width = "24px";
        trophy.style.minWidth = "24px";
        trophy.style.textAlign = "center";
        trophy.style.justifySelf = "center";
      }
    }
  });
}

function applyPreviewFixes() {
  applyPhotoFixes();
  applySenatorQuestion();
  applyRankingLayoutFixes();
}

export default function ArapongasFotosPreviewLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyPreviewFixes();

    const originalFetch = window.fetch.bind(window);
    const patchedFetch: typeof window.fetch = async (input, init) => {
      try {
        const requestUrl =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();

        if (method === "POST" && requestUrl.includes("/api/enquete/arapongas-fotos-preview") && typeof init?.body === "string") {
          const body = JSON.parse(init.body);
          if (body?.action === "submit") {
            const selected = document.querySelector<HTMLInputElement>('input[name="q10"]:checked');
            if (selected?.value) {
              return originalFetch(input, { ...init, body: JSON.stringify({ ...body, q10: selected.value }) });
            }
          }
        }
      } catch {
        // Mantém o envio original se a adaptação da pergunta de senador falhar.
      }

      return originalFetch(input, init);
    };

    window.fetch = patchedFetch;

    const observer = new MutationObserver(() => applyPreviewFixes());
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("resize", applyRankingLayoutFixes);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", applyRankingLayoutFixes);
      if (window.fetch === patchedFetch) window.fetch = originalFetch;
    };
  }, []);

  return children;
}