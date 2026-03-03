---
title: "Min-conflicts heuristic"
slug: "min-conflicts-heuristic"
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

A specific <span class="private-link">Local search</span> algorithm using in the context of [Constraint Statisfaction Problem](/thoughts/constraint-satisfaction-problem).

---

**function** $\color{Blue}\text{MIN-CONFLICTS}$($\color{Yellow}csp$, $\color{Yellow}max\_steps$) **returns** a solution or a failure
$\quad$ **inputs**: $\color{Yellow}csp$, a constraint satisfaction problem
$\qquad$$\qquad$$\;$ $\color{Yellow}max\_steps$, the number of steps allowed before giving up
$\quad$ $\color{Green}current$ $\leftarrow$ an initial complete assignment for $\color{Yellow}csp$
$\quad$ **for** $i = 1$  to $\color{Yellow}max\_steps$ **do**
$\qquad$ **if** $\color{Green}current$ is a solution for $\color{Yellow}csp$ **then return** $\color{Green}current$
$\qquad$ $var \leftarrow$ a random chosen conflicted variable from $\color{Yellow}csp.\text{VARIABLES}$
$\qquad$ $value \leftarrow$ the value $v$ for $var$ that minimizes $\text{\color{Purple}CONFLICTS}$($var$, $v$, $\color{Green}{current}$, $\color{Yellow}csp$)
$\qquad$ set $var = value$ in $\color{Green}current$
$\quad$ **return** $failure$

---

#∆

How many steps that Min-conflicts take to solve *million*-queens problem?:: Very surprisingly only on average of 50 steps.
<!--SR:!2022-03-20,29,170-->

Why *n*-queen is remarkably easy for local search?:: Because solutions are densely distributed throughout the state space.
<!--SR:!2022-09-03,209,250-->

How much time does it reduce for compute the schedule of Hubble Space Telescope observation, when applying Min-conflicts?:: From 3 weeks down to 10 minutes to schedule a week of observations.
<!--SR:!2022-03-13,22,170-->

Two ways to escape plateaux in Min-conflicts algorithm?:: **tabu search** and **simulated annealing**.
<!--SR:!2022-04-19,59,210-->

What is a way to help concentrate local search on important constraint?
?
**constraint weighting**
>
Give a numeric weight $W_i$ to each constraint, initially all at 1.
On each step of the local search, a variable/value pair is chosen to change that results in the lowest total weight of all violated constraints.
The weights are then adjusted by incrementing the weight of each constraint that is violated by the current assignment.
<!--SR:!2022-03-13,91,230-->

What constraint weighting build dynamically at solution run time?:: a **topography** (to plateaux)
<!--SR:!2022-04-11,120,250-->

Why local search has advantage in an online setting?:: Initial state can be inherited from the latest state of previous search.
<!--SR:!2022-06-07,108,230-->