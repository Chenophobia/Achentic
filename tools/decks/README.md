# Deck sources

The two decks in the repository root are generated from these scripts with `pptxgenjs`.

```sh
npm install --no-save pptxgenjs jszip
PPTX_SKILL_DIR=<folder of the pptx skill> node tools/decks/deploy-on-mac-mini.js
PPTX_SKILL_DIR=<folder of the pptx skill> node tools/decks/agentic-dev-cycle.js
```

`PPTX_SKILL_DIR` is the folder that holds `scripts/apply_theme.js`, which writes the theme colours into the file. Check the result by exporting the slides to images and looking at them; text that fits in the script can still overflow on the slide.
