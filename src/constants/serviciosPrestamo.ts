/** Servicios disponibles al registrar un préstamo (orden fijo para selects). */
export const SERVICIOS_PRESTAMO = [
  'UCI',
  'UTI 7mo',
  'UCO',
  'Urgencia',
  'UTI Cardioquirúrgica',
  'UCI Pediatrica',
  'Pediatría',
  'UCM Cardiología',
  'UCM Neurología',
  'UCM Medicina Interna',
  'UCM Cirugía',
  'Pabellón',
] as const

export type ServicioPrestamo = (typeof SERVICIOS_PRESTAMO)[number]
