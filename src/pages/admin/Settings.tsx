import { useState } from "react";
import type { FormEvent } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useSearchParams } from "react-router-dom";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { Badge, Button, Checkbox, Field, Notice, PageHeader, inputClass } from "../../components/admin/ui";
import { errorMessage } from "../../lib/errors";
import { formatCEP, formatDate } from "../../lib/format";
import { centsToInput, parseBRL } from "../../../shared/money";

type Settings = FunctionReturnType<typeof api.settings.getAdminSettings>;

function StoreForm({ initial }: { initial: Settings["store"] }) {
  const save = useMutation(api.settings.saveStore);
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      await save(form);
      setMessage({ kind: "success", text: "Informações da loja salvas." });
    } catch (e) {
      setMessage({ kind: "error", text: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Informações da loja</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome da loja" htmlFor="s-nome"><input id="s-nome" className={inputClass} value={form.storeName} onChange={(event) => set("storeName", event.target.value)} /></Field>
        <Field label="E-mail de contato" htmlFor="s-email"><input id="s-email" type="email" className={inputClass} value={form.contactEmail} onChange={(event) => set("contactEmail", event.target.value)} /></Field>
        <Field label="WhatsApp" htmlFor="s-whats" hint="Com DDI e DDD, por exemplo 5511999999999."><input id="s-whats" className={inputClass} inputMode="numeric" value={form.whatsapp} onChange={(event) => set("whatsapp", event.target.value)} /></Field>
        <Field label="Instagram" htmlFor="s-insta"><input id="s-insta" className={inputClass} value={form.instagram} onChange={(event) => set("instagram", event.target.value)} /></Field>
      </div>
      <Field label="Endereço da empresa" htmlFor="s-end"><textarea id="s-end" rows={2} className={inputClass} value={form.address} onChange={(event) => set("address", event.target.value)} /></Field>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
    </form>
  );
}

function ShippingForm({ initial }: { initial: Settings["shipping"] }) {
  const save = useMutation(api.settings.saveShipping);
  const [originCep, setOriginCep] = useState(formatCEP(initial.originCep));
  const [markup, setMarkup] = useState(centsToInput(initial.markupCents));
  const [enablePac, setEnablePac] = useState(initial.enablePac);
  const [enableSedex, setEnableSedex] = useState(initial.enableSedex);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const markupCents = parseBRL(markup);
    if (markupCents === null || markupCents < 0) return setMessage({ kind: "error", text: "Acréscimo inválido. Exemplo: 5,00" });
    setSaving(true);
    try {
      await save({ originCep, markupCents, enablePac, enableSedex });
      setMessage({ kind: "success", text: "Configurações de frete salvas." });
    } catch (e) {
      setMessage({ kind: "error", text: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Frete</h2>
      <p className="text-sm text-slate-600">
        Somente Correios PAC e SEDEX são exibidos aos clientes. O acréscimo é cobrado do cliente uma vez por pedido e não altera o custo real da etiqueta.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="CEP de origem" htmlFor="f-cep">
          <input id="f-cep" className={inputClass} inputMode="numeric" value={originCep} onChange={(event) => setOriginCep(formatCEP(event.target.value))} placeholder="00000-000" />
        </Field>
        <Field label="Acréscimo fixo no frete (R$)" htmlFor="f-acrescimo" hint="Valor inicial: 5,00.">
          <input id="f-acrescimo" className={inputClass} inputMode="decimal" value={markup} onChange={(event) => setMarkup(event.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Checkbox id="f-pac" checked={enablePac} onChange={setEnablePac}>Ativar PAC</Checkbox>
        <Checkbox id="f-sedex" checked={enableSedex} onChange={setEnableSedex}>Ativar SEDEX</Checkbox>
      </div>
      <p className="text-xs text-slate-500">A conexão com a conta Melhor Envio está no quadro abaixo.</p>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
    </form>
  );
}

function MelhorEnvioCard() {
  const status = useQuery(api.melhorEnvio.status);
  const start = useAction(api.melhorEnvio.startAuthorization);
  const [params] = useSearchParams();
  const result = params.get("melhorenvio");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === undefined) return null;
  const ready = status.credentialsConfigured && status.contactEmailConfigured;

  async function connect() {
    setError(null);
    setBusy(true);
    try {
      window.location.assign(await start());
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  const yesNo = (ok: boolean) => <Badge tone={ok ? "green" : "amber"}>{ok ? "Sim" : "Pendente"}</Badge>;

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Melhor Envio</h2>
        <Badge tone={status.environment === "production" ? "green" : "amber"}>
          {status.environment === "production" ? "Produção" : "Sandbox (testes)"}
        </Badge>
      </div>

      {result === "ok" && <Notice kind="success">Conta Melhor Envio conectada.</Notice>}
      {result === "erro" && <Notice kind="error">Não foi possível concluir a conexão. Tente novamente.</Notice>}
      {status.mock && <Notice kind="info">Modo de simulação ativo (SHIPPING_MOCK): os fretes exibidos são fictícios.</Notice>}

      <ul className="space-y-2 text-sm">
        <li className="flex justify-between"><span>Client ID e Secret nos segredos do Convex</span>{yesNo(status.credentialsConfigured)}</li>
        <li className="flex justify-between"><span>E-mail de contato da loja (exigido pela API)</span>{yesNo(status.contactEmailConfigured)}</li>
        <li className="flex justify-between"><span>Conta conectada</span>{yesNo(status.connected)}</li>
        {status.connected && status.tokenExpiresAt && (
          <li className="flex justify-between text-slate-600">
            <span>Token válido até</span>
            <span>{formatDate(status.tokenExpiresAt)} (renovado automaticamente)</span>
          </li>
        )}
      </ul>

      {status.redirectUri && (
        <div className="space-y-1">
          <p className="text-sm font-medium">URL de callback a cadastrar no aplicativo Melhor Envio</p>
          <code className="block break-all rounded bg-slate-100 p-2 text-xs">{status.redirectUri}</code>
        </div>
      )}

      {error && <Notice kind="error">{error}</Notice>}
      <Button onClick={() => void connect()} disabled={!ready || busy}>
        {busy ? "Redirecionando…" : status.connected ? "Reconectar ao Melhor Envio" : "Conectar ao Melhor Envio"}
      </Button>
      {!ready && <p className="text-xs text-slate-500">Conclua os itens pendentes acima antes de conectar. Guia: docs/SHIPPING_MELHOR_ENVIO.md.</p>}
    </section>
  );
}

export default function SettingsPage() {
  const settings = useQuery(api.settings.getAdminSettings);
  if (settings === undefined) return <p className="text-slate-500" role="status">Carregando…</p>;
  return (
    <div>
      <PageHeader title="Configurações" />
      <div className="space-y-8">
        <StoreForm initial={settings.store} />
        <ShippingForm initial={settings.shipping} />
        <MelhorEnvioCard />
      </div>
    </div>
  );
}
