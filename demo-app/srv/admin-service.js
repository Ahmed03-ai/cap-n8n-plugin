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


  /**
   * Proof of Concept: Programmatically trigger an n8n workflow
   * when a new Book is created.
   */
  this.after ('CREATE', Books, async (data, req) => {
    try {
      const n8n = await cds.connect.to('n8n')
      // Use the webhook path defined in the n8n UI
      await n8n.send('start', { 
        workflowId: 'webhook-test/cap-test-trigger', 
        inputs: { 
          event: 'BookCreated',
          bookId: data.ID,
          title: data.title
        } 
      })
      cds.log('n8n').info('Successfully notified n8n about new Book')
    } catch (err) {
      cds.log('n8n').error('Could not notify n8n about new Book:', err.message)
    }
  })

  return super.init()
}}
