export type Chapter = {
  id: string
  title: string
  file: string
}

export type Section = {
  id: string
  title: string
  chapters: Chapter[]
}

export type Book = {
  id: string
  title: string
  subtitle?: string
  latestAddedAt?: number
  /** Same for every part of one manuscript; used to group cards on the library screen. */
  manuscriptKey: string
  /** Set for split parts (1, 2, …) so ordering is stable. */
  partNumber?: number
  sections: Section[]
}

export type Library = {
  title: string
  books: Book[]
}
