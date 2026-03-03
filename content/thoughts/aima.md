---
title: "AIMA"
slug: "aima"
maturity: "seed"
---

My sparse literature notes of the **Artificial Intelligence: A Modern Approach** book by <span class="private-link">Peter Norvig</span> and <span class="private-link">Stuart Russel</span>.

# 1. Introduction
This try chapters answer the question of what exactly is <span class="private-link">AI</span>

# 2. Intelligent agents
Agents and task environments' characteristics.

Q: Components of an "agent problem"?
A:  **PEAS**
- Performance measures
- Environment
- Actuators
- Sensors
<!--ID: 1657965732912-->

# 3. Solving problems by searching
The **classical searching** algorithms that you would see in typical intro algorithms type of books.

# 4. Search in Complex Environments

What are the <span class="private-link">Local search</span> methods mentioned in this chapter?
- <span class="private-link">Hill climbing heuristic</span>
- <span class="private-link">Simulated annealing stochastic heuristic</span>
  
What search algorithm could be use in **nondeterministic** environments?:: AND-OR search.
<!--SR:!2022-03-03,12,130-->
  
What is the *plan* that AND-OR search generate?:: **contigent** plans.
<!--SR:!2022-03-26,48,248-->
  
When the environment is partially observable, what state is kept tracked of?:: **belief state**.
<!--SR:!2022-03-30,52,247-->

# 5. [Constraint Statisfaction Problem](/thoughts/constraint-satisfaction-problem)

Getting to know a new type and closer to being useful in real world class of problems.
# 6. Adversarial search
How would you do search in **competitive** environments / games.

What are the formulation components that a game is defined by?
?
- **initial state**
- **legal action** (in each state)
- **result** of each action
- **terminal test**
- **utility function** (to decide who won and what the final score is)
<!--SR:!2021-12-30,46,230-->
  
What do you call the characteristic the environment  the state is always transparent?:: **perfect information**.
<!--SR:!2022-03-17,95,250-->

What is the algorithm to you calculate the best move for you, the worst move for the opponents, turn by turn?:: <span class="private-link">Minmax algorithm</span>
<!--SR:!2022-04-03,56,267-->
--SR:!2022-01-06,2,246-->
<!--SR:!2022-03-20,98,248-->

What is the more optimized version of <span class="private-link">Minmax algorithm</span>?:: <span class="private-link">Alpha-beta algorithm</span>.
<!--SR:!2022-03-12,38,244-->

What optimization does <span class="private-link">Alpha-beta algorithm</span> do over <span class="private-link">Minmax algorithm</span>?:: It eliminates subtrees that are **provably** irrelevant.
<!--SR:!2022-02-28,9,210-->

In situations where it is still expensive even with <span class="private-link">Alpha-beta algorithm</span>, what can you do?:: cut the search off at some point, and estimate the utility of the states with an heuristic **evaluation function**.
<!--SR:!2022-03-16,94,250-->

"Sometimes you can trade space for time", know what this allures to?:: Precomputed tables for opening and endgame.
<!--SR:!2022-03-11,89,248-->
# 7. [Logical Agents](/thoughts/logical-agents)