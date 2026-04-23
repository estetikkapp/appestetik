// Tipos manuales de app (no derivados del schema de DB).
// Agregar aquí unions, helpers de DTO, etc.

export type Role = 'owner' | 'admin' | 'professional' | 'receptionist';
export type TaxCondition = 'monotributo' | 'responsable_inscripto' | 'exento';
export type AfipProvider = 'tusfacturas' | 'direct' | 'manual';
export type InviteRole = Exclude<Role, 'owner'>;
