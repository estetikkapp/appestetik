# Assets

Iconos para los builds del agente.

## Generación de iconos

El SVG fuente está en `icon.svg`. Para generar los formatos que electron-builder
necesita:

```bash
# PNG 512x512 (Linux + tray)
npx svg2png-cli icon.svg --output icon.png --width 512 --height 512

# ICO (Windows) — usar https://convertio.co/png-ico/ o:
npx png-to-ico icon.png > icon.ico

# ICNS (macOS) — usar https://cloudconvert.com/png-to-icns o:
npx png2icns icon.png
```

Si los archivos `.png`, `.ico` o `.icns` faltan al hacer build, electron-builder
usa un icono default genérico. La app funciona igual, solo queda sin branding.
