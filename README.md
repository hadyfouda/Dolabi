# دولابي — منسّق ملابسك الذكي

Offline-first mobile PWA: photograph your clothes, get clean auto-cropped cutouts (on-device AI), and get ranked outfit suggestions with Arabic styling explanations.

**Stack:** Vite 8 · React 19 · TypeScript (strict) · Tailwind CSS 4 · Dexie (IndexedDB) · @imgly/background-removal (WASM/ONNX, local) · vite-plugin-pwa (Workbox)

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build → dist/
npm run preview    # serve dist/ (service worker active)
npm run icons      # regenerate PNG icons in public/ (uses sharp)
```

**Live (GitHub Pages):** https://hadyfouda.github.io/Dolabi/ — every push to `main` rebuilds and redeploys via `.github/workflows/deploy.yml` (repo Settings → Pages → Source: **GitHub Actions**).

Other static hosts (Netlify, Vercel, Cloudflare Pages) work too: build with `npm run build` and serve `dist/`. For a sub-folder deploy set `BASE_PATH=/folder/` at build time. **HTTPS is required** for install + service worker.

## Structure

```
src/
  db/wardrobeDb.ts          Dexie schema (items, outfits, wearHistory) + JSON backup (base64 images)
  services/
    imageProcessor.ts       resize 1024 → imgly isnet_quint8 → alpha>20 tight crop + 5% pad → WebP ≤800px
    colorUtils.ts           20-color menswear palette, CIE-Lab nearest match, dominant-color sampling
    outfitRules.ts          Engine A: color harmony, contrast, pattern, layering, formality, weather, repetition
    aiStylist.ts            Engine B: Gemini / Claude (metadata JSON only — never images)
    outfitEngine.ts         dual-mode orchestrator with automatic fallback
    demoItems.ts            6 SVG demo garments
    settings.ts             localStorage settings store
  hooks/                    useObjectUrl (ref-counted, auto-revoked), useInstallPrompt, useSettings
  components/               BottomNav, Sheet, ItemCard, ItemDrawer, UploadSheet, OutfitCard, InstallPwaBanner…
  screens/                  Wardrobe, GetDressed, Saved, Settings
```

## Notes

- **Background-removal model:** fetched once from IMG.LY's versioned CDN on first upload (~45 MB quantized model + ONNX wasm), then cached by the service worker so cutouts work offline. To self-host instead, put the resources in `public/imgly/` and build with `VITE_IMGLY_PUBLIC_PATH=/imgly/`.
- **AI keys** are stored in `localStorage` on the device and sent directly from the browser to Google/Anthropic. Fine for a personal app; don't ship a shared key this way.
- Default AI models (editable in Settings): `gemini-3.6-flash`, `claude-haiku-5-5`.
- **License:** `@imgly/background-removal` is AGPL-3.0. Personal/open-source use is fine; a closed-source commercial release needs an IMG.LY commercial license.
