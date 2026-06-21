namespace cap.n8n.workflows;

type CapTestTriggerInputs {
  authorId : Integer;
  bookId : Integer;
  currencyCode : String;
  description : String;
  event : LargeString;
  genreId : String;
  price : Decimal;
  stock : Integer;
  title : String;
}

service WorkflowInputContracts {
  action capTestTrigger(inputs : CapTestTriggerInputs) returns Boolean;
}
