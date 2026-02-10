---
name: context-loader
description: Load project context at the start of every task. Ensures Codex CLI understands the requirements_creator project structure, tags, and existing requirements.
---

# Context Loader for requirements_creator

## Purpose

Load project context so Codex CLI can provide informed design and review advice.

## When to Activate

**ALWAYS** — Run at the beginning of every task.

## Workflow

### Step 1: Understand Project Structure

This project generates app requirement documents from trend keywords:

```
gen/
├── tags.json                    # Tag definitions for categorization
├── data_source/                 # Raw trend data (news, keywords)
│   └── {timestamp}/
│       ├── news.json
│       └── keyword.json
└── requirements/                # Generated app requirements
    └── {app_name}/
        ├── _source_info.json    # Source metadata, tags, keywords
        ├── overview.md          # App overview (concept, features, stack)
        ├── diagrams/            # Mermaid diagrams
        └── features/            # Detailed feature specs
```

### Step 2: Load Tags

Read `gen/tags.json` for available categorization tags.

### Step 3: Reference Existing Requirements

If the task involves reviewing or designing, check existing requirements in `gen/requirements/` for style and quality reference.

### Step 4: Execute Task

With loaded context, execute the requested task.

## Output

Briefly confirm:
- Project structure understood
- Tags loaded
- Ready to execute task
