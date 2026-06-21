const cds = require('@sap/cds')

module.exports = class AdminService extends cds.ApplicationService { init() {

  const { Books } = this.entities

  const assignNextBookId = async (req) => {
    if (req.data.ID) return
    const { ID: id1 } = await SELECT.one.from(Books).columns('max(ID) as ID')
    const { ID: id2 } = await SELECT.one.from(Books.drafts).columns('max(ID) as ID')
    req.data.ID = Math.max(id1 || 0, id2 || 0) + 1
  }

  /**
   * Generate IDs for new Books drafts
   */
  this.before('NEW', Books.drafts, assignNextBookId)

  /**
   * Generate IDs for direct Book creates as well.
   */
  this.before('CREATE', Books, assignNextBookId)

  return super.init()
}}
