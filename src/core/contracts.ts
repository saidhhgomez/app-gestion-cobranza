export type Row = Record<string, string | number | null>;
export type Mode = 'MEDIDOR' | 'FIJO' | 'PRORRATEO' | 'NO_APLICA';
export type Criterion = 'EQUITATIVO' | 'POR_HABITANTES';
export interface Property {
  id: string;
  name: string;
  address: string;
  district: string;
  province: string;
  region: string;
  kind: string;
  description: string;
  active: number;
}
export interface Unit {
  id: string;
  property_id: string;
  code: string;
  name: string;
  floor: string;
  kind: string;
  description: string;
  notes: string;
  active: number;
  occupancy_type?: string | null;
  person_name?: string | null;
}
export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  document_type: string;
  document_number: string;
  phone: string;
  email: string;
  notes: string;
  active: number;
}
export interface Occupancy {
  id: string;
  unit_id: string;
  person_id: string;
  kind: 'INQUILINO' | 'PROPIETARIO';
  start_date: string;
  end_date: string | null;
  inhabitants: number;
  rent_cents: number;
  due_day: number;
  notes: string;
  unit_code?: string;
  person_name?: string;
  property_id?: string;
}
export interface Service {
  id: string;
  property_id: string;
  name: string;
  unit: string;
  supports_meter: number;
  uses_receipt: number;
  allows_independent: number;
  criterion: Criterion;
  active: number;
}
export interface ServiceConfig {
  id: string;
  occupancy_id: string;
  service_id: string;
  mode: Mode;
  fixed_cents: number;
  independent: number;
  effective_from: string;
  effective_to: string | null;
}
export interface Meter {
  id: string;
  unit_id: string;
  service_id: string;
  serial: string;
  installed_on: string;
  initial_reading: number;
  active: number;
  notes: string;
}
export interface Participant {
  id: string;
  occupancy_id: string;
  unit_id: string;
  person_id: string;
  unit_code: string;
  person_name: string;
  kind: 'INQUILINO' | 'PROPIETARIO';
  mode: Mode;
  inhabitants: number;
  fixed_cents: number;
  previous_reading: number | null;
  current_reading: number | null;
  meter_id: string | null;
  excluded_reason: string | null;
  partial_period: boolean;
}
export interface Allocation {
  participant_id: string;
  occupancy_id: string;
  unit_code: string;
  person_name: string;
  kind: string;
  amount_cents: number;
  consumption: number;
}
export interface Distribution {
  allocations: Allocation[];
  meter_cents: number;
  fixed_cents: number;
  shared_cents: number;
  owner_cents: number;
  tenant_cents: number;
  owner_remainder_cents: number;
  total_cents: number;
  warnings: string[];
  algorithm_version: string;
}
export interface Receipt {
  id: string;
  property_id: string;
  service_id: string;
  period: string;
  provider: string;
  supply_number: string;
  receipt_number: string;
  total_cents: number;
  total_consumption: number | null;
  issued_on: string;
  due_on: string;
  consumption_start: string | null;
  consumption_end: string | null;
  notes: string;
  status: string;
  criterion: Criterion;
  confirmed_at: string | null;
  service_name?: string;
}
export interface Charge {
  id: string;
  property_id: string;
  occupancy_id: string;
  person_id: string;
  period: string;
  concept: string;
  amount_cents: number;
  paid_cents: number;
  balance_cents: number;
  due_on: string;
  status: string;
  unit_code: string;
  person_name: string;
  receipt_id: string | null;
}
export interface Payment {
  id: string;
  property_id: string;
  occupancy_id: string;
  person_id: string;
  paid_on: string;
  amount_cents: number;
  method: string;
  operation_number: string;
  notes: string;
  reversed: number;
  person_name?: string;
  unit_code?: string;
}
export interface Attachment {
  id: string;
  receipt_id: string;
  relative_path: string;
  name: string;
  mime_type: string;
  size: number;
  meter_id?: string | null;
}
export interface PaymentAttachment extends Omit<Attachment, 'receipt_id'> {
  payment_id: string;
}
export interface MonthlyItem {
  key: string;
  occupancy_id: string;
  person_id: string;
  unit_code: string;
  person_name: string;
  concept: string;
  amount_cents: number;
  due_on: string;
  partial_period: boolean;
  kind?: 'INQUILINO' | 'PROPIETARIO';
}
export interface Dashboard {
  charged_cents: number;
  collected_cents: number;
  pending_cents: number;
  overdue_cents: number;
  supplier_cents: number;
  owner_cents: number;
  occupied_units: number;
  available_units: number;
  pending_receipts: number;
  upcoming: Charge[];
}
export interface ReceiptInput extends Omit<
  Receipt,
  'id' | 'status' | 'criterion' | 'confirmed_at' | 'service_name'
> {
  id?: string;
}
export interface PaymentInput {
  id: string;
  property_id: string;
  occupancy_id: string;
  person_id: string;
  paid_on: string;
  amount_cents: number;
  method: string;
  operation_number: string;
  notes: string;
  allocations: { charge_id: string; amount_cents: number }[];
}
export interface Repository {
  properties(): Promise<Property[]>;
  saveProperty(value: Omit<Property, 'id'> & { id?: string }): Promise<string>;
  archiveProperty(id: string, active: boolean): Promise<void>;
  units(propertyId: string): Promise<Unit[]>;
  saveUnit(
    value: Omit<Unit, 'id' | 'occupancy_type' | 'person_name'> & { id?: string },
  ): Promise<string>;
  people(search?: string): Promise<Person[]>;
  savePerson(value: Omit<Person, 'id'> & { id?: string }): Promise<string>;
  occupancies(propertyId?: string, personId?: string): Promise<Occupancy[]>;
  saveOccupancy(
    value: Omit<Occupancy, 'id' | 'unit_code' | 'person_name' | 'property_id'> & { id?: string },
  ): Promise<string>;
  endOccupancy(id: string, endDate: string): Promise<void>;
  changeTerms(
    id: string,
    effectiveFrom: string,
    rentCents: number,
    inhabitants: number,
    dueDay: number,
  ): Promise<void>;
  residents(occupancyId: string): Promise<Person[]>;
  addResident(occupancyId: string, personId: string): Promise<void>;
  services(propertyId: string): Promise<Service[]>;
  saveService(value: Omit<Service, 'id'> & { id?: string }): Promise<string>;
  configs(occupancyId: string): Promise<ServiceConfig[]>;
  saveConfig(value: Omit<ServiceConfig, 'id'>): Promise<string>;
  meters(propertyId: string): Promise<Meter[]>;
  saveMeter(value: Omit<Meter, 'id'> & { id?: string }): Promise<string>;
  participants(serviceId: string, period: string): Promise<Participant[]>;
  receipts(propertyId?: string, period?: string): Promise<Receipt[]>;
  receipt(id: string): Promise<Receipt | null>;
  saveReceipt(value: ReceiptInput): Promise<string>;
  receiptParticipants(id: string): Promise<Participant[]>;
  saveParticipants(id: string, participants: Participant[]): Promise<void>;
  previewReceipt(id: string, assumeOwnerRemainder: boolean): Promise<Distribution>;
  finalizeReceipt(id: string, assumeOwnerRemainder: boolean): Promise<void>;
  cancelReceipt(id: string, reason: string): Promise<void>;
  monthlyPreview(propertyId: string, period: string): Promise<MonthlyItem[]>;
  generateMonthly(propertyId: string, period: string, items: MonthlyItem[]): Promise<void>;
  charges(propertyId?: string, period?: string, personId?: string): Promise<Charge[]>;
  payments(propertyId?: string, personId?: string): Promise<Payment[]>;
  paymentDetails(paymentId: string): Promise<Row[]>;
  recordPayment(value: PaymentInput): Promise<void>;
  reversePayment(id: string, reason: string): Promise<void>;
  dashboard(propertyId: string | undefined, period: string): Promise<Dashboard>;
  setting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  attachments(receiptId: string): Promise<Attachment[]>;
  addAttachment(value: Attachment): Promise<void>;
  deleteAttachment(id: string): Promise<void>;
  paymentAttachments(paymentId: string): Promise<PaymentAttachment[]>;
  addPaymentAttachment(value: PaymentAttachment): Promise<void>;
  report(kind: string, propertyId?: string, period?: string, personId?: string): Promise<Row[]>;
}
