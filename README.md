# TPZ-77 «BASILISK» — general arrangement

An interactive engineering drawing sheet. Rotate the vehicle, pull it apart
with the disassembly slider, and read the annotated bill of materials as you
go. Clicking a row in the parts list, a component in the 3D field, or a
callout label all select the same thing.

**Everything on this sheet is invented.** The vehicle, its designation, its
part numbers and its figures are display copy written for a UI demo. Nothing
here is drawn from, or usable as, engineering data for any real vehicle — the
geometry is a couple of hundred boxes and cylinders. Treat it as an exploded
assembly diagram in the same category as a watch movement or an engine block
poster.

## Running it

The page uses ES modules and an import map, so it needs to be served over
HTTP rather than opened from the filesystem:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

There is no build step and no dependency install. Three.js is pulled from a
CDN by the import map in `index.html`.

To publish it, push to GitHub and turn on Pages for the default branch root.
The `.nojekyll` file is there so Pages serves the directories as-is.

## How it fits together

| File | Job |
| --- | --- |
| `data/bom.js` | The parts list. One entry per component: name, quantity, notional spec, maintenance note, and the vector it travels along when disassembled. |
| `js/parts.js` | Builds the geometry. One `THREE.Group` per BOM entry, named with the part ID. Also owns `applyDisassembly`. |
| `js/scene.js` | Renderer, camera, lights, materials, the edge overlay, raycast picking, focus and isolate. |
| `js/callouts.js` | Projects each part's 3D position to screen space, stacks the labels into margin columns, and draws the leader lines. |
| `js/ui.js` | Renders the parts list and the component data panel. |
| `js/app.js` | Holds the selection state and wires everything to it. |

The two ideas worth stealing:

**Disassembly is one number.** Every part stores a home position and an
explode vector. The slider is `t` from 0 to 1, and each frame every part sits
at `home + explode * t`. Parts that exist as a left/right pair inside one
group get split outward from the centreline instead, so the tracks separate
rather than sliding sideways together.

**Callouts are HTML, not 3D.** Each label is a real DOM button parked in a
margin column. Every frame its anchor is projected from 3D to screen
coordinates and an SVG polyline is redrawn from the label to the part. That
keeps the type crisp at any zoom and keeps the labels clickable and
focusable.

## Making it your own subject

The vehicle is the least reusable part of this. To point it at something
else — an engine, a camera body, a satellite — replace the entries in
`data/bom.js` and the matching builders in `js/parts.js`. As long as each
group's `name` matches a BOM `id`, the list, the picking, the callouts and
the data panel all keep working untouched.

## Controls

| Input | Action |
| --- | --- |
| Drag | Rotate |
| Scroll | Zoom |
| Right-drag | Pan |
| Click a component | Select and show its data |
| Esc | Deselect |
| Focus | Move the camera to the selection |
| Isolate | Hide everything except the selection |
| Blueprint | Ghost the surfaces so the internal layout reads through |

## Licence

MIT. See `LICENSE`.
