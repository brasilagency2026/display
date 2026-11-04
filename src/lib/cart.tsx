import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { MAX_QUANTITY } from "../../shared/pricing";

// Le panier local ne contient que des identifiants et des quantités.
// Les prix sont toujours recalculés par le backend (catalog.priceCart).

export interface CartItem {
  productId: string;
  variantId?: string;
  designId?: string;
  quantity: number;
}

const STORAGE_KEY = "display.cart.v1";

function isValidItem(item: unknown): item is CartItem {
  if (typeof item !== "object" || item === null) return false;
  const candidate = item as Record<string, unknown>;
  return (
    typeof candidate.productId === "string" &&
    (candidate.variantId === undefined || typeof candidate.variantId === "string") &&
    (candidate.designId === undefined || typeof candidate.designId === "string") &&
    typeof candidate.quantity === "number" &&
    Number.isInteger(candidate.quantity) &&
    candidate.quantity >= 1 &&
    candidate.quantity <= MAX_QUANTITY
  );
}

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidItem) : [];
  } catch {
    return [];
  }
}

function sameLine(a: CartItem, b: CartItem): boolean {
  return a.productId === b.productId && a.variantId === b.variantId && a.designId === b.designId;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  add: (item: CartItem) => void;
  setQuantity: (item: CartItem, quantity: number) => void;
  remove: (item: CartItem) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // stockage indisponible : le panier reste en mémoire
    }
  }, [items]);

  const add = useCallback((item: CartItem) => {
    setItems((current) => {
      const existing = current.find((line) => sameLine(line, item));
      if (!existing) return [...current, { ...item, quantity: Math.min(item.quantity, MAX_QUANTITY) }];
      return current.map((line) =>
        sameLine(line, item) ? { ...line, quantity: Math.min(line.quantity + item.quantity, MAX_QUANTITY) } : line,
      );
    });
  }, []);

  const setQuantity = useCallback((item: CartItem, quantity: number) => {
    if (!Number.isInteger(quantity) || quantity < 1) return;
    const safe = Math.min(quantity, MAX_QUANTITY);
    setItems((current) => current.map((line) => (sameLine(line, item) ? { ...line, quantity: safe } : line)));
  }, []);

  const remove = useCallback((item: CartItem) => {
    setItems((current) => current.filter((line) => !sameLine(line, item)));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.reduce((sum, line) => sum + line.quantity, 0),
      add,
      setQuantity,
      remove,
      clear,
    }),
    [items, add, setQuantity, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart deve ser usado dentro de CartProvider.");
  return context;
}
