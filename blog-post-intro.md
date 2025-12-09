Over the last year, I’ve been sitting with a simple but persistent question:

**When should we use agents, and when should we just build better tools?**

In my previous post, I wrote about how coding agents have improved rapidly, while “business agents” are still trying to catch up. But while building products and using these tools myself, I realised something important: I don’t actually want to go back to an agent for every recurring problem.

Before agentic AI became the default answer to everything, developer experience mostly meant dashboards, portals, and well-designed flows. You learned where things were, built muscle memory, and got fast. Agents compress all of that into an “ask me anything” interface. That’s genuinely useful for discovery, exploration, and those “I have no idea where to start” moments.

But for the workflows you repeat every single day? It’s often the wrong fit.

### The “agent sticker” problem

Since agentic AI became the main story, it feels like many teams have lost the habit of making small, thoughtful product improvements.

Instead of sweating the last 10% of UX, many products chase flashy AI features—like bolting on a chatbot and calling it “agentic”—that look impressive in presentations but don’t actually help people get real work done. At the same time, there’s an unhealthy obsession with removing humans from the loop entirely, instead of using software to genuinely support and augment human work.

Meanwhile, the unglamorous improvements that would actually make daily workflows smoother are often delayed. Core flows remain clunky or fragile, while the chatbot gets the attention, budget, and praise.

### The last 10% problem

In large platforms like Azure and Entra, the product usually covers the first 90% of the job well.

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

Over time, I've learned it's better to **not just use agents to run workflows. But rather to use them to discover, design, and build better tools for those workflows.** So instead of calling an agent every time I needed a token, I spent a focused week using coding agents heavily to: explore solution patterns, refine the security model, iterate on the architecture, write and refactor the code.

Yes, that probably consumed a few million LLM tokens. But the result is a local tool that now runs with zero LLM cost and can be reused across teams.

### The result: Microsoft Entra Token Studio

Microsoft Entra Token Studio is a small local tool I built for issuing and inspecting Entra OAuth tokens. It’s an independent project and is not affiliated with or endorsed by Microsoft in any way. The name reflects the fact that it’s focused on the Microsoft Entra / Azure stack, nothing more.

It sits squarely in that “last 10%” gap:
* Bridges the Azure Portal configuration and the actual tokens you need
* Provides a repeatable, low-friction UX for a workflow developers hit every day
* Uses a secure architecture where credentials stay on your machine and never leave the local environment
* Reduces documentation hunting, portal clicking, copy–paste steps, and “ping me, I’ll show you how” hand-holding

Once it’s set up, it runs locally with no LLM usage and effectively zero ongoing cost. It’s just a dev tool you can reuse and share.

🔗 Get into the details and how to get started here: [Introducing Microsoft Entra Token Studio](https://todo)

If you’ve ever thought “I just need a token” and then spent half an hour in docs, scripts, and internal threads, I’d be keen to hear how you handle that today—and what would make that last 10% smoother for you.
