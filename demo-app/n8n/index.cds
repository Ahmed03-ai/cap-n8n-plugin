namespace cap.n8n.workflows;

type CapTestTriggerInputs {
  bookId : Integer;
  event : LargeString;
  stock : Integer;
  title : String;
}

service WorkflowInputContracts {
  action capTestTrigger(inputs : CapTestTriggerInputs) returns Boolean;
}
