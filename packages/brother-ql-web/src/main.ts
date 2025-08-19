import './style.css'
import { connect, getPreviewImage, printColorImage } from './index'

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif; max-width: 820px; margin: 24px auto;">
    <h1>Brother QL Web – Demo</h1>
    <p>Use a color image, preview (dithered), and print via WebUSB.</p>

    <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin: 12px 0;">
      <button id="btnConnect">Connect</button>
      <input id="fileInput" type="file" accept="image/*" />
      <button id="btnPreview" disabled>Preview</button>
      <button id="btnPrint" disabled>Print</button>
    </div>

    <div id="status" style="margin: 8px 0; color: #444;"></div>
    <div id="previewWrap" style="border:1px dashed #ccc; padding:8px; min-height:40px;">
      <em>No preview yet</em>
    </div>
  </div>
`

const el = {
  status: document.querySelector<HTMLDivElement>('#status')!,
  btnConnect: document.querySelector<HTMLButtonElement>('#btnConnect')!,
  btnPreview: document.querySelector<HTMLButtonElement>('#btnPreview')!,
  btnPrint: document.querySelector<HTMLButtonElement>('#btnPrint')!,
  file: document.querySelector<HTMLInputElement>('#fileInput')!,
  previewWrap: document.querySelector<HTMLDivElement>('#previewWrap')!,
}

let selectedBlob: Blob | null = null

el.file.addEventListener('change', () => {
  const f = el.file.files?.[0] || null
  selectedBlob = f
  el.btnPreview.disabled = !f
  el.btnPrint.disabled = !f
})

function setStatus(msg: string) {
  el.status.textContent = msg
}

el.btnConnect.addEventListener('click', async () => {
  try {
    setStatus('Requesting device…')
    const status = await connect()
    setStatus(`Connected. Media: ${status.mediaWidthMm}mm ${status.mediaType === 0x0b ? 'die-cut' : 'continuous'}, printable ${status.printableDots} dots`)
  } catch (err: any) {
    console.error(err)
    setStatus('Connect failed: ' + (err?.message || err))
  }
})

el.btnPreview.addEventListener('click', async () => {
  if (!selectedBlob) return
  try {
    setStatus('Building preview…')
    const canvas = await getPreviewImage(selectedBlob, { brightness: 150, contrast: 80 })
    el.previewWrap.innerHTML = ''
    canvas.style.maxWidth = '100%'
    canvas.style.imageRendering = 'pixelated'
    el.previewWrap.appendChild(canvas)
    setStatus('Preview ready.')
  } catch (err: any) {
    console.error(err)
    setStatus('Preview failed: ' + (err?.message || err))
  }
})

el.btnPrint.addEventListener('click', async () => {
  if (!selectedBlob) return
  try {
    setStatus('Printing…')
    await printColorImage(selectedBlob, { cutAtEnd: true })
    setStatus('Done.')
  } catch (err: any) {
    console.error(err)
    setStatus('Print failed: ' + (err?.message || err))
  }
})
