const cds = require('@sap/cds')

module.exports = class AdminService extends cds.ApplicationService { init() {

  const { Authors, Books, Genres } = this.entities

  const assignNextBookId = async (req) => {
    if (req.data.ID) return
    const { ID: id1 } = await SELECT.one.from(Books).columns('max(ID) as ID')
    const { ID: id2 } = await SELECT.one.from(Books.drafts).columns('max(ID) as ID')
    req.data.ID = Math.max(id1 || 0, id2 || 0) + 1
  }

  const normalizedName = (req, field, label) => {
    const name = req.data[field]?.trim()
    if (!name) req.reject(400, `${label} name is required`)
    return name
  }

  const readBookWithReferences = req => SELECT.one
    .from(req.subject)
    .columns(
      '*',
      { ref: ['author'], expand: [{ ref: ['ID'] }, { ref: ['name'] }] },
      { ref: ['genre'], expand: [{ ref: ['ID'] }, { ref: ['name'] }] }
    )

  /**
   * Generate IDs for new Books drafts
   */
  this.before('NEW', Books.drafts, assignNextBookId)

  /**
   * Generate IDs for direct Book creates as well.
   */
  this.before('CREATE', Books, assignNextBookId)

  const createAuthor = async req => {
    const name = normalizedName(req, 'authorName', 'Author')
    const existing = await SELECT.one.from(Authors).where({ name })
    if (existing) req.reject(409, `Author "${name}" already exists`)

    const { ID: maxId } = await SELECT.one.from(Authors).columns('max(ID) as ID')
    const author = { ID: (maxId || 0) + 1, name }
    await INSERT.into(Authors).entries(author)
    await UPDATE(req.subject).set({ author_ID: author.ID })
    return readBookWithReferences(req)
  }

  const createGenre = async req => {
    const name = normalizedName(req, 'genreName', 'Genre')
    const existing = await SELECT.one.from(Genres).where({ name })
    if (existing) req.reject(409, `Genre "${name}" already exists`)

    const genre = { ID: cds.utils.uuid(), name }
    await INSERT.into(Genres).entries(genre)
    await UPDATE(req.subject).set({ genre_ID: genre.ID })
    return readBookWithReferences(req)
  }

  this.on('createAuthor', Books, createAuthor)
  this.on('createAuthor', Books.drafts, createAuthor)
  this.on('createGenre', Books, createGenre)
  this.on('createGenre', Books.drafts, createGenre)

  return super.init()
}}
