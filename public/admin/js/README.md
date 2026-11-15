# Admin frontend modules

Scripts are loaded in dependency order by `public/admin/index.html`.

- `core/`: reusable DOM helpers, API client, modal UI, icons, state and application shell.
- `features/`: business areas. Each file owns the views and interactions for one area.
- `bootstrap.js`: starts the application after all core and feature modules are loaded.

The application deliberately uses browser-native scripts so it remains deployable to shared cPanel hosting without a build step. Shared top-level bindings are therefore part of the internal frontend API; keep the script order stable when adding modules.
