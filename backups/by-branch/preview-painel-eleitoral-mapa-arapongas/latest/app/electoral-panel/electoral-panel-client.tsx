"use client";

import React, { useMemo, useState } from "react";

const MAPA_SNAPSHOT = "d7a280e173dd1f4431d1e910fd9b6672dab37e33";
const MAPA_BASE = `https://cdn.jsdelivr.net/gh/evertonr415-beep/mapa-eleitoral@${MAPA_SNAPSHOT}/`;

const INTEGRATION_CSS = `
<base href="${MAPA_BASE}">
<style id="vf-integrated-panel-style">
  html,body{margin:0!important;width:100%!important;height:100%!important;overflow:hidden!important;background:#080d17!important}
  #vf-preview-badge{display:none!important}
  #modal-auth-flow,#modal-force-change-password,#modal-switch-user,#modal-change-password{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}
  .topbar-user-section{display:none!important}
  .topbar{padding-right:10px!important}
  .brand-info h1{font-size:clamp(12px,1.35vw,18px)!important}
  .brand-info p{font-size:clamp(9px,.85vw,12px)!important}

  @media(max-width:900px){
    html,body,#app-root{width:100%!important;max-width:none!important;height:100%!important;min-height:100%!important;margin:0!important;border-radius:0!important}
    .topbar{height:auto!important;min-height:50px!important;padding:5px 6px!important;border-radius:0!important;gap:0!important}
    .brand-section{display:none!important}
    .topbar-user-section{display:none!important}
    .topbar-nav-section{width:100%!important;max-width:none!important;display:block!important;overflow-x:auto!important;overflow-y:hidden!important;padding:0!important;margin:0!important;scrollbar-width:none!important;-webkit-overflow-scrolling:touch!important}
    .topbar-nav-section::-webkit-scrollbar{display:none!important}
    .view-tabs{display:flex!important;width:max-content!important;min-width:100%!important;gap:4px!important;padding:2px 4px!important;margin:0!important;background:#111b2d!important;border:0!important;border-radius:0!important}
    .tab-btn{flex:0 0 auto!important;min-height:42px!important;padding:8px 12px!important;border-radius:8px!important;font-size:13px!important;white-space:nowrap!important}
    .tab-btn svg{width:15px!important;height:15px!important}
    .layers-box-compact,.select-filter,.btn-topbar{display:none!important}
    #modal-auth-flow,#modal-force-change-password,#modal-switch-user,#modal-change-password{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}
    .workspace-main{height:calc(100% - 50px)!important;min-height:0!important;margin:0!important;padding:0!important;border-radius:0!important}
    #view-map-container,#map{height:100%!important;min-height:0!important;border-radius:0!important}
  }
</style>`;

function buildIntegratedMapHtml() {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<meta name="theme-color" content="#080d17" />
<style>
html,body{margin:0;width:100%;height:100%;background:#080d17;color:#dbeafe;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden}
#vf-shell-loader{position:fixed;inset:0;display:grid;place-items:center;background:#080d17;color:#94a3b8;font-size:13px;z-index:2147483647}
</style>
</head>
<body>
<div id="vf-shell-loader">Carregando Mapa Eleitoral de Arapongas…</div>
<script>
(async function(){
  const base=${JSON.stringify(MAPA_BASE)};
  const integrationCss=${JSON.stringify(INTEGRATION_CSS)};
  try{
    const response=await fetch(base+'index.html',{cache:'no-store'});
    if(!response.ok) throw new Error('HTTP '+response.status);
    let html=await response.text();
    html=html.replace(/<base\\b[^>]*>/gi,'');
    html=html.replace(/<head([^>]*)>/i,'<head$1>'+integrationCss);
    document.open();document.write(html);document.close();
  }catch(error){
    document.body.innerHTML='<div style="height:100vh;display:grid;place-items:center;background:#080d17;color:#94a3b8;font:600 13px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Não foi possível carregar o Mapa Eleitoral nesta preview.</div>';
  }
})();
<\/script>
</body>
</html>`;
}

export default function ElectoralPanelClient() {
  const [loading, setLoading] = useState(true);
  const srcDoc = useMemo(() => buildIntegratedMapHtml(), []);

  return (
    <>
      <style>{`
        .vf-electoral-integrated-host {
          width: 100%;
          height: calc(100dvh - 96px);
          min-height: 620px;
          margin: 0;
          padding: 0;
          overflow: hidden;
          position: relative;
          background: #080d17;
          border: 0;
          border-radius: 0;
          box-shadow: none;
        }
        .vf-electoral-integrated-frame {
          display: block;
          width: 100%;
          height: 100%;
          border: 0;
          margin: 0;
          padding: 0;
          background: #080d17;
        }
        @media (max-width: 900px) {
          .vf-electoral-integrated-host {
            width: 100vw;
            max-width: 100vw;
            height: calc(100dvh - 72px);
            min-height: 0;
            margin-left: calc(50% - 50vw);
            margin-right: calc(50% - 50vw);
            margin-top: -1px;
          }
        }
      `}</style>

      <div className="vf-electoral-integrated-host">
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 4,
              display: "grid",
              placeItems: "center",
              background: "#080d17",
              color: "#94a3b8",
              fontSize: 13,
            }}
          >
            Carregando Mapa Eleitoral de Arapongas…
          </div>
        )}

        <iframe
          className="vf-electoral-integrated-frame"
          title="Mapa Eleitoral de Arapongas integrado"
          srcDoc={srcDoc}
          onLoad={() => setLoading(false)}
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </>
  );
}
