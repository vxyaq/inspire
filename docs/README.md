# Inspire Docs

inspire docs is made using mkdocs

warning: the tweaks.md and /tweaks/ folder is auto-generated, do not edit directly

requirements:

- Python
- pip
- UV (package manager)
- node 22

to deploy:

on gh-pages:

```bash
# generate the docs for the tweaks (will move to python soon)
node index.js

# build the docs
uv run mkdocs build

# deploy to GitHub Pages
uv run mkdocs gh-deploy
```

build static:

```bash
# generate the docs for the tweaks (will move to python soon)
node index.js

# build the docs
uv run mkdocs build
```

start a local server:

```bash
uv run mkdocs serve
```
