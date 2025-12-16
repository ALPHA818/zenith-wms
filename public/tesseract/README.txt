Place the following Tesseract assets in this folder for offline/CSP-friendly OCR:

- worker.min.js (from tesseract.js v5 distribution)
- tesseract-core.wasm.js (from tesseract.js-core v5 distribution)
- eng.traineddata (English language data)

Suggested sources:
- https://unpkg.com/tesseract.js@5.0.5/dist/worker.min.js
- https://unpkg.com/tesseract.js-core@5.0.0/tesseract-core.wasm.js
- https://tessdata.projectnaptha.com/4.0.0_best/eng.traineddata

After placing files, ensure paths:
- /tesseract/worker.min.js
- /tesseract/tesseract-core.wasm.js
- /tesseract/eng.traineddata

These will be served by Vite in dev and bundled into Electron app assets for production.