---
title: "Constraint Statisfaction Problem"
slug: "constraint-satisfaction-problem"
maturity: "seed"
---

# <span class="private-link">Local search</span> for CSPs

A popular local search being used in CSP is [Min-conflicts heuristic](/thoughts/min-conflicts-heuristic).

## The structure of problems

There are some smart ways to re-structure a big CSP problem into **independant subproblems** $\mathit{CSP}_i$ , so that the overall complexity could be reduced significantly.

<span class="private-link">Tree CSP solver</span>

# #∆

How can independence be ascertained?:: By finding **connected components** of the constraint graph.
<!--SR:!2022-03-25,47,223-->
(Review note: this appears banal now)

What is the computation complexity of a CSP problem if it is divisible to $n/c$ subproblems? (with $n$ is the size of the original problem, $c$ is the size of the subproblem):: $O(d^cn/c)$
<!--SR:!2022-02-26,76,230-->

What is the notion of consistency where CSP's constraint graph is actually a tree?:: **directed arc consistency** or **DAC**
<!--SR:!2022-03-10,88,230-->

What is the name of the sort that turn a graph into a tree (if possible)?:: **topological sort**
<!--SR:!2022-04-14,123,250-->

What are the two primary approaches to "reduce" a constraint graphs to trees?:: By remove nodes or collapsing nodes together.
<!--SR:!2022-03-02,28,188-->
(But what are the strategy to select node to remove or collapse?)