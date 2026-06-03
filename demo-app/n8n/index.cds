namespace cap.n8n.workflows;

type CapTestTriggerInputs {
  bookId : Integer;
  event : LargeString;
  title : String;
}

service WorkflowInputContracts {
  action capTestTrigger(inputs : CapTestTriggerInputs) returns Boolean;
}
