"use client";

import { useEffect } from "react";

const PROFILE_PROXY_CLASS = "survey-profile-proxy";

export default function SurveyHeaderMobilePolish() {
  useEffect(() => {
    let disposed = false;

    const syncHeader = () => {
      if (disposed || !window.matchMedia("(max-width: 760px)").matches) return;

      document
        .querySelectorAll<HTMLElement>(".survey-drawer .survey-header")
        .forEach((header) => {
          const sourceProfile = document.querySelector<HTMLButtonElement>(
            ".app-shell .topbar .profile",
          );
          const sourceAvatar = sourceProfile?.querySelector<HTMLElement>(":scope > span");
          const avatarText = (sourceAvatar?.textContent || "VF").trim().slice(0, 2).toUpperCase() || "VF";

          let proxy = header.querySelector<HTMLButtonElement>(`.${PROFILE_PROXY_CLASS}`);
          if (!proxy) {
            proxy = document.createElement("button");
            proxy.type = "button";
            proxy.className = PROFILE_PROXY_CLASS;
            proxy.setAttribute("aria-label", "Abrir perfil do usuário");
            header.appendChild(proxy);

            proxy.addEventListener("click", () => {
              const profileButton = document.querySelector<HTMLButtonElement>(
                ".app-shell .topbar .profile",
              );
              const closeButton = header.querySelector<HTMLButtonElement>(".survey-close");
              closeButton?.click();
              window.setTimeout(() => profileButton?.click(), 120);
            });
          }

          proxy.textContent = avatarText;
        });
    };

    const observer = new MutationObserver(syncHeader);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", syncHeader);
    syncHeader();

    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener("resize", syncHeader);
      document
        .querySelectorAll(`.${PROFILE_PROXY_CLASS}`)
        .forEach((node) => node.remove());
    };
  }, []);

  return (
    <style jsx global>{`
      @media (max-width: 760px) {
        .survey-drawer .survey-header {
          box-sizing: border-box !important;
          display: flex !important;
          align-items: center !important;
          width: 100% !important;
          min-height: 58px !important;
          height: 58px !important;
          padding: 7px 9px !important;
          gap: 6px !important;
          overflow: hidden !important;
          background: #071a2b !important;
          border-bottom: 1px solid rgba(56, 189, 248, 0.18) !important;
          box-shadow: 0 5px 16px rgba(2, 8, 23, 0.18) !important;
        }

        .survey-drawer .survey-title-group {
          order: -1 !important;
          display: flex !important;
          align-items: center !important;
          flex: 1 1 0 !important;
          min-width: 0 !important;
          max-width: none !important;
          margin: 0 !important;
          gap: 6px !important;
          overflow: hidden !important;
        }

        .survey-drawer .survey-logo {
          box-sizing: border-box !important;
          flex: 0 0 27px !important;
          width: 27px !important;
          min-width: 27px !important;
          max-width: 27px !important;
          height: 27px !important;
          min-height: 27px !important;
          max-height: 27px !important;
          padding: 0 !important;
          overflow: hidden !important;
          border-radius: 7px !important;
          border: 1px solid rgba(56, 189, 248, 0.34) !important;
          background-color: #0b1a2c !important;
          background-image: url("/parana-icon-small.jpg") !important;
          background-position: center !important;
          background-repeat: no-repeat !important;
          background-size: cover !important;
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.16) !important;
          color: transparent !important;
          font-size: 0 !important;
          line-height: 0 !important;
        }

        .survey-drawer .survey-heading-copy {
          display: flex !important;
          align-items: center !important;
          flex: 1 1 0 !important;
          min-width: 0 !important;
          height: 34px !important;
          overflow: hidden !important;
        }

        .survey-drawer .survey-heading-copy h2 {
          display: block !important;
          width: 100% !important;
          min-width: 0 !important;
          margin: 0 !important;
          overflow: hidden !important;
          color: transparent !important;
          font-size: 0 !important;
          line-height: 1 !important;
          white-space: nowrap !important;
          text-overflow: ellipsis !important;
        }

        .survey-drawer .survey-heading-copy h2::before {
          content: "Enquete Digital";
          display: block !important;
          min-width: 0 !important;
          overflow: hidden !important;
          color: #f8fafc !important;
          font-size: 15px !important;
          line-height: 1.08 !important;
          font-weight: 850 !important;
          letter-spacing: -0.02em !important;
          white-space: nowrap !important;
          text-overflow: ellipsis !important;
        }

        .survey-drawer .survey-heading-copy h2 > span,
        .survey-drawer .survey-heading-copy p {
          display: none !important;
        }

        .survey-drawer .survey-close {
          order: -2 !important;
          display: inline-grid !important;
          place-items: center !important;
          box-sizing: border-box !important;
          flex: 0 0 34px !important;
          width: 34px !important;
          min-width: 34px !important;
          max-width: 34px !important;
          height: 34px !important;
          min-height: 34px !important;
          max-height: 34px !important;
          margin: 0 !important;
          padding: 0 !important;
          border: 1px solid rgba(56, 189, 248, 0.28) !important;
          border-radius: 10px !important;
          background: #0f1e3a !important;
          color: transparent !important;
          box-shadow: none !important;
          font-size: 0 !important;
          line-height: 1 !important;
        }

        .survey-drawer .survey-close::before {
          content: "‹";
          display: block !important;
          color: #e7f5ff !important;
          font-size: 29px !important;
          font-weight: 400 !important;
          line-height: 0.8 !important;
          transform: translateY(-1px) !important;
        }

        .survey-drawer .survey-close:active {
          background: rgba(56, 189, 248, 0.12) !important;
          border-color: rgba(56, 189, 248, 0.46) !important;
        }

        .survey-drawer .${PROFILE_PROXY_CLASS} {
          order: 0 !important;
          display: inline-grid !important;
          place-items: center !important;
          box-sizing: border-box !important;
          flex: 0 0 34px !important;
          width: 34px !important;
          min-width: 34px !important;
          max-width: 34px !important;
          height: 34px !important;
          min-height: 34px !important;
          max-height: 34px !important;
          margin: 0 !important;
          padding: 0 !important;
          border: 1px solid rgba(56, 189, 248, 0.46) !important;
          border-radius: 50% !important;
          background: linear-gradient(180deg, #17375e 0%, #102844 100%) !important;
          color: #f8fafc !important;
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.18) !important;
          font-family: inherit !important;
          font-size: 11px !important;
          font-weight: 850 !important;
          letter-spacing: -0.02em !important;
          line-height: 1 !important;
          cursor: pointer !important;
          -webkit-tap-highlight-color: transparent !important;
        }

        .survey-drawer .${PROFILE_PROXY_CLASS}:active {
          transform: scale(0.96) !important;
          border-color: rgba(125, 211, 252, 0.78) !important;
        }

        html[data-vf-theme="light"] .survey-drawer .survey-header {
          background: #f8fbff !important;
          border-bottom-color: #d8e4ef !important;
          box-shadow: 0 5px 16px rgba(15, 42, 70, 0.08) !important;
        }

        html[data-vf-theme="light"] .survey-drawer .survey-heading-copy h2::before {
          color: #153b65 !important;
        }

        html[data-vf-theme="light"] .survey-drawer .survey-close {
          border-color: #cbd9e7 !important;
          background: #ffffff !important;
        }

        html[data-vf-theme="light"] .survey-drawer .survey-close::before {
          color: #153b65 !important;
        }
      }

      @media (max-width: 430px) {
        .survey-drawer .survey-header {
          padding-inline: 7px !important;
          gap: 5px !important;
        }

        .survey-drawer .survey-close,
        .survey-drawer .${PROFILE_PROXY_CLASS} {
          flex-basis: 34px !important;
          width: 34px !important;
          min-width: 34px !important;
          max-width: 34px !important;
          height: 34px !important;
          min-height: 34px !important;
          max-height: 34px !important;
        }

        .survey-drawer .survey-logo {
          flex-basis: 25px !important;
          width: 25px !important;
          min-width: 25px !important;
          max-width: 25px !important;
          height: 25px !important;
          min-height: 25px !important;
          max-height: 25px !important;
        }

        .survey-drawer .survey-heading-copy h2::before {
          font-size: 14px !important;
        }
      }
    `}</style>
  );
}
