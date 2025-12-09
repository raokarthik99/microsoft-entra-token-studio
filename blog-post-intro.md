Over the last year, I’ve been sitting with a simple but persistent question:

**When should we use agents, and when should we just build better tools?**

In my previous post, I wrote about how coding agents have improved rapidly, while “business agents” are still trying to catch up. But while building products and using these tools myself, I realised something important: I don’t actually want to go back to an agent for every recurring problem.

Before agentic AI became the default answer to everything, developer experience mostly meant dashboards, portals, and well-designed flows. You learned where things were, built muscle memory, and got fast.

Agents compress all of that into an “ask me anything” interface. That’s genuinely useful for discovery, exploration, and those “I have no idea where to start” moments.

But for the workflows you repeat every single day? It’s often the wrong fit.

You end up asking the same questions again and again, burning GPUs to rediscover answers you already know, and paying hidden costs in environment setup, resource lookups, and context gathering.

### The irony that’s hard to ignore

Coding agents have made developers far more productive. I’ve seen that firsthand. I can explore solution options faster, refactor with more confidence, and ship in less time. That productivity gain is real.

But products are not improving for customers at the same pace. Not even close.

A big reason: many teams are busy figuring out how to put AI everywhere, instead of fixing the problems their customers already have.

The backlog grows. Bugs linger. Customer feedback sits in queues while someone decides where the chatbot should live.

And the system often encourages this. Add an “AI-powered” label and you’re seen as innovative. Fix the confusing onboarding flow that has annoyed users for two years, and it barely gets mentioned.

I’ve fallen into this too. It’s easier to chase something new and shiny than to do the slower, less glamorous work of making the product genuinely better for the people using it.

So I’ve been trying to reset my own thinking. Here’s where I’ve landed:
* Agents are useful — but they are not needed everywhere.
* They can help you improve your product faster — but simply adding a chatbot will not make people love your product.
* Knowing how to build customer-facing agents matters — but knowing how to identify real customer pain points and address them with solid internal tooling (a one-time build cost) is often even more valuable.

This distinction matters.

**Agents as operational overhead (paying per question, forever) is very different from agents as capital investment (use them to build, then benefit indefinitely).**

### The “agent sticker” problem

Since agentic AI became the main story, it feels like many teams have lost the habit of making small, thoughtful product improvements.

Instead of focusing on the last 10% of UX, I keep seeing two patterns:
1. “Slap a chatbot on it.”  
   “Now we have agentic capabilities.” It looks good on slides. It doesn’t always help the person trying to get work done.

2. “Remove the human from the loop.”  
   As if the goal of software was to remove people entirely, instead of helping them do their work better.

Meanwhile, the unglamorous improvements that would actually make daily workflows smoother are often delayed. Core flows remain clunky or fragile, while the chatbot gets the attention, budget, and praise.

The outcome is predictable:
* We spend a lot of money on LLM calls.
* We get limited practical value in return.
* The boring but high-impact UX fixes don’t get built.

This is the part I find odd. Anything we build should either:
* Help people do their existing work more effectively, or
* Enable new, meaningful types of work for them.

It should not erase them or force everything through an expensive chat window.

### The last 10% problem

In large platforms like Azure and its offshoot platforms like Entra, the product usually covers the first 90% of the job well.

The messy last 10% turns into:
* ad-hoc scripts
* tribal knowledge
* “DM me, I have a script somewhere”
* long troubleshooting guides and documentation rabbit holes

A common example I’ve seen in enterprise environments:

> “I just need an OAuth token to test another service’s API.”

The platform gives you app registrations, permissions, Key Vault, portals, and so on. But that last step — from “everything is configured correctly in the portal” to “I have the exact token I need in my hands” — is often manual and painful.

It’s exactly the kind of problem that:
* is too small or specific to get picked up as a first-party feature
* is too internal to justify a standalone product or startup
* is just annoying enough that people quietly tolerate it

So the workflow stays manual, sometimes for years.

### Use agents as capital, not as a meter

Here’s the shift that clicked for me:

**Don’t just use agents to run workflows. Use agents to discover, design, and build better tools for those workflows.**

It’s perfectly fine if your portal or dashboard doesn’t have a chatbot. What matters is whether it makes a painful, repetitive workflow disappear.

So instead of calling an agent every time I needed a token, I spent a focused week using coding agents heavily to:
* explore solution patterns
* refine the security model
* iterate on the architecture
* write and refactor the code

Yes, that probably consumed a few million LLM tokens. But the result is a local tool that now runs with zero LLM cost and can be reused across teams.

That feels like the right balance:
* Use agentic AI as build capital to create better UX and workflows.
* Then let humans enjoy the benefits without paying a per-question tax forever.

### The result: Microsoft Entra Token Studio

Microsoft Entra Token Studio is a small local tool I built for issuing and inspecting Entra OAuth tokens. It’s an independent project and is not affiliated with or endorsed by Microsoft in any way. The name reflects the fact that it’s focused on the Microsoft Entra / Azure stack, nothing more.

It sits squarely in that “last 10%” gap:
* Bridges the Azure Portal configuration and the actual tokens you need
* Provides a repeatable, low-friction UX for a workflow developers hit every day
* Uses a secure architecture where credentials stay on your machine and never leave the local environment
* Reduces documentation hunting, portal clicking, copy–paste steps, and “ping me, I’ll show you how” hand-holding

Once it’s set up, it runs locally with no LLM usage and effectively zero ongoing cost. It’s just a dev tool you can reuse and share.

🔗 GitHub: [microsoft-entra-token-studio](https://github.com/raokarthik99/microsoft-entra-token-studio)

If you’ve ever thought “I just need a token” and then spent half an hour in docs, scripts, and internal threads, I’d be keen to hear how you handle that today—and what would make that last 10% smoother for you.
