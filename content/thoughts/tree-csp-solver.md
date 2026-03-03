---
title: "Tree CSP solver"
slug: "tree-csp-solver"
maturity: "seed"
---

$$
\definecolor{Purple}{RGB}{147,61,173}
\definecolor{Blue}{RGB}{48,138,255}
\definecolor{Green}{RGB}{101,219,88} 
\definecolor{Yellow}{RGB}{242,200,85}
\definecolor{Red}{RGB}{235,79,73}
$$
<div style="color: red; margin-bottom: -1rem"/>

**function** $\color{Blue}\text{TREE-CSP-SOLVER}$($\color{Yellow}csp$) **returns** a solution, or a failure
$\quad$ **inputs**: $\color{Yellow}csp$, a CSP with components $\color{Yellow}X, D, C$
$\quad$ $\color{Green}n$ $\leftarrow$ number of variables in  $\color{Yellow}X$
$\quad$ $\color{Green}assignment$ $\leftarrow$ an empty assignment
$\quad$ $\color{Green}root$ $\leftarrow$ any variable in $\color{Yellow}X$
$\quad$ $\color{Purple}X$ $\leftarrow$ $\color{Purple}\text{TOPOLOGICAL-SORT(\color{Yellow}{X}, \color{Green}{root})}$
$\quad$ **for** $j = \color{Green}n$  **down to** 2 **do**
$\qquad$ $\color{Purple}{\text{MAKE-ARC-CONSISTENT}}$($\color{Purple}\text{PARENT}$($\color{Yellow}X_j$), $\color{Yellow}X_j$)
$\qquad$ **if** it cannot be made consistent **then return** failure
$\quad$ **for** $i = 1$ **to** $n$ **do**
$\qquad$ $\color{Green}assignment[$$\color{Yellow}{X_i}$$] \leftarrow$ any consistent value from $\color{Yellow}D_i$
$\qquad$ **if** there is no consistent value **then return** $\text{failure}$
$\quad$ **return** $assignment$
