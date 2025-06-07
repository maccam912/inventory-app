export interface Site {
  id?: number;
  name: string;
  location?: string;
  is_active: boolean;
}

export interface Reagent {
  id?: number;
  name: string;
  description?: string;
}

export interface Lot {
  id?: number;
  lot_number: string;
  reagent_id: number;
  expiration_date: string;
}

export interface InventoryRecord {
  id?: number;
  lot_id: number;
  site_id: number;
  quantity_on_hand: number;
  recorded_date: string;
  recorded_by: string;
}

export interface Shipment {
  id?: number;
  lot_id: number;
  site_id: number;
  quantity: number;
  shipped_date: string;
  received_date?: string;
}

export interface Transfer {
  id?: number;
  lot_id: number;
  from_site_id: number;
  to_site_id: number;
  quantity: number;
  transfer_date: string;
}