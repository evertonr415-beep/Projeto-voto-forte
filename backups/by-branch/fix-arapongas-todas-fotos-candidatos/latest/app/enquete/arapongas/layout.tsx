import type { ReactNode } from "react";

const candidatePhotoProxyScript = String.raw`
(function () {
  var candidateNames = new Set([
    "lula",
    "flavio bolsonaro",
    "augusto cury",
    "renan santos",
    "ronaldo caiado",
    "romeu zema",
    "sergio moro",
    "requiao filho",
    "sandro alex",
    "luiz franca",
    "alexandre curi",
    "cristina graeml",
    "deltan dallagnol",
    "filipe barros",
    "gleisi",
    "dr rosinha",
    "neto santos",
    "ricardo barros",
    "pedro lupion",
    "beto preto",
    "luciano ducci",
    "bonin",
    "marco brasil",
    "santin roveda",
    "pedro paulo bazana",
    "sergio onofre",
    "aline franzon",
    "delegado jacovos",
    "cobra reporter"
  ]);

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .split("")
      .filter(function (character) {
        var code = character.charCodeAt(0);
        return code < 768 || code > 879;
      })
      .join("")
      .trim()
      .toLowerCase();
  }

  function proxyCandidateImage(img) {
    if (!(img instanceof HTMLImageElement)) return;
    if (!candidateNames.has(normalize(img.getAttribute("alt")))) return;

    var raw = img.getAttribute("src");
    if (!raw) return;

    try {
      var current = new URL(raw, window.location.href);
      if (current.origin === window.location.origin) return;

      var proxied = "/api/enquete/candidate-photo?url=" + encodeURIComponent(current.href);
      if (img.getAttribute("src") !== proxied) img.setAttribute("src", proxied);
    } catch (_) {}
  }

  function scan(root) {
    if (!root) return;
    if (root instanceof HTMLImageElement) proxyCandidateImage(root);
    if (root.querySelectorAll) root.querySelectorAll("img").forEach(proxyCandidateImage);
  }

  scan(document);

  new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.type === "attributes") {
        proxyCandidateImage(mutation.target);
        return;
      }
      mutation.addedNodes.forEach(scan);
    });
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src"]
  });
})();
`;

export default function EnqueteArapongasLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: candidatePhotoProxyScript }} />
      <style>{`
        /* Pós-voto: mantém o mesmo azul do banner até a confirmação. */
        div:has(> header > img[alt="Enquete Voto Forte Paraná"]) > header {
          background: #0e1d30 !important;
          box-shadow: none !important;
          border-bottom: 0 !important;
        }

        div:has(> header > img[alt="Enquete Voto Forte Paraná"]) > section {
          background: #0e1d30 !important;
          border-top: 0 !important;
        }

        div:has(> header > img[alt="Enquete Voto Forte Paraná"]) > section > div > div:first-child {
          width: 64px !important;
          height: 64px !important;
          margin-bottom: 12px !important;
          font-size: 34px !important;
        }

        div:has(> header > img[alt="Enquete Voto Forte Paraná"]) > section h1 {
          font-size: 24px !important;
          margin-bottom: 8px !important;
        }

        div:has(> header > img[alt="Enquete Voto Forte Paraná"]) > section p {
          font-size: 13px !important;
          line-height: 1.5 !important;
          color: #d7e0ea !important;
        }

        @media (max-width: 560px) {
          div:has(> header > img[alt="Enquete Voto Forte Paraná"]) > section {
            padding-top: 22px !important;
            padding-bottom: 50px !important;
          }

          div:has(> header > img[alt="Enquete Voto Forte Paraná"]) > section > div > div:first-child {
            width: 58px !important;
            height: 58px !important;
            font-size: 31px !important;
          }

          div:has(> header > img[alt="Enquete Voto Forte Paraná"]) > section h1 {
            font-size: 22px !important;
          }

          div:has(> header > img[alt="Enquete Voto Forte Paraná"]) > section p {
            font-size: 12.5px !important;
          }
        }
      `}</style>
      {children}
    </>
  );
}
