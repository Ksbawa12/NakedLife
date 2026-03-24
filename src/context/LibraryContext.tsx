import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Book, Library } from '../types/library'

type LibraryState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: Library }

const LibraryContext = createContext<{
  state: LibraryState
  reload: () => void
} | null>(null)

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LibraryState>({ status: 'loading' })

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const res = await fetch('/library.json', { cache: 'no-store' })
      if (!res.ok) {
        throw new Error(`Could not load library (${res.status})`)
      }
      const data = (await res.json()) as Library
      if (!data?.books?.length) {
        throw new Error('Library has no books')
      }
      const invalid = data.books.some(
        (b) =>
          !b.manuscriptKey ||
          !b.sections?.length ||
          b.sections.some((s) => !s.chapters?.length),
      )
      if (invalid) {
        throw new Error('Library format is outdated — run npm run generate:library')
      }
      setState({ status: 'ready', data })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setState({ status: 'error', message })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const value = useMemo(() => ({ state, reload: load }), [state, load])

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  )
}

export function useLibrary() {
  const ctx = useContext(LibraryContext)
  if (!ctx) {
    throw new Error('useLibrary must be used within LibraryProvider')
  }
  return ctx
}

export function useBook(bookId: string | undefined): Book | undefined {
  const { state } = useLibrary()
  if (state.status !== 'ready' || !bookId) return undefined
  return state.data.books.find((b) => b.id === bookId)
}
