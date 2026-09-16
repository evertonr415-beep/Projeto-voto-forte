"use client";

import React, { useMemo, useState } from "react";

const MAPA_SNAPSHOT = "d7a280e173dd1f4431d1e910fd9b6672dab37e33";
const MAPA_BASE = `https://cdn.jsdelivr.net/gh/evertonr415-beep/mapa-eleitoral@${MAPA_SNAPSHOT}/`;

function buildIntegratedMapHtml() {
  const loader = String.raw`<!doctype html>
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
  try{
    const response=await fetch(base+'index.html',{cache:'no-store'});
    if(!response.ok) throw new Error('HTTP '+response.status);
    let html=await response.text();
    html=html.replace(/<base\\b[^>]*>/gi,'');
    const integrationCss=`
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
          .topbar-user-section{display:none!important}
          #modal-auth-flow,#modal-force-change-password,#modal-switch-user,#modal-change-password{display:none!important}
        }
      </style>`;
    html=html.replace(/<head([^>]*)>/i,'<head$1>'+integrationCss);
    const integrationScript=`<scr`+`ipt>
      (function(){
        function cleanAuthUi(){
          ['modal-auth-flow','modal-force-change-password','modal-switch-user','modal-change-password'].forEach(function(id){
            var el=document.getElementById(id);if(el){el.style.setProperty('display','none','important');el.style.setProperty('visibility','hidden','important');}
          });
          document.querySelectorAll('.topbar-user-section').forEach(function(el){el.style.setProperty('display','none','important')});
        }
        cleanAuthUi();
        new MutationObserver(cleanAuthUi).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});
        window.addEventListener('load',cleanAuthUi);
        setInterval(cleanAuthUi,1200);
      })();
    </scr`+`ipt>`;
    html=html.replace('</body>',integrationScript+'</body>');
    document.open();document.write(html);document.close();
  }catch(error){
    document.body.innerHTML='<div style="height:100vh;display:grid;place-items:center;background:#080d17;color:#94a3b8;font:600 13px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Não foi possível carregar o Mapa Eleitoral nesta preview.</div>';
  }
})();
</script>
</body>
</html>`;
  return loader;
}

export default function ElectoralPanelClient({
  onBackToDashboard,
}: {
  onBackToDashboard?: () => void;
} = {}) {
  const [loading, setLoading] = useState(true);
  const srcDoc = useMemo(() => buildIntegratedMapHtml(), []);

  return (
    <div
      style={{
        width: "100%",
        minHeight: "calc(100dvh - 88px)",
        height: "calc(100dvh - 88px)",
        background: "#080d17",
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(56,189,248,.18)",
        boxShadow: "0 14px 42px rgba(0,0,0,.28)",
        position: "relative",
      }}
    >
      <div
        style={{
          minHeight: 48,
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          background: "#071524",
          borderBottom: "1px solid rgba(56,189,248,.16)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "#38bdf8", fontSize: 10, fontWeight: 900, letterSpacing: ".08em" }}>
            PAINEL ELEITORAL · ARAPONGAS / PR
          </div>
          <div style={{ color: "#e5edf8", fontSize: 13, fontWeight: 800, marginTop: 2 }}>
            Mapa Eleitoral integrado ao Voto Forte Paraná
          </div>
        </div>
        {onBackToDashboard && (
          <button
            type="button"
            onClick={onBackToDashboard}
            style={{
              border: "1px solid rgba(125,211,252,.28)",
              background: "rgba(8,47,73,.55)",
              color: "#bae6fd",
              borderRadius: 9,
              padding: "7px 10px",
              fontSize: 11,
              fontWeight: 800,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            ← Voltar
          </button>
        )}
      </div>

      {loading && (
        <div
          style={{
            position: "absolute",
            inset: "49px 0 0",
            zIndex: 4,
            display: "grid",
            placeItems: "center",
            background: "#080d17",
            color: "#94a3b8",
            fontSize: 13,
          }}
        >
          Carregando projeto VotoForte Arapongas…
        </div>
      )}

      <iframe
        title="Mapa Eleitoral de Arapongas integrado"
        srcDoc={srcDoc}
        onLoad={() => setLoading(false)}
        sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"
        referrerPolicy="strict-origin-when-cross-origin"
        style={{
          width: "100%",
          height: "calc(100% - 49px)",
          display: "block",
          border: 0,
          background: "#080d17",
        }}
      />
    </div>
  );
}
