# Production smoke test

Run this only with controlled accounts and `OUTREACH_TEST_MODE=true` until you deliberately unpause real outreach.

| Step                       | Expected result                          |
| -------------------------- | ---------------------------------------- |
| Sign in                    | Supabase login succeeds                  |
| Dashboard loads            | CRM metrics render                       |
| Create manual lead         | Lead appears in workspace                |
| Analyze lead/company       | Job queues and completes                 |
| Run test lead hunt         | Worker processes a small hunt            |
| Shortlist loads            | Qualified leads appear                   |
| Generate outreach          | Draft content generated for review       |
| Create Gmail test draft    | Draft goes to `OUTREACH_TEST_RECIPIENT`  |
| Send controlled test email | One send only; subject has `[TEST]`      |
| Reply from test account    | Gmail sync detects reply                 |
| Notification appears       | Reply notification is visible            |
| Weekly report endpoint     | Report generates                         |
| Pause outreach             | New sends blocked with `OUTREACH_PAUSED` |
| Stop automation            | Scheduled automation stops               |

Do not send to real prospects until this passes.
