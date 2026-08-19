# App icon & splash source art

`logo.svg` is the single source for every Android launcher icon and splash
screen. It is composited onto a solid background by `@capacitor/assets`:

| Output  | Background          | Command flag             |
| ------- | ------------------- | ------------------------ |
| Icon    | Jade `#0D9F6E`      | `--iconBackgroundColor`  |
| Splash  | Midnight `#0B1512`  | `--splashBackgroundColor`|

Regenerate after changing the art:

```bash
npm run app:icons
```

That writes into `android/app/src/main/res/` — a generated folder, so the output
is never committed.

## Want a pixel-perfect icon?

Vector art is rasterised at build time, which is fine for this flat mark. If you
would rather control every pixel (or the SVG ever fails to rasterise), drop a
**1024×1024 PNG with a transparent background** here as `logo.png` and delete
`logo.svg`. `@capacitor/assets` prefers PNG and needs no other change.

For separate control of the Android adaptive icon you can instead supply
`icon-foreground.png` (transparent, mark inside the middle 66%) and
`icon-background.png` (solid colour or texture).
