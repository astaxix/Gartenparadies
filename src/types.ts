export interface ProductVariationOption {
  name: string;
  priceDiff: number;
}

export interface ProductVariation {
  id: string;
  name: string;
  options: ProductVariationOption[];
}

export interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  shortDescription?: string;
  price: number;
  category: string;
  categories?: string[];
  imageUrl: string;
  stock: number;
  articleNumber: string; // EAN / SKU
  metaTitle: string;
  metaDescription: string;
  metaAdsText: string;
  metaKeywords?: string;
  weight?: number;
  deliveryStatus?: string;
  manufacturer?: string;
  minOrderQuantity?: number;
  taxClass?: string;
  isActive?: boolean;
  variations: ProductVariation[];
  volumePricing?: VolumePricing[];
  documents?: ProductDocument[];
  plannerType?: 'pe_pipe' | 'drip_tube' | 'sprinkler' | 'valve' | 'valve_box' | 'controller' | 'cable' | 'fitting' | 'assembled_box' | 'soft_pipe' | 'connector_25_16' | 'elbow_25_12' | 't_piece_25_12_25' | 'swing_joint' | 'sprinkler_body' | 'rzws' | 'pressure_reducer' | 'verbinder';
  plannerStations?: number;
  plannerWires?: number;
}

export interface ProductDocument {
  id: string;
  name: string;
  url: string;
}

export interface VolumePricing {
  quantity: number;
  price: number;
  discountPercentage?: number;
}

export interface CartItem extends Product {
  quantity: number;
  selectedVariations?: Record<string, string>; // variationId -> option name
  isPlannerPackage?: boolean;
  plannerData?: any;
}

export interface Order {
  id: string;
  customerName: string;
  date: string;
  total: number;
  status: 'Ausstehend' | 'In Bearbeitung' | 'Versendet' | 'Abgeschlossen';
  items: CartItem[];
}
