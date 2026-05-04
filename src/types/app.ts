// Tipos manuales de app (no derivados del schema de DB).
// Agregar aquí unions, helpers de DTO, etc.

export type Role = 'owner' | 'admin' | 'professional' | 'receptionist';
export type TaxCondition = 'monotributo' | 'responsable_inscripto' | 'exento';
export type AfipProvider = 'tusfacturas' | 'direct' | 'manual';
export type InviteRole = Exclude<Role, 'owner'>;
export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';
export type AppointmentSource = 'panel' | 'public' | 'waitlist';

export type WhatsappStatus = 'disconnected' | 'connecting' | 'connected';

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  in_progress: 'En curso',
  completed: 'Completado',
  cancelled: 'Cancelado',
  no_show: 'No vino',
};
