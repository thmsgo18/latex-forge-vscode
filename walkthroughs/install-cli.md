LaTeX Forge needs two things on your machine: its small command-line tool, which scaffolds and compiles your documents, and LaTeX itself. This extension just wraps them.

**Install Everything** sets both up in one go:

- the LaTeX Forge CLI (no Python or pipx needed: LaTeX Forge brings its own),
- a LaTeX distribution: **Light** (TinyTeX, about 500 MB, a few minutes) by default, or **Full** (all of TeX Live) if you prefer everything offline — both in your home folder, no administrator password,
- then a test compile, to be sure it works.

Already have MacTeX, MiKTeX or TeX Live? It's detected and left untouched.

With the light distribution, LaTeX packages a document needs are installed automatically the first time you compile it.

[Install Everything](command:latex-forge.installEverything)
