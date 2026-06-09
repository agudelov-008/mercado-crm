/** Llave opcional para un proveedor financiero con API key. */
export const FINANCIAL_API_KEY = "";

/**
 * Alias simple para mantener compatibilidad si otra parte de la app
 * vuelve a consumir el módulo del ticker.
 */
export interface MarketTickerItem {
  symbol: string;
  value: string;
  change: string;
  up: boolean;
}
