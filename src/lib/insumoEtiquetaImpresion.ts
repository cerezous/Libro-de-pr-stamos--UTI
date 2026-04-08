import QRCode from 'qrcode'
import { ETIQUETA_UNIDAD_TEXTO } from '../constants/etiquetaInsumo'

/** El QR codifica solo `codigo_inventario` (misma lectura que antes con barras). */
export type InsumoEtiquetaRow = {
  codigo_inventario: string
}

function escHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** QR en SVG (mejor lectura con cámara móvil que Code128 en muchos casos). */
async function generarSvgQr(valor: string): Promise<string> {
  return QRCode.toString(valor, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 120,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  })
}

/**
 * Etiqueta mínima para impresora térmica Zebra ZD220 (rollo 2" / ~50,8 mm de ancho).
 * QR + texto unidad + código de inventario.
 */
export async function abrirImpresionEtiquetaInsumo(row: InsumoEtiquetaRow) {
  let svgMarkup: string
  try {
    svgMarkup = await generarSvgQr(row.codigo_inventario)
  } catch {
    alert('No se pudo generar el código QR para este insumo.')
    return
  }

  const codigo = escHtml(row.codigo_inventario)
  const unidad = escHtml(ETIQUETA_UNIDAD_TEXTO)
  const w = window.open('', '_blank')
  if (!w) {
    alert('No se pudo abrir la ventana de impresión. Permite ventanas emergentes para este sitio.')
    return
  }

  const LABEL_W_MM = 50.8
  const LABEL_H_MM = 34

  w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>${codigo}</title>
    <style>
      @page {
        size: ${LABEL_W_MM}mm ${LABEL_H_MM}mm;
        margin: 0;
      }
      html {
        width: ${LABEL_W_MM}mm;
        height: ${LABEL_H_MM}mm;
      }
      * { box-sizing: border-box; }
      body {
        width: ${LABEL_W_MM}mm;
        height: ${LABEL_H_MM}mm;
        margin: 0;
        padding: 1mm 1mm 1.2mm;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        font-family: ui-monospace, 'Courier New', monospace;
        color: #000;
        background: #fff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .qr-wrap {
        display: flex;
        justify-content: center;
        align-items: center;
        max-width: 48mm;
        line-height: 0;
        flex-shrink: 0;
      }
      .qr-wrap svg {
        display: block;
        max-width: 22mm;
        max-height: 22mm;
        width: auto;
        height: auto;
      }
      .unidad {
        margin: 1mm 0 0;
        padding: 0;
        font-size: 7.5pt;
        font-weight: 700;
        letter-spacing: 0.02em;
        line-height: 1.15;
        text-align: center;
        max-width: 48mm;
      }
      .codigo {
        margin: 0.5mm 0 0;
        padding: 0;
        font-size: 6.5pt;
        font-weight: 600;
        letter-spacing: 0.04em;
        line-height: 1.1;
        text-align: center;
        max-width: 48mm;
        word-break: break-all;
      }
      @media screen {
        html { background: #e8e8e8; }
        body {
          margin: 12px auto;
          box-shadow: 0 0 0 1px #999;
        }
      }
    </style></head><body>
    <div class="qr-wrap">${svgMarkup}</div>
    <p class="unidad">${unidad}</p>
    <p class="codigo">${codigo}</p>
    </body></html>`)
  w.document.close()
  w.focus()
  requestAnimationFrame(() => {
    setTimeout(() => {
      w.print()
      w.close()
    }, 100)
  })
}
