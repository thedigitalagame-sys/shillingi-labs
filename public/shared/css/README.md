# Stylesheet structure

`index.css` is the only stylesheet loaded by the admin page. It imports the modules in their required cascade order.

- `base/`: design tokens, resets and global element defaults.
- `layout/`: application shell and page-level layout primitives.
- `components/`: reusable overlays, branding and media states.
- `features/`: styles owned by a specific business area or screen.
- `themes/`: Driveline-specific visual overrides.
- `responsive/`: viewport and print adaptations.

Add new rules to the narrowest appropriate module. Avoid changing import order unless the cascade impact has been checked.
