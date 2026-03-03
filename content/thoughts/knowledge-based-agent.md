---
title: "Knowledge-based Agent"
slug: "knowledge-based-agent"
maturity: "seed"
---

$$
\definecolor{Purple}{RGB}{147,61,173}
\definecolor{Blue}{RGB}{48,138,255}
\definecolor{Green}{RGB}{101,219,88} 
\definecolor{Yellow}{RGB}{242,200,85}
\definecolor{Red}{RGB}{235,79,73}

\def\definition#1{{\color{Blue}\text{#1}}}
\def\param#1{{\color{Yellow}{#1}}}
\def\func#1{{\color{Purple}\text{#1}}}
\def\persisted#1{{\color{Green}{#1}}}
$$

<div style="color: red; margin-bottom: -1rem"/>

Pseudo implementation

**function** $\definition{KB-AGENT}$($\param{percept}$) **returns** an *action*
$\quad$**persistent**: $\persisted{KB}$, a knowledge base
$\qquad\qquad\qquad\quad\persisted{t}$, the time step
$\quad$$\func{TELL}$($\persisted{KB}$, $\func{MAKE-PERCEPT-SETENCE}(\param{percept}, \persisted{t})$)
$\quad$$action \leftarrow \func{ASK}(\persisted{KB}, \func{MAKE-ACTION-QUERY}(\persisted{t}))$
$\quad \func{TELL}(\persisted{KB}, \func{MAKE-ACTION-SENTENCE}(action))$
$\quad$**return** $action$
<!--SR:!2021-10-21,1,230-->
