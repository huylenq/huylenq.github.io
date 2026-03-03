---
title: "Replication"
slug: "replication"
maturity: "seed"
---

Q: What kind of failure that [Replication](/thoughts/replication) can recover?
A: fail-stop

Q: What kinds of failures that [Replication](/thoughts/replication) can't recover?
A: bugs, correlated failures, disaster (if replication aren't physically separated enough).

Q: What is it called when a backup replica take control from the primary?
A: cut-over.