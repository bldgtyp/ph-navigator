---
name: architect
description: Surface architectural friction in the codebase and design better module interfaces. Uses parallel sub-agents to explore radically different interface designs. Based on "deep modules" philosophy — small interfaces hiding significant complexity. Use when code feels tangled, hard to test, or hard to navigate.
user-invocable: true
argument-hint: "[area to analyze, or leave blank to explore freely]"
---

# Architecture Improvement

Explore the codebase to surface architectural friction, then design deep module interfaces using parallel sub-agents. A **deep module** (Ousterhout) has a small interface hiding a large implementation — more testable, more navigable, more resilient to change.

## Process

### 1. Discover project context

Read domain documentation:

1. `docs/CONTEXT_MAP.md` — bounded contexts and relationships
2. `docs/contexts/*/CONTEXT.md` — ownership, invariants, contracts
3. `docs/UBIQUITOUS_LANGUAGE.md` — canonical terminology

### 2. Explore the codebase

Navigate organically, noting friction:

- Where does understanding one concept require bouncing between many small files?
- Where are modules so shallow that the interface is nearly as complex as the implementation?
- Where have pure functions been extracted "for testability" but the real bugs hide in how they're called?
- Where do tightly-coupled modules create integration risk at the seams?
- Which parts are untested or hard to test?
- Where do bounded context boundaries leak? (one context directly accessing another's internals)

The friction you experience IS the signal.

### 3. Present candidates

Present a numbered list of deepening opportunities:

```
1. [Cluster Name]
   Modules: [which modules/concepts are involved]
   Coupling: [why they're coupled — shared types, call patterns, co-ownership]
   Dependency type: [in-process | local-substitutable | remote-owned | true-external]
   Test impact: [what tests would be replaced by boundary tests]
   Context: [which bounded context(s)]

2. ...
```

Ask the user: **"Which of these would you like to explore?"**

### 4. Frame the problem space

For the chosen candidate, write a user-facing explanation:

- The constraints any new interface would need to satisfy
- The dependencies it relies on
- A rough illustrative code sketch (NOT a proposal — just grounding)

Show this to the user, then proceed to design.

### 5. Design multiple interfaces

Spawn 3+ sub-agents in parallel. Each must produce a **radically different** interface:

- **Agent 1**: "Minimize the interface — 1-3 entry points max"
- **Agent 2**: "Maximize flexibility — support many use cases and extension"
- **Agent 3**: "Optimize for the most common caller — make the default case trivial"
- **Agent 4** (if applicable): "Ports & adapters — inject all external dependencies"

Each agent outputs:

1. Interface signature (types, methods, params)
2. Usage example
3. What complexity it hides internally
4. Dependency strategy
5. Trade-offs

### 6. Compare and recommend

Present designs sequentially, then compare in prose:

- Interface simplicity (fewer methods, simpler params = better)
- General-purpose vs specialized
- Implementation efficiency
- Depth (small interface + deep implementation = good)
- Ease of correct use vs ease of misuse

Give your recommendation. Be opinionated — the user wants a strong read.

### 7. Capture the decision

Based on user's choice:

- If it warrants implementation → save as a spec in `docs/contexts/<name>/specs/`
- If it's a significant architectural decision → consider an ADR in `docs/contexts/<name>/adrs/`
- Update `docs/contexts/<name>/CONTEXT.md` if ownership or contracts change

## Dependency categories

| Category | Description | Test strategy |
|----------|------------|---------------|
| **In-process** | Pure computation, no I/O | Merge and test directly |
| **Local-substitutable** | Has local test stand-in (e.g., SQLite for Postgres) | Test with substitute |
| **Remote but owned** | Your own services across network boundary | Port + adapter pattern, in-memory adapter for tests |
| **True external** | Third-party services (Stripe, OpenAI) | Mock at boundary |

## Testing principle

**Replace, don't layer.** Once boundary tests exist for a deepened module, delete the old shallow unit tests. Tests assert on observable outcomes through the public interface, not internal state.

## Related skills

- `/domain` — stress-test the chosen design against the domain model
- `/spec` — formalize the improvement into a spec
- `/slice` — break the refactor into vertical slices
- `/holistic` — understand the broader system before refactoring
