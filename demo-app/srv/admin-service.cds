using {sap.capire.bookshop as my} from '../db/schema';

service AdminService {
  entity Authors as projection on my.Authors;
  @odata.draft.bypass
  entity Books   as projection on my.Books;
  entity Genres  as projection on my.Genres;
}

// Creating or updating a book will trigger the workflow, but only if the stock is greater than 0
annotate AdminService.Books with @n8n.workflow.start: {
  workflowId: 'webhook-test/cap-test-trigger',
  on: ['CREATE', 'UPDATE'],
  inputs: {
    bookId: 'ID',
    title: 'title',
    stock: 'stock'
  },
  if: 'stock > 0',
  businessKey: 'ID',
  tag: 'admin-books'
};

// Deleting a book only has an effect on the workflow if it is still active 
annotate AdminService.Books with @n8n.workflow.cancel: {
  workflowId: 'webhook-test/cap-test-trigger',
  on: ['DELETE'],
  businessKey: 'ID',
  tag: 'admin-books'
};
