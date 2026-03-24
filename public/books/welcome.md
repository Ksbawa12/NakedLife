# Your private library

This app reads whatever you list in **`public/library.json`**. Each book has chapters, and each chapter points to a file under **`public/`** (usually **`public/books/…`**).

## Add a Word manuscript

1. Copy a `.docx` file into `public/books/` (create folders if you like).
2. Add a chapter entry with `"file": "books/your-story/chapter-1.docx"`.

Chapters are converted to HTML in the browser—no server required.

## Add Markdown instead

Use `.md` files the same way: set `"file"` to the path under `public/`.

## Tip

Rename files to use simple paths (no spaces) so links stay reliable. You can keep the original titles in the `"title"` field of each chapter.

---

*Run the app with `npm run dev` in the `book-reader` folder.*
