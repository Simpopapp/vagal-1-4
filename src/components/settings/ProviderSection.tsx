import { useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_PROVIDER_CONFIG, PROVIDERS, getProviderDef, type ProviderConfig, type ProviderId } from "@/lib/ai/providers";
import { listModels, testConnection, ProviderError } from "@/lib/ai/client";
import { getProviderConfig, getProviderKey, setProviderConfig, setProviderKey } from "@/lib/db/repo";

function errorMessage(error: unknown): string {
  if (error instanceof ProviderError) {
    switch (error.kind) {
      case "auth": return "chave inválida ou sem permissão";
      case "credits": return "sem saldo nesse provedor";
      case "cors": return "sem conexão, ou o provedor não aceita chamadas diretas do navegador";
      case "network": return "não foi possível conectar";
      default: return error.message;
    }
  }
  return "não foi possível conectar";
}

export function ProviderSection() {
  const id = useId();
  const [config, setConfig] = useState<ProviderConfig>(DEFAULT_PROVIDER_CONFIG);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [manual, setManual] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [listError, setListError] = useState("");
  const [connection, setConnection] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<"models" | "test" | null>(null);
  const revision = useRef(0);
  const def = getProviderDef(config.provider);
  const urlVisible = config.provider === "custom" || config.provider === "ollama";
  const keyVisible = def.needsKey || config.provider === "custom";
  const url = config.baseUrl ?? def.baseUrl;
  const urlError = urlVisible && !/^https?:\/\/.+/.test(url.trim())
    ? "a URL base precisa começar com http:// ou https://" : "";
  const disabled = !ready || saving;

  useEffect(() => {
    let alive = true;
    void Promise.all([getProviderConfig(), getProviderKey()]).then(([saved, secret]) => {
      if (!alive) return;
      setConfig(saved);
      setKey(secret);
      setReady(true);
    }).catch(() => { if (alive) toast.error("Não foi possível abrir os ajustes do provedor"); });
    return () => { alive = false; revision.current++; };
  }, []);

  function invalidate() {
    revision.current++;
    setBusy(null);
    setConnection(null);
    setListError("");
    setModels([]);
    setModelOpen(false);
  }

  async function persist(next: ProviderConfig) {
    setSaving(true);
    try {
      await setProviderConfig(next);
      toast.success("Provedor atualizado");
    } catch {
      toast.error("Não foi possível salvar o provedor. Tente novamente.");
    } finally { setSaving(false); }
  }

  function chooseProvider(provider: ProviderId) {
    invalidate();
    setManual(false);
    setKeyDraft("");
    setShowKey(false);
    const next: ProviderConfig = provider === "ollama"
      ? { provider, baseUrl: getProviderDef(provider).baseUrl }
      : { provider };
    setConfig(next);
    // Custom requires a URL: keep the incomplete selection local until valid.
    if (provider !== "custom") void persist(next);
  }

  async function saveKey(remove = false) {
    if (!remove && !keyDraft.trim()) return;
    setSaving(true);
    try {
      const next = remove ? "" : keyDraft.trim();
      await setProviderKey(next);
      setKey(next);
      setKeyDraft("");
      setShowKey(false);
      invalidate();
      toast.success(remove ? "Chave removida deste aparelho" : "Chave salva neste aparelho");
    } catch { toast.error("Não foi possível salvar a chave"); }
    finally { setSaving(false); }
  }

  async function run(action: "models" | "test") {
    if (urlError || disabled || busy) return;
    const token = ++revision.current;
    setBusy(action);
    setConnection(null);
    setListError("");
    try {
      const secret = keyDraft.trim() || key;
      if (action === "models") {
        const result = await listModels(config, secret);
        if (token !== revision.current) return;
        if (!result.length) throw new Error("Nenhum modelo retornado");
        setModels(result);
        setManual(false);
        setModelOpen(true);
      } else {
        const result = await testConnection(config, secret);
        if (token !== revision.current) return;
        setConnection({ ok: true, text: `conectado · ${result.models} modelos disponíveis` });
      }
    } catch (error) {
      if (token !== revision.current) return;
      if (action === "models") {
        setListError(error instanceof Error && error.message === "Nenhum modelo retornado"
          ? "O provedor não retornou modelos." : errorMessage(error));
        setModels(def.fallbackModels);
        setManual(true);
      } else setConnection({ ok: false, text: errorMessage(error) });
    } finally { if (token === revision.current) setBusy(null); }
  }

  function saveModel(model: string) {
    const next = { ...config, model: model.trim() };
    setConfig(next);
    if (!urlError) void persist(next);
  }

  const options = [...new Set([...(config.model ? [config.model] : []), ...models])];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Provedor de IA</CardTitle>
        <CardDescription>Use o padrão ou conecte seu próprio provedor para criar os cards.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4" aria-busy={!ready}>
        <div className="space-y-2">
          <Label htmlFor={`${id}-provider`}>Provedor</Label>
          <Select value={config.provider} disabled={disabled} onValueChange={(value) => chooseProvider(value as ProviderId)}>
            <SelectTrigger id={`${id}-provider`}><SelectValue /></SelectTrigger>
            <SelectContent>{PROVIDERS.map((provider) => (
              <SelectItem key={provider.id} value={provider.id}>
                <span className="inline-flex items-center gap-2">{provider.name}{provider.freeTier && <Badge variant="secondary">grátis</Badge>}</span>
              </SelectItem>
            ))}</SelectContent>
          </Select>
        </div>
        {urlVisible && <div className="space-y-2">
          <Label htmlFor={`${id}-url`}>URL base{config.provider === "custom" ? " (obrigatória)" : ""}</Label>
          <Input id={`${id}-url`} type="url" value={url} disabled={disabled} aria-invalid={!!urlError} aria-describedby={urlError ? `${id}-url-error` : undefined}
            placeholder="https://seu-provedor.com/v1" onChange={(event) => {
              invalidate(); setConfig({ ...config, baseUrl: event.target.value });
            }} onBlur={() => { if (!urlError) void persist({ ...config, baseUrl: url.trim() }); }} />
          {urlError && <p id={`${id}-url-error`} className="text-sm text-destructive" role="alert">{urlError}</p>}
        </div>}
        {keyVisible && <div className="space-y-2">
          <Label htmlFor={`${id}-key`}>Chave de API</Label>
          <div className="flex gap-2">
            <Input id={`${id}-key`} type={showKey ? "text" : "password"} autoComplete="off" spellCheck={false} disabled={disabled}
              value={keyDraft} placeholder={key ? "••••••••" : "Cole sua chave"} aria-describedby={`${id}-key-note`}
              onChange={(event) => { invalidate(); setKeyDraft(event.target.value); }} />
            <Button type="button" variant="outline" size="icon" disabled={disabled} aria-label={showKey ? "Ocultar chave" : "Mostrar chave"} onClick={() => setShowKey(!showKey)}>
              {showKey ? <EyeOff /> : <Eye />}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" disabled={disabled || !keyDraft.trim()} onClick={() => void saveKey()}>Salvar chave</Button>
            {key && <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => void saveKey(true)}>Remover chave</Button>}
            {def.keyUrl && <a className="text-sm text-primary underline" href={def.keyUrl} target="_blank" rel="noopener noreferrer">onde conseguir a chave</a>}
          </div>
          <p id={`${id}-key-note`} className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4" aria-hidden="true" />a chave fica só neste aparelho</p>
          {!key && <p className="text-sm text-muted-foreground">falta a chave neste aparelho</p>}
        </div>}
        {config.provider !== "lovable" && <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={disabled || !!urlError || !!busy} onClick={() => void run("models")}>
              {busy === "models" && <Loader2 className="animate-spin" aria-hidden="true" />}Carregar modelos
            </Button>
            <Button type="button" variant="outline" disabled={disabled || !!urlError || !!busy} onClick={() => void run("test")}>
              {busy === "test" && <Loader2 className="animate-spin" aria-hidden="true" />}Testar conexão
            </Button>
          </div>
          {listError && <p className="text-sm text-destructive" role="alert">{listError} Use um modelo sugerido ou digite o nome manualmente.</p>}
          {options.length > 0 && <div className="space-y-2">
            <Label htmlFor={`${id}-model`}>Modelo</Label>
            <Select value={config.model ?? ""} open={modelOpen} onOpenChange={setModelOpen} disabled={disabled || !!urlError} onValueChange={saveModel}>
              <SelectTrigger id={`${id}-model`}><SelectValue placeholder="Selecione um modelo" /></SelectTrigger>
              <SelectContent>{options.map((model) => <SelectItem key={model} value={model}>{model}</SelectItem>)}</SelectContent>
            </Select>
          </div>}
          <Button type="button" variant="link" size="sm" onClick={() => setManual(!manual)}>{manual ? "Ocultar campo manual" : "Digitar modelo manualmente"}</Button>
          {manual && <div className="space-y-2">
            <Label htmlFor={`${id}-manual`}>Nome do modelo</Label>
            <Input id={`${id}-manual`} value={config.model ?? ""} disabled={disabled} placeholder="Nome exato do modelo" onChange={(event) => setConfig({ ...config, model: event.target.value })} onBlur={() => saveModel(config.model ?? "")} />
          </div>}
          {connection && <p role="status" className={`flex items-center gap-2 text-sm ${connection.ok ? "text-primary" : "text-destructive"}`}>
            {connection.ok && <CheckCircle2 className="size-4" aria-hidden="true" />}{connection.text}
          </p>}
        </div>}
        {config.provider === "lovable" && <p className="text-sm text-muted-foreground">O padrão usa a Lovable Cloud, sem chave própria. Sua chave local guardada é preservada.</p>}
      </CardContent>
    </Card>
  );
}
