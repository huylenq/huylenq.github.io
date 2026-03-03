---
title: "Logical Agents"
slug: "logical-agents"
maturity: "seed"
---

Q: In what way that **knowledge-based agents**'s approach to intelligence is similar to human?
A: They perform **reasoning** on **internal representation** of knowledge.
<!--ID: 1657965336507-->

Q: Two limitations of **problem-solving** agents have, compare to **knowledge-based** agents?
A: Their implementations are **domain-specific** and the **atomic representation** of states.
<!--ID: 1657965365228-->


Q: How **atomic representation** of states of **problem-solving** is a limitation?
A: The only choice for representing what it knows about the state is to list all possible states, which will eventually be impractical in large environments.
<!--ID: 1658028106837-->

Q: What to call a **sentence** that is taken as given without being derived from other sentence?
A: axiom
<!--ID: 1658028150006-->

Three functions that abstract the implementation details of **knowledge representation language**?
?
- $\text{MAKE-PERCEPT-SENTENCE}$
- $\text{MAKE-ACTION-QUERY}$
- $\text{MAKE-ACTION-SENTENCE}$
<!--SR:!2022-03-07,16,234-->

  
Two main function as the main means of interfacing between the agent and the **knowledge base** (**KB**)?
?
- $\text{TELL}$
- $\text{ASK}$
<!--SR:!2022-03-08,17,234-->

  
The details of the <mark>inference mechanisms</mark> are hidden inside $\text{TELL}$ and $\text{ASK}$.
<!--SR:!2022-03-05,14,250-->

  
The **knowledge base** (**KB**) could initiallly contains <mark>background knowledge</mark>.
<!--SR:!2022-03-09,18,234-->

  
The <mark>procedural</mark> approach encodes desired behaviors directly as program code.
<!--SR:!2022-03-07,16,234-->

  
In the 1970s and 1980s, advocates of two approaches, <mark>declarative</mark> and <mark>procedural</mark> engaged in heated debates.
<!--SR:!2022-08-17,196,245!2022-04-17,70,205-->

When we need to specify only what the agent knows and in order to fix its behavior, it means we fix it at the <mark>knowledge</mark> level, not the <mark>implementation</mark> level
<!--SR:!2022-04-25,78,229!2022-04-23,75,228-->