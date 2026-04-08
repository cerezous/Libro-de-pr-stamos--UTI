import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { TIPOS_SOPORTE } from '../components/insumos/tiposSoporte'
import { codigoInventarioSeisDigitos } from './codigoInventario'

export type InformePdfLinea = {
  codigo_inventario: string
  tipo_soporte: string
  modelo: string
  estado: string
  /** Snapshot del informe o valor actual del catálogo embebido. */
  no_ubicable: boolean
  detalle: string
  observacion: string
}

function tipoSoporteRank(tipo: string): number {
  const t = tipo.trim()
  const i = TIPOS_SOPORTE.indexOf(t as (typeof TIPOS_SOPORTE)[number])
  if (i !== -1) return i
  return TIPOS_SOPORTE.length
}

/** Mismo criterio que el catálogo en pantalla (tipo → modelo → código). */
export function ordenarLineasInformePdf(rows: InformePdfLinea[]): InformePdfLinea[] {
  return [...rows].sort((a, b) => {
    const ra = tipoSoporteRank(a.tipo_soporte)
    const rb = tipoSoporteRank(b.tipo_soporte)
    if (ra !== rb) return ra - rb
    if (ra === TIPOS_SOPORTE.length) {
      const tipoCmp = a.tipo_soporte.localeCompare(b.tipo_soporte, 'es')
      if (tipoCmp !== 0) return tipoCmp
    }
    const modeloCmp = a.modelo.localeCompare(b.modelo, 'es', { sensitivity: 'base' })
    if (modeloCmp !== 0) return modeloCmp
    return a.codigo_inventario.localeCompare(b.codigo_inventario, 'es', {
      numeric: true,
      sensitivity: 'base',
    })
  })
}

function insumoDesdeEmbed(obs: unknown): {
  codigo_inventario: string
  tipo_soporte: string
  modelo: string
  estado: string
  detalle: string
  no_ubicable: boolean
} | null {
  if (!obs) return null
  const o = Array.isArray(obs) ? obs[0] : obs
  if (!o || typeof o !== 'object') return null
  const x = o as Record<string, unknown>
  const nu = x.no_ubicable
  const noUbicable = typeof nu === 'boolean' ? nu : String(nu).toLowerCase() === 'true'
  return {
    codigo_inventario: String(x.codigo_inventario ?? ''),
    tipo_soporte: String(x.tipo_soporte ?? ''),
    modelo: String(x.modelo ?? ''),
    estado: String(x.estado ?? ''),
    detalle: String(x.detalle ?? ''),
    no_ubicable: noUbicable,
  }
}

function noUbicableDesdeObservacionRow(
  r: Record<string, unknown>,
  ins: ReturnType<typeof insumoDesdeEmbed>,
): boolean {
  const raw = r.no_ubicable
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'string') return raw.toLowerCase() === 'true'
  return ins?.no_ubicable ?? false
}

/** Construye filas PDF desde respuesta PostgREST de `informes_insumos_observaciones`. */
export function lineasPdfDesdeObservacionesQuery(
  raw: Record<string, unknown>[],
): InformePdfLinea[] {
  const lineas: InformePdfLinea[] = []
  for (const r of raw) {
    const row = r as Record<string, unknown>
    const ins = insumoDesdeEmbed(row.insumos)
    const snap = String(row.detalle ?? '').trim()
    const live = ins?.detalle?.trim() ?? ''
    lineas.push({
      codigo_inventario: ins?.codigo_inventario ?? '',
      tipo_soporte: ins?.tipo_soporte ?? '',
      modelo: ins?.modelo ?? '',
      estado: ins?.estado ?? '',
      no_ubicable: noUbicableDesdeObservacionRow(row, ins),
      detalle: snap || live,
      observacion: String(row.observacion ?? ''),
    })
  }
  return ordenarLineasInformePdf(lineas)
}

export type MetricasInformePdf = {
  insumos_disponibles: number
  insumos_en_uso: number
  insumos_mantencion: number
  insumos_fuera_servicio: number
  insumos_prestados: number
  insumos_no_ubicables: number
}

/** Fila para la tabla «Usos activos» al final del PDF. */
export type InformePdfUsoActivoLinea = {
  fecha_uso: string
  instala: string
  codigo: string
  soporte: string
  estado: string
  cama: string
  fecha_devolucion: string
  recepcion: string
  obs: string
}

/** Fila para la tabla «Préstamos activos» (incluye parcialmente devuelto). */
export type InformePdfPrestamoActivoLinea = {
  fecha: string
  numero: string
  estado: string
  servicio: string
  cama: string
  klgo_solicita: string
  prestador: string
  soportes: string
  devoluciones: string
  obs: string
}

type DocConAutoTable = jsPDF & { lastAutoTable?: { finalY: number } }

export function descargarInformeInsumoPdf(opts: {
  tituloArchivo: string
  fechaInformeLabel: string
  responsable: string
  metricas: MetricasInformePdf
  lineas: InformePdfLinea[]
  /** Momento de generación del PDF (no snapshot histórico). */
  usosActivos?: InformePdfUsoActivoLinea[]
  prestamosActivos?: InformePdfPrestamoActivoLinea[]
}) {
  const { tituloArchivo, fechaInformeLabel, responsable, metricas, lineas, usosActivos, prestamosActivos } =
    opts

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Informe de soportes (insumos)', 14, 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Fecha del informe: ${fechaInformeLabel}`, 14, 24)
  doc.text(`Responsable: ${responsable}`, 14, 30)

  doc.setFontSize(9)
  const mText = [
    `Disponibles: ${metricas.insumos_disponibles}`,
    `En uso: ${metricas.insumos_en_uso}`,
    `Mantención: ${metricas.insumos_mantencion}`,
    `Fuera de servicio: ${metricas.insumos_fuera_servicio}`,
    `Prestados: ${metricas.insumos_prestados}`,
    `No ubicables: ${metricas.insumos_no_ubicables}`,
  ].join('   ·   ')
  doc.text(mText, 14, 37)

  const body: string[][] = lineas.map((l) => [
    codigoInventarioSeisDigitos(l.codigo_inventario),
    l.tipo_soporte,
    l.modelo,
    l.estado,
    l.no_ubicable ? 'Sí' : 'No',
    l.detalle || '—',
    l.observacion || '—',
  ])

  autoTable(doc, {
    startY: 42,
    head: [['Código', 'Tipo', 'Modelo', 'Estado', 'No ubic.', 'Detalle', 'Observación']],
    body,
    styles: { fontSize: 7, cellPadding: 1.2, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [39, 39, 42], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 24 },
      2: { cellWidth: 32 },
      3: { cellWidth: 28 },
      4: { cellWidth: 14 },
      5: { cellWidth: 48 },
      6: { cellWidth: 48 },
    },
    margin: { left: 10, right: 10 },
  })

  const d = doc as DocConAutoTable
  let yAfter = d.lastAutoTable?.finalY ?? 42
  const pageH = doc.internal.pageSize.getHeight()
  const marginBot = 12

  const espacioParaBloque = (minMm: number) => {
    if (yAfter + minMm > pageH - marginBot) {
      doc.addPage()
      yAfter = 16
    } else {
      yAfter += 8
    }
  }

  const usos = usosActivos ?? []
  const pres = prestamosActivos ?? []

  espacioParaBloque(28)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Usos activos (sin devolución registrada)', 14, yAfter)
  yAfter += 6

  const bodyUsos =
    usos.length > 0
      ? usos.map((u) => [
          u.fecha_uso,
          u.instala,
          u.codigo,
          u.soporte,
          u.estado,
          u.cama,
          u.fecha_devolucion,
          u.recepcion,
          u.obs,
        ])
      : [['—', '—', '—', '—', '—', '—', '—', '—', 'No hay usos activos']]

  autoTable(doc, {
    startY: yAfter,
    head: [
      [
        'Fecha uso',
        'Instala',
        'Código',
        'Soporte',
        'Estado',
        'Cama',
        'Fecha devol.',
        'Retirado por',
        'Observación',
      ],
    ],
    body: bodyUsos,
    styles: { fontSize: 6.5, cellPadding: 1.1, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [39, 39, 42], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 26 },
      2: { cellWidth: 14 },
      3: { cellWidth: 26 },
      4: { cellWidth: 22 },
      5: { cellWidth: 16 },
      6: { cellWidth: 26 },
      7: { cellWidth: 26 },
      8: { cellWidth: 34 },
    },
    margin: { left: 10, right: 10 },
  })

  yAfter = d.lastAutoTable?.finalY ?? yAfter

  espacioParaBloque(28)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Préstamos activos (incluye devolución parcial)', 14, yAfter)
  yAfter += 6

  const bodyPres =
    pres.length > 0
      ? pres.map((p) => [
          p.fecha,
          p.numero,
          p.estado,
          p.servicio,
          p.cama,
          p.klgo_solicita,
          p.prestador,
          p.soportes,
          p.devoluciones,
          p.obs,
        ])
      : [['—', '—', '—', '—', '—', '—', '—', '—', '—', 'No hay préstamos activos']]

  autoTable(doc, {
    startY: yAfter,
    head: [
      [
        'Fecha',
        'Nº',
        'Estado',
        'Servicio',
        'Cama',
        'Klgo. sol.',
        'Prestador',
        'Soportes',
        'Devoluciones',
        'Obs.',
      ],
    ],
    body: bodyPres,
    styles: { fontSize: 6.5, cellPadding: 1.1, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [39, 39, 42], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 12 },
      2: { cellWidth: 22 },
      3: { cellWidth: 26 },
      4: { cellWidth: 18 },
      5: { cellWidth: 14 },
      6: { cellWidth: 26 },
      7: { cellWidth: 34 },
      8: { cellWidth: 38 },
      9: { cellWidth: 24 },
    },
    margin: { left: 10, right: 10 },
  })

  doc.save(tituloArchivo.endsWith('.pdf') ? tituloArchivo : `${tituloArchivo}.pdf`)
}
