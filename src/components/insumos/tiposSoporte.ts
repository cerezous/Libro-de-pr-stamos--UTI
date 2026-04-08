/** Valores oficiales de tipo de soporte (orden de bloques en la tabla). */
export const TIPOS_SOPORTE = ['VMI', 'VMNI', 'CNAF', 'VM Transporte', 'Aerogen'] as const

export type TipoSoporte = (typeof TIPOS_SOPORTE)[number]
