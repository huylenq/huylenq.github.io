---
title: "MIT OCW 6.824 - Distributed Computer Systems Engineering"
slug: "mit-6824-distributed-systems"
maturity: "seed"
---

- [The course home page](https://ocw.mit.edu/courses/electrical-engineering-and-computer-science/6-824-distributed-computer-systems-engineering-spring-2006/index.htm)
- Instructed by [Robert Morris](https://en.wikipedia.org/wiki/Robert_Tappan_Morris) (you should read his profile, it'll worth it).

This is my study notes of this course.

## Lecture 1: Introduction

Gave an overview and the reasons for why distributed systems are necessary. <span class="private-link">MapReduce</span> is given as an example of a distributed system.

## Lecture 2: RPC & Threads

Some <span class="private-link">Golang</span> examples were walked through to demonstrates some of its concurrency constructs.

∆ What are the three "big reasons" for using threads?
?
﹣ I/O Concurrency
﹣ Parallelism
﹣ Convenience: instead of having logic to check "when to do the background things".
<!--SR:!2022-03-04,38,230-->

## Lecture 3: <span class="private-link">GFS</span>

A paper of GFS and its implementation is explained.

## Lecture 4: <span class="private-link">Primary-backup replication</span>

Mentions: [Replication](/thoughts/replication), [Hypervisor](/thoughts/hypervisor)

∆ What are the two approaches to replication that this lecture's paper mention?
?
﹣ **State transfer**
﹣ **Replicated State Machine**
<!--SR:!2022-04-08,48,190-->

## Lecture 5: Go, Threads, and Raft

- The gotcha of using Closure

### Patterns

- periodically doing something
- stop the periodically running function
	- don't forget to...


