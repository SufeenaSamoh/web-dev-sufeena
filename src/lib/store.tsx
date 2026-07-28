/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing Supabase row mappers below
   read untyped `.select("*")` rows; typing every table row is a larger refactor outside the
   scope of this change. */
import { supabase } from "./supabase";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import type {
  Branch,
  Category,
  Item,
  Purchase,
  Settings,
  StockTransaction,
  Supplier,
  User,
} from "./types";

const SETTINGS_KEY = "hana-settings-v1";

const defaultSettings: Settings = {
  companyName: "Hana Inventory Stock",
  logoUrl: "",
  address: "1-2-3 Ginza, Chuo, Tokyo",
  phone: "",
  email: "",
  timezone: "Asia/Tokyo",
  currency: "THB",
  lowStockThreshold: 5,
  theme: "light",
};

interface AppData {
  items: Item[];
  categories: Category[];
  suppliers: Supplier[];
  users: User[];
  branches: Branch[];
  transactions: StockTransaction[];
  purchases: Purchase[];
  settings: Settings;
}

const defaultData: AppData = {
  items: [],
  categories: [],
  suppliers: [],
  users: [],
  branches: [],
  transactions: [],
  purchases: [],
  settings: defaultSettings,
};

interface StoreCtx extends AppData {
  loading: boolean;
  currentStock: (itemId: string) => number;
  addTransaction: (t: Omit<StockTransaction, "id">) => Promise<void>;
  updateTransaction: (id: string, patch: Partial<StockTransaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addItem: (i: Omit<Item, "id">) => Promise<void>;
  updateItem: (id: string, p: Partial<Item>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  addSupplier: (s: Omit<Supplier, "id">) => Promise<void>;
  updateSupplier: (id: string, p: Partial<Supplier>) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  addPurchase: (p: Omit<Purchase, "id">) => Promise<void>;
  addUser: (u: Omit<User, "id">) => Promise<void>;
  updateUser: (id: string, p: Partial<User>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  updateSettings: (p: Partial<Settings>) => Promise<void>;
  reset: () => Promise<void>;
}

const Ctx = createContext<StoreCtx | null>(null);

// ---------- row <-> model mappers ----------

const rowToItem = (r: any): Item =>
  ({
    id: r.id,
    code: r.code ?? "",
    name: r.name ?? "",
    categoryId: r.category_id ?? "",
    supplierId: r.supplier_id ?? undefined,
    unit: r.unit ?? "kg",
    minStock: Number(r.minimum_stock ?? 0),
    purchasePrice: Number(r.purchase_price ?? 0),
    barcode: r.barcode ?? "",
    description: r.description ?? "",
    active: r.active ?? true,
    hasExpiry: r.has_expiry ?? false,
    shelfLifeDays: r.shelf_life_days ?? undefined,
    expiryWarningDays: r.expiry_warning_days ?? undefined,
    // keep the raw current_stock alongside for currentStock()
    ...(r.current_stock !== undefined ? { currentStock: Number(r.current_stock) } : {}),
  }) as Item & { currentStock?: number };

const itemToRow = (i: Partial<Item>) => {
  const row: Record<string, unknown> = {};
  if (i.code !== undefined) row.code = i.code;
  if (i.name !== undefined) row.name = i.name;
  if (i.categoryId !== undefined) row.category_id = i.categoryId || null;
  if (i.supplierId !== undefined) row.supplier_id = i.supplierId || null;
  if (i.unit !== undefined) row.unit = i.unit;
  if (i.purchasePrice !== undefined) row.purchase_price = i.purchasePrice;
  if (i.minStock !== undefined) row.minimum_stock = i.minStock;
  if (i.active !== undefined) row.active = i.active;
  if (i.hasExpiry !== undefined) row.has_expiry = i.hasExpiry;
  if (i.shelfLifeDays !== undefined) row.shelf_life_days = i.shelfLifeDays || null;
  if (i.expiryWarningDays !== undefined) row.expiry_warning_days = i.expiryWarningDays || null;
  return row;
};

const rowToSupplier = (r: any): Supplier => ({
  id: r.id,
  code: r.code ?? "",
  name: r.name ?? "",
  contactPerson: r.contact_person ?? "",
  phone: r.phone ?? "",
  email: r.email ?? "",
  address: r.address ?? "",
  active: r.active ?? true,
  remark: r.remark ?? "",
});

const supplierToRow = (s: Partial<Supplier>) => {
  const row: Record<string, unknown> = {};
  if (s.code !== undefined) row.code = s.code;
  if (s.name !== undefined) row.name = s.name;
  if (s.contactPerson !== undefined) row.contact_person = s.contactPerson;
  if (s.phone !== undefined) row.phone = s.phone;
  if (s.email !== undefined) row.email = s.email;
  if (s.address !== undefined) row.address = s.address;
  if (s.active !== undefined) row.active = s.active;
  if (s.remark !== undefined) row.remark = s.remark;
  return row;
};

const rowToUser = (r: any): User => ({
  id: r.id,
  name: r.name ?? "",
  email: r.email ?? "",
  role: (r.role ?? "employee") as User["role"],
  branchId: r.branch_id ?? "",
  status: (r.status ?? "active") as User["status"],
});

const userToRow = (u: Partial<User>) => {
  const row: Record<string, unknown> = {};
  if (u.name !== undefined) row.name = u.name;
  if (u.email !== undefined) row.email = u.email;
  if (u.role !== undefined) row.role = u.role;
  if (u.branchId !== undefined) row.branch_id = u.branchId || null;
  if (u.status !== undefined) row.status = u.status;
  return row;
};

const rowToTxn = (r: any): StockTransaction => ({
  id: r.id,
  itemId: r.item_id,
  type: r.type,
  quantity: Number(r.quantity),
  unitPrice: r.unit_price !== null && r.unit_price !== undefined ? Number(r.unit_price) : undefined,
  date: r.date,
  supplierId: r.supplier_id ?? undefined,
  refId: r.ref_id ?? undefined,
  remark: r.remark ?? undefined,
  expiryDate: r.expiry_date ?? undefined,
  employee: r.employee ?? undefined,
});

const txnToRow = (t: Partial<StockTransaction>) => {
  const row: Record<string, unknown> = {};
  if (t.itemId !== undefined) row.item_id = t.itemId;
  if (t.type !== undefined) row.type = t.type;
  if (t.quantity !== undefined) row.quantity = t.quantity;
  if (t.unitPrice !== undefined) row.unit_price = t.unitPrice;
  if (t.date !== undefined) row.date = t.date;
  if (t.supplierId !== undefined) row.supplier_id = t.supplierId || null;
  if (t.refId !== undefined) row.ref_id = t.refId || null;
  if (t.remark !== undefined) row.remark = t.remark;
  if (t.expiryDate !== undefined) row.expiry_date = t.expiryDate;
  if (t.employee !== undefined) row.employee = t.employee;
  return row;
};

// ---------- provider ----------

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => {
    let settings = defaultSettings;
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(SETTINGS_KEY) : null;
      if (raw) settings = { ...defaultSettings, ...JSON.parse(raw) };
    } catch {
      // Ignore malformed cached settings and fall back to defaults.
    }
    return { ...defaultData, settings };
  });
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [items, categories, suppliers, branches, users, txns, purchases, purchaseItems] =
      await Promise.all([
        supabase.from("items").select("*").order("code"),
        supabase.from("categories").select("*").order("name"),
        supabase.from("suppliers").select("*").order("name"),
        supabase.from("branches").select("*").order("name"),
        supabase.from("users").select("*").order("name"),
        supabase.from("transactions").select("*").order("date", { ascending: false }),
        supabase.from("purchases").select("*").order("purchase_date", { ascending: false }),
        supabase.from("purchase_items").select("*"),
      ]);

    const err = [
      items,
      categories,
      suppliers,
      branches,
      users,
      txns,
      purchases,
      purchaseItems,
    ].find((r) => r.error);
    if (err?.error) {
      console.error("Load error:", err.error);
    }

    const purchasesById = new Map<string, any[]>();
    (purchaseItems.data ?? []).forEach((pi: any) => {
      const list = purchasesById.get(pi.purchase_id) ?? [];
      list.push({
        itemId: pi.item_id,
        quantity: Number(pi.quantity),
        unitPrice: Number(pi.unit_price ?? 0),
        expiryDate: pi.expiry_date ?? undefined,
        remark: pi.remark ?? undefined,
      });
      purchasesById.set(pi.purchase_id, list);
    });

    setData((d) => ({
      ...d,
      items: (items.data ?? []).map(rowToItem),
      categories: (categories.data ?? []).map((r: any) => ({ id: r.id, name: r.name })),
      suppliers: (suppliers.data ?? []).map(rowToSupplier),
      branches: (branches.data ?? []).map((r: any) => ({ id: r.id, name: r.name })),
      users: (users.data ?? []).map(rowToUser),
      transactions: (txns.data ?? []).map(rowToTxn),
      purchases: (purchases.data ?? []).map((r: any) => ({
        id: r.id,
        supplierId: r.supplier_id ?? "",
        purchaseDate: r.purchase_date,
        invoiceNumber: r.invoice_number ?? "",
        employee: r.employee ?? "",
        remark: r.remark ?? "",
        total: Number(r.total ?? 0),
        branchId: r.branch_id ?? "",
        items: purchasesById.get(r.id) ?? [],
      })),
    }));

    // Load company branding settings from Supabase (falls back silently)
    try {
      const { data: cs } = await supabase
        .from("company_settings")
        .select("*")
        .eq("id", "singleton")
        .maybeSingle();
      if (cs) {
        setData((d) => ({
          ...d,
          settings: {
            ...d.settings,
            companyName: cs.company_name ?? d.settings.companyName,
            logoUrl: cs.logo_url ?? d.settings.logoUrl,
            address: cs.address ?? d.settings.address,
            phone: cs.phone ?? d.settings.phone,
            email: cs.email ?? d.settings.email,
          },
        }));
      }
    } catch (e) {
      console.warn("company_settings not available", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Persist settings locally + theme
  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.settings));
    } catch {
      // Ignore write failures (e.g. private browsing / storage quota).
    }
    if (typeof document !== "undefined") {
      if (data.settings.theme === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    }
  }, [data.settings]);

  const currentStock = useCallback(
    (itemId: string) => {
      const it = data.items.find((x) => x.id === itemId) as
        (Item & { currentStock?: number }) | undefined;
      return it?.currentStock ?? 0;
    },
    [data.items],
  );

  const bumpItemStock = useCallback(
    (itemId: string, delta: number) =>
      setData((d) => ({
        ...d,
        items: d.items.map((it) =>
          it.id === itemId
            ? ({ ...it, currentStock: ((it as any).currentStock ?? 0) + delta } as Item)
            : it,
        ),
      })),
    [],
  );

  const persistStock = async (itemId: string, delta: number) => {
    // Read current, then update (no atomic RPC available client-side).
    const { data: row } = await supabase
      .from("items")
      .select("current_stock")
      .eq("id", itemId)
      .maybeSingle();
    const next = Number(row?.current_stock ?? 0) + delta;
    await supabase.from("items").update({ current_stock: next }).eq("id", itemId);
  };

  const api = useMemo<StoreCtx>(
    () => ({
      ...data,
      loading,
      currentStock,

      addTransaction: async (t) => {
        const { data: row, error } = await supabase
          .from("transactions")
          .insert(txnToRow(t))
          .select()
          .single();
        if (error || !row) {
          console.error(error);
          toast.error("Failed to save transaction");
          return;
        }
        setData((d) => ({ ...d, transactions: [rowToTxn(row), ...d.transactions] }));
        await persistStock(t.itemId, t.quantity);
        bumpItemStock(t.itemId, t.quantity);
      },
      updateTransaction: async (id, patch) => {
        const prev = data.transactions.find((x) => x.id === id);
        const { error } = await supabase.from("transactions").update(txnToRow(patch)).eq("id", id);
        if (error) {
          console.error(error);
          toast.error("Failed to update transaction");
          return;
        }
        setData((d) => ({
          ...d,
          transactions: d.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        }));
        if (prev && patch.quantity !== undefined && patch.quantity !== prev.quantity) {
          const delta = patch.quantity - prev.quantity;
          await persistStock(prev.itemId, delta);
          bumpItemStock(prev.itemId, delta);
        }
      },
      deleteTransaction: async (id) => {
        const prev = data.transactions.find((x) => x.id === id);
        const { error } = await supabase.from("transactions").delete().eq("id", id);
        if (error) {
          console.error(error);
          toast.error("Failed to delete transaction");
          return;
        }
        setData((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== id) }));
        if (prev) {
          await persistStock(prev.itemId, -prev.quantity);
          bumpItemStock(prev.itemId, -prev.quantity);
        }
      },

      addItem: async (i) => {
        const { data: row, error } = await supabase
          .from("items")
          .insert({ ...itemToRow(i), current_stock: 0 })
          .select()
          .single();
        if (error || !row) {
          console.error(error);
          toast.error(error?.message || "Failed to add item");
          return;
        }
        setData((d) => ({ ...d, items: [...d.items, rowToItem(row)] }));
      },
      updateItem: async (id, p) => {
        const { error } = await supabase.from("items").update(itemToRow(p)).eq("id", id);
        if (error) {
          console.error(error);
          toast.error(error.message || "Failed to update item");
          return;
        }
        setData((d) => ({
          ...d,
          items: d.items.map((x) => (x.id === id ? { ...x, ...p } : x)),
        }));
      },
      deleteItem: async (id) => {
        const { error } = await supabase.from("items").delete().eq("id", id);
        if (error) {
          console.error(error);
          toast.error(error.message || "Failed to delete item");
          return;
        }
        setData((d) => ({ ...d, items: d.items.filter((x) => x.id !== id) }));
      },

      addSupplier: async (s) => {
        const { data: row, error } = await supabase
          .from("suppliers")
          .insert(supplierToRow(s))
          .select()
          .single();
        if (error || !row) {
          console.error(error);
          toast.error(error?.message || "Failed to add supplier");
          return;
        }
        setData((d) => ({ ...d, suppliers: [...d.suppliers, rowToSupplier(row)] }));
      },
      updateSupplier: async (id, p) => {
        const { error } = await supabase.from("suppliers").update(supplierToRow(p)).eq("id", id);
        if (error) {
          console.error(error);
          toast.error(error.message || "Failed to update supplier");
          return;
        }
        setData((d) => ({
          ...d,
          suppliers: d.suppliers.map((x) => (x.id === id ? { ...x, ...p } : x)),
        }));
      },
      deleteSupplier: async (id) => {
        const { error } = await supabase.from("suppliers").delete().eq("id", id);
        if (error) {
          console.error(error);
          toast.error(error.message || "Failed to delete supplier");
          return;
        }
        setData((d) => ({ ...d, suppliers: d.suppliers.filter((x) => x.id !== id) }));
      },

      addPurchase: async (p) => {
        const { data: pRow, error } = await supabase
          .from("purchases")
          .insert({
            supplier_id: p.supplierId || null,
            purchase_date: p.purchaseDate,
            invoice_number: p.invoiceNumber,
            employee: p.employee,
            remark: p.remark,
            total: p.total,
            branch_id: p.branchId || null,
          })
          .select()
          .single();
        if (error || !pRow) {
          console.error(error);
          toast.error(error?.message || "Failed to save purchase");
          return;
        }

        const lineRows = p.items.map((it) => ({
          purchase_id: pRow.id,
          item_id: it.itemId,
          quantity: it.quantity,
          unit_price: it.unitPrice,
          expiry_date: it.expiryDate,
          remark: it.remark,
        }));
        if (lineRows.length) {
          const { error: lineErr } = await supabase.from("purchase_items").insert(lineRows);
          if (lineErr) console.error(lineErr);
        }

        const txnRows = p.items.map((it) => ({
          item_id: it.itemId,
          type: "purchase" as const,
          quantity: it.quantity,
          unit_price: it.unitPrice,
          date: p.purchaseDate,
          supplier_id: p.supplierId || null,
          ref_id: pRow.id,
          expiry_date: it.expiryDate,
          employee: p.employee,
          remark: it.remark,
        }));
        const { data: newTxns } = await supabase.from("transactions").insert(txnRows).select();

        // Update stock per item
        await Promise.all(p.items.map((it) => persistStock(it.itemId, it.quantity)));

        setData((d) => ({
          ...d,
          purchases: [{ ...p, id: pRow.id }, ...d.purchases],
          transactions: [...(newTxns ?? []).map(rowToTxn), ...d.transactions],
          items: d.items.map((it) => {
            const line = p.items.find((l) => l.itemId === it.id);
            if (!line) return it;
            return { ...it, currentStock: ((it as any).currentStock ?? 0) + line.quantity } as Item;
          }),
        }));
      },

      addUser: async (u) => {
        const { data: row, error } = await supabase
          .from("users")
          .insert(userToRow(u))
          .select()
          .single();
        if (error || !row) {
          console.error(error);
          toast.error(error?.message || "Failed to add user");
          return;
        }
        setData((d) => ({ ...d, users: [...d.users, rowToUser(row)] }));
      },
      updateUser: async (id, p) => {
        const { error } = await supabase.from("users").update(userToRow(p)).eq("id", id);
        if (error) {
          console.error(error);
          toast.error(error.message || "Failed to update user");
          return;
        }
        setData((d) => ({
          ...d,
          users: d.users.map((x) => (x.id === id ? { ...x, ...p } : x)),
        }));
      },
      deleteUser: async (id) => {
        const { error } = await supabase.from("users").delete().eq("id", id);
        if (error) {
          console.error(error);
          toast.error(error.message || "Failed to delete user");
          return;
        }
        setData((d) => ({ ...d, users: d.users.filter((x) => x.id !== id) }));
      },

      updateSettings: async (p) => {
        setData((d) => ({ ...d, settings: { ...d.settings, ...p } }));
        // Only persist branding fields to Supabase
        const brandingKeys = ["companyName", "logoUrl", "address", "phone", "email"] as const;
        const touchesBranding = brandingKeys.some((k) => k in p);
        if (!touchesBranding) return;
        const next = { ...data.settings, ...p };
        try {
          await supabase.from("company_settings").upsert({
            id: "singleton",
            company_name: next.companyName,
            logo_url: next.logoUrl,
            address: next.address,
            phone: next.phone,
            email: next.email,
            updated_at: new Date().toISOString(),
          });
        } catch (e) {
          console.warn("Failed to persist branding", e);
        }
      },
      reset: async () => {
        await loadAll();
      },
    }),
    [data, loading, currentStock, bumpItemStock, loadAll],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore must be used within StoreProvider");
  return c;
}

export function formatCurrency(n: number, _currency?: string) {
  // Currency is fixed to Thai Baht across the entire application.
  void _currency;
  const value = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `฿${value.toFixed(2)}`;
  }
}
