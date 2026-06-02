namespace cap.n8n;

entity WorkflowExecutions {
  key executionId    : UUID;
      n8nExecutionId : String(128);
      correlationId  : String(255);
      workflowId     : String(500);
      status         : String(32);
      businessKey    : String(255);
      tag            : String(255);
      attempts       : Integer default 0;
      createdAt      : Timestamp;
      startedAt      : Timestamp;
      finishedAt     : Timestamp;
      updatedAt      : Timestamp;
      result         : LargeString;
      error          : LargeString;
}

entity WorkflowDispatches {
  key executionId    : UUID;
      workflowId     : String(500);
      workflowPath   : String(1000);
      correlationId  : String(255);
      businessKey    : String(255);
      tag            : String(255);
      status         : String(32);
      attempts       : Integer default 0;
      payload        : LargeString;
      error          : LargeString;
      createdAt      : Timestamp;
      updatedAt      : Timestamp;
      lastAttemptAt  : Timestamp;
      finishedAt     : Timestamp;
}
