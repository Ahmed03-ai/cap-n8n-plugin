using {sap.capire.bookshop as my} from '../db/schema';

service AdminService {
  entity Authors as projection on my.Authors;
  @odata.draft.bypass
  entity Books   as projection on my.Books;
  entity Genres  as projection on my.Genres;
}

annotate AdminService.Books with @n8n.workflow.start: {
  workflowId: 'webhook-test/cap-test-trigger',
  on: ['CREATE', 'UPDATE'],
  inputs: {
    bookId: 'ID',
    title: 'title'
  },
  if: 'stock > 0',
  businessKey: 'ID',
  tag: 'admin-books'
};

annotate AdminService.Books with @n8n.workflow.cancel: {
  workflowId: 'webhook-test/cap-test-trigger',
  on: ['DELETE'],
  businessKey: 'ID',
  tag: 'admin-books'
};
