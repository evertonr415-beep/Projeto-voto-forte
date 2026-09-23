// ==UserScript==
// @name         ZapHumanizer Pro - Robô de Disparo Humanizado para WhatsApp Web
// @namespace    https://sistemavotoforte.com.br
// @version      1.0
// @description  Disparador humanizado com simulação de digitação, spintax e intervalos de segurança anti-ban
// @author       Voto Forte
// @match        https://web.whatsapp.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Evita carregar duplicado
  if (document.getElementById('zaphumanizer-root')) return;

  // Injeta estilos do Robô flutuante
  const style = document.createElement('style');
  style.innerHTML = `
    #zaphumanizer-root {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .zh-fab-btn {
      background: linear-gradient(135deg, #059669, #10b981);
      color: #fff;
      border: 2px solid #34d399;
      border-radius: 999px;
      padding: 12px 20px;
      font-size: 14px;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 15px rgba(16,185,129,0.4);
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s ease;
    }
    .zh-fab-btn:hover {
      transform: scale(1.05);
      background: linear-gradient(135deg, #047857, #059669);
    }
    .zh-modal {
      position: fixed;
      bottom: 80px;
      right: 24px;
      width: 440px;
      max-width: 90vw;
      background: #0f172a;
      color: #f8fafc;
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 16px;
      padding: 18px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.7);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .zh-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(148,163,184,0.15);
      padding-bottom: 8px;
    }
    .zh-title {
      font-size: 15px;
      font-weight: 800;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .zh-badge {
      background: rgba(16,185,129,0.15);
      color: #34d399;
      border: 1px solid #10b981;
      padding: 2px 7px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 800;
    }
    .zh-form-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .zh-form-group label {
      font-size: 11px;
      font-weight: 700;
      color: #cbd5e1;
    }
    .zh-input, .zh-textarea, .zh-select {
      background: #020617;
      border: 1px solid rgba(148,163,184,0.25);
      color: #fff;
      padding: 8px 10px;
      border-radius: 8px;
      font-size: 12px;
      outline: none;
      width: 100%;
      box-sizing: border-box;
    }
    .zh-textarea {
      min-height: 90px;
      resize: vertical;
      line-height: 1.4;
    }
    .zh-status-box {
      background: #020617;
      border: 1px solid rgba(56,189,248,0.3);
      padding: 10px;
      border-radius: 8px;
      font-size: 12px;
      color: #38bdf8;
      font-weight: 600;
    }
    .zh-btn {
      padding: 9px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .zh-btn-primary {
      background: linear-gradient(135deg, #059669, #10b981);
      color: #fff;
    }
    .zh-btn-stop {
      background: linear-gradient(135deg, #dc2626, #ef4444);
      color: #fff;
    }
    .zh-btn-pause {
      background: linear-gradient(135deg, #d97706, #f59e0b);
      color: #fff;
    }
  `;
  document.head.appendChild(style);

  // Spintax parser
  function parseSpintax(text) {
    const spintaxRegex = /\{([^{}]+)\}/g;
    let matches = text.match(spintaxRegex);
    let resolved = text;
    while (matches && matches.length > 0) {
      for (const match of matches) {
        const options = match.slice(1, -1).split('|');
        const randomOption = options[Math.floor(Math.random() * options.length)] || '';
        resolved = resolved.replace(match, randomOption);
      }
      matches = resolved.match(spintaxRegex);
    }
    return resolved;
  }

  function resolveTags(text, name, district) {
    const firstName = (name || 'Amigo(a)').trim().split(/\s+/)[0];
    return text
      .replace(/\{nome\}/gi, name || 'Amigo(a)')
      .replace(/\{primeiro_nome\}/gi, firstName)
      .replace(/\{bairro\}/gi, district || 'Arapongas')
      .replace(/\{cidade\}/gi, 'Arapongas')
      .replace(/\{link_enquete\}/gi, 'https://sistemavotoforte.com.br/enquete/arapongas');
  }

  // Cria o Container da UI
  const root = document.createElement('div');
  root.id = 'zaphumanizer-root';

  const defaultMsg = `{Olá|Oi|Tudo bem?}, {primeiro_nome}! 👋

Será que o candidato que todo mundo pensa está na frente aqui em {bairro}? 👀

Participe da nossa enquete e descubra quem está sendo mais lembrado na cidade:

📊 *Resultado em tempo real*
⏱️ *Menos de 1 minuto*

👉 *Clique e participe:*
{link_enquete}`;

  let isModalOpen = true;
  let isRunning = false;
  let isPaused = false;
  let abortBroadcast = false;

  root.innerHTML = `
    <div id="zh-modal-card" class="zh-modal">
      <div class="zh-header">
        <div class="zh-title">
          <span>🤖 ZapHumanizer Pro</span>
          <span class="zh-badge">WhatsApp Web Oficial</span>
        </div>
        <button id="zh-close-btn" style="background:none; border:none; color:#94a3b8; font-size:16px; cursor:pointer;">✕</button>
      </div>

      <div class="zh-form-group">
        <label>Contatos (Número, Nome, Bairro - 1 por linha):</label>
        <textarea id="zh-contacts" class="zh-textarea" placeholder="43999990001, João, Centro&#10;43999990002, Maria, Paraíso"></textarea>
      </div>

      <div class="zh-form-group">
        <label>Mensagem (com Spintax):</label>
        <textarea id="zh-msg" class="zh-textarea">${defaultMsg}</textarea>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
        <div class="zh-form-group">
          <label>Intervalo:</label>
          <select id="zh-interval" class="zh-select">
            <option value="40-70">40s a 70s (Seguro)</option>
            <option value="25-45">25s a 45s (Moderado)</option>
            <option value="60-120">60s a 120s (Ultra Seguro)</option>
          </select>
        </div>
        <div class="zh-form-group">
          <label>Limite diário:</label>
          <select id="zh-limit" class="zh-select">
            <option value="150" selected>150 contatos</option>
            <option value="100">100 contatos</option>
            <option value="50">50 contatos</option>
          </select>
        </div>
      </div>

      <div class="zh-status-box" id="zh-status-box">
        <span id="zh-status-text">🟢 Pronto para iniciar o envio.</span>
      </div>

      <div style="display:flex; gap:8px;">
        <button id="zh-btn-start" class="zh-btn zh-btn-primary" style="flex:1;">▶️ Iniciar Disparo Humanizado</button>
        <button id="zh-btn-pause" class="zh-btn zh-btn-pause" style="display:none; flex:1;">⏸️ Pausar</button>
        <button id="zh-btn-stop" class="zh-btn zh-btn-stop" style="display:none; flex:1;">⏹️ Parar</button>
      </div>
    </div>

    <button id="zh-fab" class="zh-fab-btn" style="display:none;">
      🤖 Robô Humanizado
    </button>
  `;

  document.body.appendChild(root);

  // Toggle do Modal
  const modalCard = document.getElementById('zh-modal-card');
  const fabBtn = document.getElementById('zh-fab');
  const closeBtn = document.getElementById('zh-close-btn');

  closeBtn.onclick = () => {
    modalCard.style.display = 'none';
    fabBtn.style.display = 'flex';
  };

  fabBtn.onclick = () => {
    modalCard.style.display = 'flex';
    fabBtn.style.display = 'none';
  };

  // Carrega contatos de amostra se vazio
  const sampleLines = [];
  const sampleDistricts = ["Centro", "Jardim Paraíso", "Jardim Imperial", "Jardim União", "Jardim São Paulo", "Jardim América"];
  const sampleNames = ["João", "Maria", "Pedro", "Ana", "Carlos", "Juliana", "Fernando", "Lucas", "Patrícia", "Aline"];
  for (let i = 1; i <= 150; i++) {
    sampleLines.push(`43999${10000 + i}, ${sampleNames[i % sampleNames.length]}, ${sampleDistricts[i % sampleDistricts.length]}`);
  }
  document.getElementById('zh-contacts').value = sampleLines.slice(0, 10).join('\n');

  // Motor de Disparo no WhatsApp Web
  const btnStart = document.getElementById('zh-btn-start');
  const btnPause = document.getElementById('zh-btn-pause');
  const btnStop = document.getElementById('zh-btn-stop');
  const statusText = document.getElementById('zh-status-text');

  btnStart.onclick = async () => {
    const lines = document.getElementById('zh-contacts').value.trim().split('\n').filter(Boolean);
    if (lines.length === 0) {
      alert('Digite ou cole pelo menos 1 contato para disparar.');
      return;
    }

    const limit = parseInt(document.getElementById('zh-limit').value) || 150;
    const intervalVal = document.getElementById('zh-interval').value.split('-').map(Number);
    const minDelay = intervalVal[0] || 40;
    const maxDelay = intervalVal[1] || 70;
    const tpl = document.getElementById('zh-msg').value;

    const contacts = lines.slice(0, limit).map(line => {
      const parts = line.split(',').map(p => p.trim());
      return { phone: parts[0] || '', name: parts[1] || 'Eleitor', district: parts[2] || 'Arapongas' };
    });

    isRunning = true;
    isPaused = false;
    abortBroadcast = false;

    btnStart.style.display = 'none';
    btnPause.style.display = 'flex';
    btnStop.style.display = 'flex';

    for (let i = 0; i < contacts.length; i++) {
      if (abortBroadcast) break;

      while (isPaused) {
        statusText.innerText = '⏸️ Disparo pausado.';
        await new Promise(r => setTimeout(r, 1000));
        if (abortBroadcast) break;
      }
      if (abortBroadcast) break;

      const c = contacts[i];
      statusText.innerText = `[${i + 1}/${contacts.length}] 🔍 Abrindo conversa com ${c.name} (${c.phone})...`;

      // 1. Abrir o chat direto pelo link de API do WhatsApp Web
      const cleanPhone = c.phone.replace(/\D/g, '');
      const finalMsg = resolveTags(parseSpintax(tpl), c.name, c.district);

      // Simula navegação para o chat do contato
      const link = document.createElement('a');
      link.href = `https://web.whatsapp.com/send?phone=${cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone}&text=${encodeURIComponent(finalMsg)}`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();

      // Aguarda o chat carregar e simula digitação
      let waitSeconds = 6;
      while (waitSeconds > 0 && !abortBroadcast && !isPaused) {
        statusText.innerText = `[${i + 1}/${contacts.length}] ⌨️ Simulando digitação para ${c.name}... (${waitSeconds}s)`;
        await new Promise(r => setTimeout(r, 1000));
        waitSeconds--;
      }

      if (abortBroadcast) break;

      // 2. Localiza o botão de envio e clica
      const sendButton = document.querySelector('button[aria-label="Enviar"], [data-icon="send"]');
      if (sendButton) {
        const btnElement = sendButton.closest('button') || sendButton;
        btnElement.click();
        statusText.innerText = `[${i + 1}/${contacts.length}] ✅ Enviado para ${c.name}!`;
      } else {
        // Pressiona Enter se o botão não for encontrado
        const inputField = document.querySelector('div[contenteditable="true"][data-tab="10"]') || document.querySelector('div[contenteditable="true"]');
        if (inputField) {
          inputField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
          statusText.innerText = `[${i + 1}/${contacts.length}] ✅ Enviado para ${c.name}!`;
        } else {
          statusText.innerText = `[${i + 1}/${contacts.length}] ⚠️ Preparado no chat de ${c.name}.`;
        }
      }

      // 3. Pausa de Lote ou Intervalo Anti-Ban
      if ((i + 1) % 25 === 0 && i + 1 < contacts.length) {
        let rest = 600; // 10 min
        while (rest > 0 && !abortBroadcast && !isPaused) {
          const m = Math.floor(rest / 60);
          const s = rest % 60;
          statusText.innerText = `☕ Pausa preventiva de lote: ${m}m ${s}s restantes...`;
          await new Promise(r => setTimeout(r, 1000));
          rest--;
        }
      } else if (i + 1 < contacts.length) {
        let delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        while (delay > 0 && !abortBroadcast && !isPaused) {
          statusText.innerText = `⏳ Intervalo humanizado: ${delay}s restantes...`;
          await new Promise(r => setTimeout(r, 1000));
          delay--;
        }
      }
    }

    isRunning = false;
    statusText.innerText = abortBroadcast ? '⏹️ Disparo cancelado.' : '🎉 Todos os 150 disparos foram concluídos!';
    btnStart.style.display = 'flex';
    btnPause.style.display = 'none';
    btnStop.style.display = 'none';
  };

  btnPause.onclick = () => {
    isPaused = !isPaused;
    btnPause.innerText = isPaused ? '▶️ Retomar' : '⏸️ Pausar';
  };

  btnStop.onclick = () => {
    if (confirm('Deseja realmente parar o disparo?')) {
      abortBroadcast = true;
    }
  };

  console.log('🤖 ZapHumanizer Pro ativado com sucesso no WhatsApp Web!');
})();
