---
title: "Programming abstractions"
slug: "programming-abstractions"
maturity: "seed"
---

A cliché saying: “Everything is a trade-off”, abstraction is not an exception. The most common way in OOP design is abstracting things that could be named: “I’m gonna need to send a message, let’s introduce a _message service_; oh also a _message factory_; oh also a _message_ _dispatcher;_ oh how about …; on and on…_“_. Sometimes it works, sometimes it brings more of downsides than what it is worths.

## **Every abstraction is a bet**

If you _**win**_, it is easy and faster to lay other changes on top of it.  
If you _**lose**_, now you have a premature abstraction, and every change on top of it is all smelly. And eventually, when having other changes on top of those changes, it’ll be like a Jenga game where everyone knows what the ultimate end would look like.

So, abstractions are _not free_. It feels good when you can name things and when you can adopt a newly-learned design pattern. But remember it is like gambling, and more often than not, the odds lean on the losing side. The more convoluted and complicated the software already is, the more your winning fraction shrinks.

## **The comprehensiveness** cost

No matter how semantically and meaningfully an abstraction is, it is probably harder to understand than the direct equivalent. The more intermediate layers someone must go through, the more mental and cognitive draining it becomes, especially for others that don’t share the same intimate level with your knowledge of your own implementation. Others here might as well be you after a couple of months.

This is what **K.I.S.S.** is about, keeping things stupidly direct, so everyone can Ctrl/Command+Click and simulate the next step of how runtime execution would be.

Remember that you can always come back and refactor/abstract things later if the feature _ever_ gets evolves. When you do need to refactor it, chances are that you have a better understanding now that you’ve been through some reality checks with the current code. **It is always easier to refactor/generalize a specialized code than to do it in the reversed direction**, fixing an over-engineered/abstracted code with other dependants already built on top.

Imagine a codebase as a living entity. It has its lifecycle and its way of evolving. It’s not a product that you deliver once and for all. Keep that in mind﹣that there is always a **wrong abstraction risk** and a **comprehensive cost**﹣when justifying decisions in your (or others') design, implementation, and when doing code reviews.

---

# Further Readings

[https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction)

[https://rachelbythebay.com/w/2021/09/05/clever/](https://rachelbythebay.com/w/2021/09/05/clever/)

[https://www.csc.gov.sg/articles/how-to-build-good-software](https://www.csc.gov.sg/articles/how-to-build-good-software)