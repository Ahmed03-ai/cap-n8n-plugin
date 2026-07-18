using {sap.capire.bookshop as my} from '../db/schema';

service AdminService {
  entity Authors as projection on my.Authors;
  @odata.draft.bypass
  entity Books   as projection on my.Books actions {
    @Common.SideEffects: {
      TargetProperties: ['in/author_ID'],
      TargetEntities: ['in/author']
    }
    action createAuthor(
      in         : $self,
      authorName : String(111) not null @title: 'Name des Autors'
    ) returns Books;

    @Common.SideEffects: {
      TargetProperties: ['in/genre_ID'],
      TargetEntities: ['in/genre']
    }
    action createGenre(
      in        : $self,
      genreName : String(111) not null @title: 'Name des Genres'
    ) returns Books;
  };
  entity Genres  as projection on my.Genres;
}

// Creating or updating a book will trigger the workflow, but only if the stock is greater than 0
annotate AdminService.Books with @n8n.workflow.start: {
  workflowId: 'webhook/cap-test-trigger',
  on: ['CREATE', 'UPDATE'],
  inputs: {
    bookId: 'ID',
    title: 'title',
    description: 'descr',
    authorId: 'author_ID',
    genreId: 'genre_ID',
    stock: 'stock',
    price: 'price',
    currencyCode: 'currency_code'
  },
  if: 'stock > 0',
  businessKey: 'ID',
  tag: 'admin-books'
};

// Deleting a book only has an effect on the workflow if it is still active 
annotate AdminService.Books with @n8n.workflow.cancel: {
  workflowId: 'webhook/cap-test-trigger',
  on: ['DELETE'],
  businessKey: 'ID',
  tag: 'admin-books'
};
