import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createListing } from "@/lib/server/homezee";
import { STOCK_PHOTOS } from "@/lib/stock-photos";
import { cn } from "@/lib/utils";
import type { PropertyType } from "@/lib/types";

export const Route = createFileRoute("/_app/sell/new")({ component: NewListing });

function NewListing() {
  const nav = useNavigate();
  const [photos, setPhotos] = useState<string[]>([]);
  const [form, setForm] = useState({
    title: "",
    address: "",
    city: "",
    neighborhood: "",
    state: "Portugal",
    price: 250000,
    bedrooms: 3,
    bathrooms: 2,
    sqft: 180,
    yearBuilt: 2005,
    propertyType: "house" as PropertyType,
    style: "modern",
    description: "",
  });
  const save = useMutation({
    mutationFn: () =>
      createListing({
        data: {
          ...form,
          lotSqft: null,
          yearBuilt: form.yearBuilt,
          photos,
        },
      }),
    onSuccess: (res) => {
      toast.success("Listing is live");
      void nav({ to: "/sell/$id", params: { id: String(res.listingId) } });
    },
    onError: (e) => toast.error(e.message),
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <form
      className="space-y-4 overflow-y-auto px-4 py-4 pb-10"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <h1 className="font-display text-2xl tracking-tight">Novo anúncio</h1>
      <div className="space-y-1.5">
        <Label>Fotografias</Label>
        <Input type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="Carregar fotografias" onChange={async e=>{
          const files = Array.from(e.target.files || []).slice(0,8);
          if(files.some(f=>f.size>3*1024*1024)){toast.error("Cada fotografia pode ter até 3 MB.");return;}
          const values = await Promise.all(files.map(file=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Não foi possível ler a fotografia"));reader.readAsDataURL(file);} )));
          setPhotos(values);
        }}/>
        <p className="text-xs text-muted">Até 8 fotografias JPEG, PNG ou WebP, com 3 MB cada.</p>
        <div className="grid grid-cols-4 gap-2">{photos.map((src,i)=><img key={i} src={src} alt={`Fotografia ${i+1}`} className="aspect-square rounded-xl object-cover"/>)}</div>
      </div>
      <Field label="Título">
        <Input required value={form.title} onChange={(e) => set("title", e.target.value)} />
      </Field>
      <Field label="Morada">
        <Input required value={form.address} onChange={(e) => set("address", e.target.value)} />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Cidade">
          <Input required value={form.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="País">
          <Input required value={form.state} onChange={(e) => set("state", e.target.value)} />
        </Field>
        <Field label="Freguesia">
          <Input value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Preço">
          <Input type="number" required value={form.price} onChange={(e) => set("price", Number(e.target.value))} />
        </Field>
        <Field label="Área (m²)">
          <Input type="number" required value={form.sqft} onChange={(e) => set("sqft", Number(e.target.value))} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Quartos">
          <Input type="number" value={form.bedrooms} onChange={(e) => set("bedrooms", Number(e.target.value))} />
        </Field>
        <Field label="Casas de banho">
          <Input type="number" step="0.5" value={form.bathrooms} onChange={(e) => set("bathrooms", Number(e.target.value))} />
        </Field>
        <Field label="Ano">
          <Input type="number" value={form.yearBuilt} onChange={(e) => set("yearBuilt", Number(e.target.value))} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Type">
          <select
            className="h-11 w-full rounded-xl border border-border bg-elevated px-3 text-sm"
            value={form.propertyType}
            onChange={(e) => set("propertyType", e.target.value as PropertyType)}
          >
            <option value="house">House</option>
            <option value="condo">Condo</option>
            <option value="townhouse">Townhouse</option>
            <option value="apartment">Apartment</option>
          </select>
        </Field>
        <Field label="Style">
          <Input value={form.style} onChange={(e) => set("style", e.target.value)} />
        </Field>
      </div>
      <Field label="Descrição">
        <Textarea required value={form.description} onChange={(e) => set("description", e.target.value)} />
      </Field>
      <Button type="submit" className="w-full" disabled={save.isPending}>
        Publish listing
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
