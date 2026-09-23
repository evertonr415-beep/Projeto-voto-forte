"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  LocalDatabaseMeta,
  LocalContactRecord,
  listLocalDatabases,
  createLocalDatabase,
  deleteLocalDatabase,
  parseLocalDatabaseFile,
  getActiveLocalDatabaseId,
  setActiveLocalDatabaseId,
} from "./local-database-service";

interface LocalDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDbId: string | null;
  onSelectDatabase: (dbId: string | null) => void;
  onDatabaseChanged?: () => void;
  tell?: (msg: string) => void;
}

export default function LocalDatabaseModal({
  isOpen,
  onClose,
  activeDbId,
  onSelectDatabase,
  onDatabaseChanged,
  tell = alert,
}: LocalDatabaseModalProps) {
  const [databases, setDatabases] = useState<LocalDatabaseMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"list" | "upload">("list");

  // Formulário de upload
  const [dbName, setDbName] = useState("");
  const [dbDescription, setDbDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<Omit<LocalContactRecord, "id">[]>([]);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      void loadDbs();
    }
  }, [isOpen]);

  async function loadDbs() {
    setLoading(true);
    try {
      const list = await listLocalDatabases();
      setDatabases(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileSelected(file?: File) {
    if (!file) return;
    setSelectedFile(file);
    if (!dbName) {
      // Auto-preencher nome com o nome do arquivo sem extensão
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setDbName(cleanName);
    }
    setParsing(true);
    try {
      const records = await parseLocalDatabaseFile(file);
      setParsedPreview(records);
      tell(`${records.length} registro(s) identificados no arquivo.`);
    } catch (err) {
      console.error(err);
      tell("Não foi possível ler o arquivo. Verifique o formato.");
    } finally {
      setParsing(false);
    }
  }

  async function handleCreateDatabase(e: React.FormEvent) {
    e.preventDefault();
    if (!dbName.trim()) {
      tell("Informe um nome para o banco de dados.");
      return;
    }
    if (parsedPreview.length === 0) {
      tell("Selecione um arquivo válido com contatos/eleitores.");
      return;
    }

    setSaving(true);
    try {
      const meta = await createLocalDatabase(dbName, parsedPreview, {
        description: dbDescription,
        fileName: selectedFile?.name,
      });
      tell(`Banco de dados "${meta.name}" criado com sucesso (${meta.recordCount} registros)!`);
      
      // Limpar formulário
      setDbName("");
      setDbDescription("");
      setSelectedFile(null);
      setParsedPreview([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      
      // Recarregar e ativar a nova base
      await loadDbs();
      onSelectDatabase(meta.id);
      setActiveLocalDatabaseId(meta.id);
      if (onDatabaseChanged) onDatabaseChanged();
      setTab("list");
    } catch (err) {
      console.error(err);
      tell("Erro ao salvar banco de dados local.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDatabase(db: LocalDatabaseMeta, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Deseja realmente excluir o banco de dados local "${db.name}" (${db.recordCount} registros)? Esta ação não pode ser desfeita.`)) {
      return;
    }
    try {
      await deleteLocalDatabase(db.id);
      if (activeDbId === db.id) {
        onSelectDatabase(null);
        setActiveLocalDatabaseId(null);
      }
      await loadDbs();
      if (onDatabaseChanged) onDatabaseChanged();
      tell(`Banco de dados "${db.name}" excluído.`);
    } catch (err) {
      console.error(err);
      tell("Erro ao excluir banco de dados local.");
    }
  }

  function handleSelect(id: string | null) {
    onSelectDatabase(id);
    setActiveLocalDatabaseId(id);
    if (onDatabaseChanged) onDatabaseChanged();
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="local-db-modal-overlay" onClick={onClose}>
      <div className="local-db-modal" onClick={(e) => e.stopPropagation()}>
        <div className="local-db-header">
          <div className="local-db-title-area">
            <span className="local-db-icon">🗄️</span>
            <div>
              <h2>Bancos de Dados Locais</h2>
              <p>Gerencie múltiplas bases de eleitores isoladas sem alterar o banco principal.</p>
            </div>
          </div>
          <button className="local-db-close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        <div className="local-db-tabs">
          <button
            className={`local-db-tab ${tab === "list" ? "active" : ""}`}
            onClick={() => setTab("list")}
          >
            📋 Bases Disponíveis ({databases.length + 1})
          </button>
          <button
            className={`local-db-tab ${tab === "upload" ? "active" : ""}`}
            onClick={() => setTab("upload")}
          >
            ➕ Subir Novo Banco de Dados
          </button>
        </div>

        <div className="local-db-body">
          {tab === "list" ? (
            <div className="local-db-list-view">
              <div className="local-db-notice">
                <span>💡</span>
                <p>
                  A <b>Base Principal</b> armazena os contatos da nuvem do sistema. Você pode criar novas bases (ex: <i>"dados carrim"</i>, <i>"eleitores centro"</i>) e alternar entre elas a qualquer momento com isolamento total.
                </p>
              </div>

              <div className="local-db-grid">
                {/* Cartão da Base Principal do Sistema */}
                <div
                  className={`local-db-card default-db ${activeDbId === null ? "active-selected" : ""}`}
                  onClick={() => handleSelect(null)}
                >
                  <div className="card-top">
                    <span className="db-badge standard">BASE PRINCIPAL (NUVEM)</span>
                    {activeDbId === null && <span className="active-tag">● EM USO ATUALMENTE</span>}
                  </div>
                  <h3>Base Principal do Sistema</h3>
                  <p>Contatos e cadastros oficiais salvos no servidor principal.</p>
                  <div className="card-footer">
                    <button
                      className={`btn-select ${activeDbId === null ? "selected" : ""}`}
                      onClick={() => handleSelect(null)}
                    >
                      {activeDbId === null ? "✓ Base Ativa" : "Selecionar Esta Base"}
                    </button>
                  </div>
                </div>

                {/* Lista de Bancos Locais Criados */}
                {loading ? (
                  <div className="local-db-loading">Carregando bases locais…</div>
                ) : databases.length === 0 ? (
                  <div className="local-db-empty">
                    <p>Nenhuma base local criada ainda.</p>
                    <button className="btn-upload-shortcut" onClick={() => setTab("upload")}>
                      + Subir sua primeira base local agora
                    </button>
                  </div>
                ) : (
                  databases.map((db) => (
                    <div
                      key={db.id}
                      className={`local-db-card custom-db ${activeDbId === db.id ? "active-selected" : ""}`}
                      onClick={() => handleSelect(db.id)}
                    >
                      <div className="card-top">
                        <span className="db-badge custom">BASE LOCAL ISOLADA</span>
                        {activeDbId === db.id && <span className="active-tag">● EM USO ATUALMENTE</span>}
                      </div>
                      <h3>{db.name}</h3>
                      <p>{db.description || "Base de contatos importada localmente."}</p>
                      
                      <div className="db-stats">
                        <span>👥 <b>{db.recordCount.toLocaleString("pt-BR")}</b> registros</span>
                        <span>📅 {new Date(db.createdAt).toLocaleDateString("pt-BR")}</span>
                      </div>

                      {db.fileName && <div className="db-filename">📄 {db.fileName}</div>}

                      <div className="card-footer">
                        <button
                          className={`btn-select ${activeDbId === db.id ? "selected" : ""}`}
                          onClick={() => handleSelect(db.id)}
                        >
                          {activeDbId === db.id ? "✓ Base Ativa" : "Selecionar Esta Base"}
                        </button>
                        <button
                          className="btn-delete"
                          title="Excluir base local"
                          onClick={(e) => void handleDeleteDatabase(db, e)}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <form className="local-db-upload-form" onSubmit={handleCreateDatabase}>
              <div className="form-group">
                <label>
                  Nome do Banco de Dados <span className="req">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: dados carrim, eleitores bairro sul, pesquisa 2026..."
                  value={dbName}
                  onChange={(e) => setDbName(e.target.value)}
                  required
                />
                <small>Dê um nome fácil de identificar para poder alternar depois.</small>
              </div>

              <div className="form-group">
                <label>Descrição / Observações (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Base recebida em 22/09 com 5.000 eleitores"
                  value={dbDescription}
                  onChange={(e) => setDbDescription(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>
                  Arquivo da Base (.csv, .xlsx, .xls, .vcf) <span className="req">*</span>
                </label>
                <div className="dropzone-file-picker">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,.vcf,.txt"
                    onChange={(e) => void handleFileSelected(e.target.files?.[0])}
                  />
                  <div className="dropzone-visual">
                    <span className="drop-icon">📁</span>
                    {selectedFile ? (
                      <div>
                        <b>{selectedFile.name}</b> ({(selectedFile.size / 1024).toFixed(1)} KB)
                        <p>Clique para trocar de arquivo</p>
                      </div>
                    ) : (
                      <div>
                        <b>Clique aqui para selecionar o arquivo</b>
                        <p>Formatos suportados: CSV (separado por vírgula ou ponto e vírgula), Excel (.xlsx) ou VCF</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {parsing && <div className="parsing-status">⏳ Processando e validando arquivo…</div>}

              {parsedPreview.length > 0 && (
                <div className="parsed-preview-area">
                  <div className="preview-header">
                    <h4>Prévia dos Dados: {parsedPreview.length} registros prontos para importação</h4>
                  </div>
                  <div className="preview-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Nome</th>
                          <th>Telefone</th>
                          <th>Perfil</th>
                          <th>Bairro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedPreview.slice(0, 5).map((row, i) => (
                          <tr key={i}>
                            <td>{i + 1}</td>
                            <td>{row.name}</td>
                            <td>{row.phone}</td>
                            <td>{row.kind}</td>
                            <td>{row.district || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedPreview.length > 5 && (
                    <small className="more-count">... e mais {parsedPreview.length - 5} registros.</small>
                  )}
                </div>
              )}

              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setTab("list")}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={saving || parsing || parsedPreview.length === 0}
                >
                  {saving ? "Salvando Banco Local…" : `Salvar Banco "${dbName || "Novo"}" (${parsedPreview.length} registros)`}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
